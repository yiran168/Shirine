import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { digest } from "./oauth-config";
import { readSmsConfig, normalizePhone } from "./sms-config";
import { hex, hmac } from "./sms-providers";

export const smsHash = (env: Env, purpose: string, value: string) => hmac(env.JWT_SECRET, `Shirine SMS v1\0${purpose}\0${value}`).then(hex);
export class SmsError extends Error { constructor(message: string, public status: 400 | 403 | 429 | 503 = 400) { super(message); } }
export async function claimSmsBudget(env: Env, bucket: string, limit: number, expires: number): Promise<void> {
  const row = await env.DB.prepare("INSERT INTO sms_rate_limits (bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<=unixepoch() THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=unixepoch() THEN excluded.expires_at ELSE expires_at END WHERE expires_at<=unixepoch() OR attempts<? RETURNING attempts")
    .bind(bucket, expires, limit).first();
  if (!row) throw new SmsError("发送请求过于频繁或已达到站点发送额度，请稍后再试", 429);
}

type Proof = { id: string; phoneHash: string; encrypted: string; codeHash: string; browserHash: string };
export async function verifyRegistrationSms(c: Context<{ Bindings: Env; Variables: Variables }>, body: Record<string, unknown>): Promise<Proof | null> {
  const config = await readSmsConfig(c.env);
  if (!config.enabled) throw new SmsError("手机号注册未开启",403);
  const phone = normalizePhone(body.phone, config.countries);
  if (typeof body.smsChallengeId !== "string" || !/^[\w-]{43}$/.test(body.smsChallengeId) || typeof body.smsCode !== "string" || !/^\d{6}$/.test(body.smsCode)) throw new SmsError("请先获取并填写六位短信验证码");
  const browser = getCookie(c, "shirine_sms") || "";
  if (!/^[\w-]{43}$/.test(browser)) throw new SmsError("验证码不属于当前浏览器，请重新获取");
  const phoneHash = await smsHash(c.env, "phone", phone);
  const browserHash = await digest(browser);
  const row = await c.env.DB.prepare("UPDATE sms_challenges SET attempts=attempts+1 WHERE id=? AND phone_hash=? AND browser_hash=? AND issued=1 AND used_at IS NULL AND expires_at>unixepoch() AND attempts<5 RETURNING code_hash,phone_encrypted")
    .bind(body.smsChallengeId, phoneHash, browserHash).first<{ code_hash: string; phone_encrypted: string }>();
  if (!row) throw new SmsError("验证码已失效、尝试次数过多或手机号不匹配，请重新获取");
  const codeHash = await smsHash(c.env, "code", `${body.smsChallengeId}\0${phoneHash}\0${body.smsCode}`);
  let different = row.code_hash.length ^ codeHash.length;
  for (let i = 0; i < codeHash.length; i++) different |= codeHash.charCodeAt(i) ^ (row.code_hash.charCodeAt(i) || 0);
  if (different) throw new SmsError("短信验证码不正确");
  return { id: body.smsChallengeId, phoneHash, encrypted: row.phone_encrypted, codeHash, browserHash };
}

export async function registerWithSms(env: Env, proof: Proof, user: { username: string; email: string; nickname: string; passwordHash: string; salt: string }): Promise<{ id: number } | null> {
  // D1 batch is transactional. The fresh password salt identifies only this insertion.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (username,email,nickname,password_hash,salt,role,points,status) SELECT ?,?,?,?,?,'user',0,'active' WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username)=lower(?) OR (?!='' AND lower(email)=lower(?))) AND NOT EXISTS (SELECT 1 FROM user_phones WHERE phone_hash=?) AND EXISTS (SELECT 1 FROM sms_challenges WHERE id=? AND phone_hash=? AND browser_hash=? AND code_hash=? AND issued=1 AND used_at IS NULL AND expires_at>unixepoch() AND attempts<=5)")
      .bind(user.username,user.email,user.nickname,user.passwordHash,user.salt,user.username,user.email,user.email,proof.phoneHash,proof.id,proof.phoneHash,proof.browserHash,proof.codeHash),
    env.DB.prepare("INSERT INTO user_phones (user_id,phone_hash,phone_encrypted,verified_at) SELECT id,?,?,unixepoch() FROM users WHERE username=? AND salt=?")
      .bind(proof.phoneHash,proof.encrypted,user.username,user.salt),
    env.DB.prepare("UPDATE sms_challenges SET used_at=unixepoch() WHERE id=? AND EXISTS (SELECT 1 FROM users WHERE username=? AND salt=?)")
      .bind(proof.id,user.username,user.salt),
  ]);
  return env.DB.prepare("SELECT id FROM users WHERE username=? AND salt=?").bind(user.username,user.salt).first<{ id: number }>();
}
