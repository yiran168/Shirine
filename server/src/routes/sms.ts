import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";
import { verifyTurnstile } from "../core/turnstile";
import { digest, randomValue, seal } from "../core/oauth-config";
import { isSmsProvider, normalizePhone, providerValues, readSmsConfig, smsProviders, validateSmsValues, writeSmsConfig, type SmsConfig, type SmsValues } from "../core/sms-config";
import { sendSms } from "../core/sms-providers";
import { claimSmsBudget, SmsError, smsHash } from "../core/sms-registration";

export const smsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
smsRouter.use("*", async (c,next) => { c.header("Cache-Control","no-store"); await next(); });
smsRouter.get("/config", async c => {
  try { const config = await readSmsConfig(c.env); return c.json({ success:true, enabled:config.enabled, countries:config.countries }); }
  catch { return c.json({ success:false,error:"暂时无法读取注册验证设置，请稍后重试" },503); }
});
smsRouter.get("/settings",requireAdmin,async c => {
  try {
    const config = await readSmsConfig(c.env);
    return c.json({ success:true,...config,providers:smsProviders.map(p => ({ ...p,values:Object.fromEntries(p.fields.map(f => [f.key,f.secret ? "" : config.providers[p.id]?.[f.key] || f.default || ""])), savedSecrets:p.fields.filter(f => f.secret && config.providers[p.id]?.[f.key]).map(f => f.key) })) });
  } catch { return c.json({ success:false,error:"无法读取短信配置，请检查 JWT_SECRET 和数据库迁移" },503); }
});
smsRouter.put("/settings",requireAdmin,async c => {
  try {
    const body = await c.req.json();
    if (typeof body.enabled !== "boolean" || !isSmsProvider(body.provider) || !Array.isArray(body.countries) || !body.countries.length || body.countries.length>30 || body.countries.some((v:unknown) => typeof v!=="string" || !/^[1-9]\d{0,2}$/.test(v))) throw new SmsError("请设置服务商及有效的国家/地区区号（不含 +）");
    for (const [key,max] of [["phoneDaily",20],["ipHourly",100],["totalDaily",10000]] as const) if (!Number.isInteger(body[key]) || body[key]<1 || body[key]>max) throw new SmsError(`${key} 应为 1–${max} 的整数`);
    if (!Array.isArray(body.providers) || body.providers.length!==smsProviders.length || new Set(body.providers.map((p:any)=>p.id)).size!==smsProviders.length) throw new SmsError("服务商配置不完整，请刷新后重试");
    const old = await readSmsConfig(c.env);
    const next: SmsConfig = { enabled:body.enabled,provider:body.provider,countries:[...new Set<string>(body.countries)],phoneDaily:body.phoneDaily,ipHourly:body.ipHourly,totalDaily:body.totalDaily,providers:{} };
    for (const item of body.providers) {
      if (!isSmsProvider(item.id) || !item.values || typeof item.values!=="object") throw new SmsError("无效的服务商配置");
      const descriptor = smsProviders.find(p=>p.id===item.id)!;
      const values: SmsValues = {};
      for (const field of descriptor.fields) {
        const value = item.values[field.key];
        if (value!==undefined && typeof value!=="string") throw new SmsError("短信配置字段应为文本");
        const cleared = Array.isArray(item.clearSecrets) && item.clearSecrets.includes(field.key);
        values[field.key] = field.secret ? cleared ? "" : value?.trim() || old.providers[descriptor.id]?.[field.key] || "" : value?.trim() || field.default || "";
      }
      validateSmsValues(item.id,values,next.enabled && item.id===next.provider);
      next.providers[descriptor.id] = values;
    }
    const active=smsProviders.find(p=>p.id===next.provider)!;
    if (next.enabled && "domesticOnly" in active && next.countries.some(v=>v!=="86")) throw new SmsError("该接入方式仅支持中国大陆号码，请仅允许区号 86");
    await writeSmsConfig(c.env,next);
    return c.json({success:true});
  } catch(err) { return c.json({success:false,error:err instanceof Error ? err.message : "短信设置保存失败"},400); }
});

