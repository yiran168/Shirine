import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { digest } from "./oauth-config";
import { normalizeEmail, readEmailConfig } from "./email-config";
import { SmsError, smsHash } from "./sms-registration";
type EmailProof={id:string;recipientHash:string;browserHash:string;codeHash:string};
export async function verifyRegistrationEmail(c:Context<{Bindings:Env;Variables:Variables}>,body:Record<string,unknown>):Promise<EmailProof|null> {
  const email=normalizeEmail(body.email);
  if(!(await readEmailConfig(c.env)).enabled) return null;
  if(typeof body.emailChallengeId!=="string" || !/^[\w-]{43}$/.test(body.emailChallengeId) || typeof body.emailCode!=="string" || !/^\d{6}$/.test(body.emailCode)) throw new SmsError("请先获取并填写六位邮箱验证码");
  const browser=getCookie(c,"shirine_email") || "";
  if(!/^[\w-]{43}$/.test(browser)) throw new SmsError("验证码不属于当前浏览器，请重新获取");
  const recipientHash=await smsHash(c.env,"email",email),browserHash=await digest(browser);
  const row=await c.env.DB.prepare("UPDATE email_challenges SET attempts=attempts+1 WHERE id=? AND recipient_hash=? AND browser_hash=? AND issued=1 AND used_at IS NULL AND expires_at>unixepoch() AND attempts<5 RETURNING code_hash")
    .bind(body.emailChallengeId,recipientHash,browserHash).first<{code_hash:string}>();
  if(!row) throw new SmsError("邮箱验证码已失效、尝试次数过多或邮箱不匹配，请重新获取");
  const codeHash=await smsHash(c.env,"email-code",`${body.emailChallengeId}\0${recipientHash}\0${body.emailCode}`);
  let different=row.code_hash.length^codeHash.length;
  for(let i=0;i<codeHash.length;i++) different|=codeHash.charCodeAt(i)^(row.code_hash.charCodeAt(i)||0);
  if(different) throw new SmsError("邮箱验证码不正确");
  return {id:body.emailChallengeId,recipientHash,browserHash,codeHash};
}
export async function registerWithEmail(env:Env,proof:EmailProof,user:{username:string;email:string;nickname:string;passwordHash:string;salt:string}):Promise<{id:number}|null> {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (username,email,nickname,password_hash,salt,role,points,status) SELECT ?,?,?,?,?,'user',0,'active' WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)) AND EXISTS (SELECT 1 FROM email_challenges WHERE id=? AND recipient_hash=? AND browser_hash=? AND code_hash=? AND issued=1 AND used_at IS NULL AND expires_at>unixepoch() AND attempts<=5)")
      .bind(user.username,user.email,user.nickname,user.passwordHash,user.salt,user.username,user.email,proof.id,proof.recipientHash,proof.browserHash,proof.codeHash),
    env.DB.prepare("UPDATE email_challenges SET used_at=unixepoch() WHERE id=? AND EXISTS (SELECT 1 FROM users WHERE username=? AND salt=?)").bind(proof.id,user.username,user.salt),
  ]);
  return env.DB.prepare("SELECT id FROM users WHERE username=? AND salt=?").bind(user.username,user.salt).first<{id:number}>();
}