smsRouter.post("/send",async c => {
  try {
    const config=await readSmsConfig(c.env);
    if (!config.enabled) throw new SmsError("短信注册验证未开启",403);
    if (c.env.ENVIRONMENT==="production" && !c.env.ADMIN_PASSWORD && !await c.env.DB.prepare("SELECT id FROM users WHERE role='superadmin' LIMIT 1").first()) throw new SmsError("请先完成站点初始化",403);
    const values=providerValues(config);
    validateSmsValues(config.provider,values,true);
    const body=await c.req.json();
    const phone=normalizePhone(body.phone,config.countries);
    const active=smsProviders.find(p=>p.id===config.provider)!;
    if ("domesticOnly" in active && !phone.startsWith("+86")) throw new SmsError("该服务商仅支持中国大陆号码");
    const now=Math.floor(Date.now()/1000);
    const ip=await smsHash(c.env,"ip",c.req.header("CF-Connecting-IP") || "local");
    // An inexpensive attempt cap also protects Turnstile Siteverify from repeated abuse.
    await claimSmsBudget(c.env,`attempt:${ip}:${Math.floor(now/600)}`,30,now+600);
    const verification=await verifyTurnstile(c,body.turnstileToken);
    if (!verification.success) throw new SmsError(verification.message || "请先完成人机验证");
    const phoneHash=await smsHash(c.env,"phone",phone);
    if (await c.env.DB.prepare("SELECT user_id FROM user_phones WHERE phone_hash=?").bind(phoneHash).first()) throw new SmsError("该手机号已注册，请登录已有账号");
    await claimSmsBudget(c.env,`cooldown:${phoneHash}`,1,now+60);
    await claimSmsBudget(c.env,`phone:${phoneHash}:${Math.floor(now/86400)}`,config.phoneDaily,(Math.floor(now/86400)+1)*86400);
    await claimSmsBudget(c.env,`ip:${ip}:${Math.floor(now/3600)}`,config.ipHourly,(Math.floor(now/3600)+1)*3600);
    await claimSmsBudget(c.env,`total:${Math.floor(now/86400)}`,config.totalDaily,(Math.floor(now/86400)+1)*86400);
    const prior=getCookie(c,"shirine_sms") || "";
    const browser=/^[\w-]{43}$/.test(prior) ? prior : randomValue();
    const id=randomValue();
    // Rejection sampling avoids modulo bias in the six-digit code.
    const random=new Uint32Array(1); do { crypto.getRandomValues(random); } while(random[0]>=4294000000);
    const code=String(random[0]%1000000).padStart(6,"0");
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM sms_rate_limits WHERE expires_at<=?").bind(now),
      c.env.DB.prepare("DELETE FROM sms_challenges WHERE expires_at<=? OR phone_hash=?").bind(now,phoneHash),
      c.env.DB.prepare("INSERT INTO sms_challenges (id,phone_hash,browser_hash,code_hash,phone_encrypted,expires_at) VALUES (?,?,?,?,?,?)")
        .bind(id,phoneHash,await digest(browser),await smsHash(c.env,"code",`${id}\0${phoneHash}\0${code}`),await seal(phone,c.env,"sms-phone"),now+300),
    ]);
    try { await sendSms(config.provider,values,phone,code); }
    catch { throw new SmsError("短信服务商暂未确认发送，请检查号码或稍后重试；本次请求仍计入发送限额",503); }
    await c.env.DB.prepare("UPDATE sms_challenges SET issued=1 WHERE id=?").bind(id).run();
    const secure=c.env.ENVIRONMENT==="production" || new URL(c.req.url).protocol==="https:";
    c.header("Set-Cookie",`shirine_sms=${browser}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=600${secure ? "; Secure" : ""}`,{append:true});
    return c.json({success:true,challengeId:id,maskedPhone:`${phone.slice(0,3)}••••${phone.slice(-4)}`,retryAfter:60,expiresIn:300});
  } catch(err) {
    return c.json({success:false,error:err instanceof SmsError ? err.message : "短信发送暂时不可用，请检查设置或稍后重试"},err instanceof SmsError ? err.status : 503);
  }
});
