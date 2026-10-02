import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";
import { verifyTurnstile } from "../core/turnstile";
import { digest, randomValue } from "../core/oauth-config";
import { emailProviders, normalizeEmail, readEmailConfig, writeEmailConfig, type EmailConfig } from "../core/email-config";
import { sendEmail } from "../core/email-providers";
import { validateSmtpHost } from "../core/smtp";
import { claimSmsBudget, SmsError, smsHash } from "../core/sms-registration";
export const emailRouter=new Hono<{Bindings:Env;Variables:Variables}>();
emailRouter.use("*",async(c,next)=>{c.header("Cache-Control","no-store");await next();});
emailRouter.get("/config",async c=>{
  try{return c.json({success:true,enabled:(await readEmailConfig(c.env)).enabled});}
  catch{return c.json({success:false,error:"邮箱验证设置暂不可用"},503);}
});
emailRouter.get("/settings",requireAdmin,async c=>{
  try{const config=await readEmailConfig(c.env);return c.json({success:true,...config,apiKey:"",hasSecret:!!config.apiKey,providers:emailProviders});}
  catch{return c.json({success:false,error:"无法读取邮件设置，请检查 JWT_SECRET"},503);}
});
emailRouter.put("/settings",requireAdmin,async c=>{
  try{
    const body=await c.req.json(),old=await readEmailConfig(c.env);
    if(typeof body.enabled!=="boolean" || !emailProviders.some(p=>p.id===body.provider) || !["us","eu"].includes(body.region)) throw new Error("无效的邮件设置");
    for(const key of ["sender","senderName","apiKey","domain","smtpHost","smtpUser","accessKeyId","cloudRegion","templateId","templateParams"]) if(body[key]!==undefined && (typeof body[key]!=="string" || body[key].length>(key==="apiKey" || key==="templateParams"?2048:254) || /[\x00-\x1f\x7f]/.test(body[key]))) throw new Error("邮件设置字段无效");
    for(const [key,max] of [["recipientDaily",20],["ipHourly",100],["totalDaily",10000]] as const) if(!Number.isInteger(body[key]) || body[key]<1 || body[key]>max) throw new Error(`${key} 应为 1–${max} 的整数`);
    const apiKey=body.clearSecret===true ? "" : body.apiKey?.trim() || (body.provider===old.provider ? old.apiKey : "");
    const sender=body.sender?.trim() || "",domain=body.domain?.trim().toLowerCase() || "";
    if(sender) normalizeEmail(sender);
    if(domain && !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(domain)) throw new Error("Mailgun 域名格式不正确");
    const senderName=body.senderName?.trim() || "Shirine";
    if(/[<>"\\,;:]/.test(senderName) || senderName.length>64) throw new Error("发件人名称包含无效字符或超过 64 字符");
    if(body.enabled && (!sender || !apiKey || (body.provider==="mailgun" && !domain))) throw new Error("请先填写有效的发件邮箱、服务商密钥及所需域名");
    const smtpHost=body.smtpHost?.trim().toLowerCase() || "",smtpUser=body.smtpUser?.trim() || "",smtpPort=body.smtpPort ?? 465;
    if(![465,587,994].includes(smtpPort)) throw new Error("SMTP 仅支持 465/994 TLS 或 587 STARTTLS");
    if(smtpHost) validateSmtpHost(smtpHost);
    if(body.enabled && body.provider==="smtp" && (!smtpHost || !smtpUser)) throw new Error("请填写 SMTP 服务器和登录账号");
    const accessKeyId=body.accessKeyId?.trim() || "",cloudRegion=body.cloudRegion?.trim() || (body.provider==="tencent" ? "ap-guangzhou":"cn-hangzhou"),templateId=body.templateId?.trim() || "",templateParams=body.templateParams?.trim() || '{"code":"{{code}}"}';
    if(body.enabled && ["aliyun","tencent","sendcloud"].includes(body.provider) && !accessKeyId) throw new Error("请填写 AccessKey ID、SecretId 或 API_USER");
    if(body.provider==="aliyun" && !["cn-hangzhou","ap-southeast-1","ap-southeast-2","us-east-1","eu-central-1"].includes(cloudRegion)) throw new Error("阿里云邮件地区配置不正确");
    if(body.provider==="tencent") {
      if(!["ap-guangzhou","ap-hongkong"].includes(cloudRegion)) throw new Error("腾讯云 SES 地区应为 ap-guangzhou 或 ap-hongkong");
      if(body.enabled && (!/^[1-9]\d{0,9}$/.test(templateId))) throw new Error("请填写审核通过的腾讯云邮件模板 ID");
      const params=JSON.parse(templateParams);if(!params || typeof params!=="object" || Array.isArray(params) || Object.keys(params).length>10 || Object.values(params).some(v=>typeof v!=="string") || !templateParams.includes("{{code}}")) throw new Error("模板变量应为含 {{code}} 的字符串对象");
    }
    const next:EmailConfig={enabled:body.enabled,provider:body.provider,sender,senderName,apiKey,domain,region:body.region,smtpHost,smtpPort,smtpUser,accessKeyId,cloudRegion,templateId,templateParams,recipientDaily:body.recipientDaily,ipHourly:body.ipHourly,totalDaily:body.totalDaily};
    await writeEmailConfig(c.env,next);return c.json({success:true});
  }catch(err){return c.json({success:false,error:err instanceof Error ? err.message : "邮件设置保存失败"},400);}
});
emailRouter.post("/send",async c=>{
  try{
    const config=await readEmailConfig(c.env);
    if(!config.enabled) throw new SmsError("邮箱验证码未开启",403);
    if(c.env.ENVIRONMENT==="production" && !c.env.ADMIN_PASSWORD && !await c.env.DB.prepare("SELECT id FROM users WHERE role='superadmin' LIMIT 1").first()) throw new SmsError("请先完成站点初始化",403);
    const body=await c.req.json();
    let email:string;try{email=normalizeEmail(body.email);}catch{throw new SmsError("请输入有效邮箱地址");}
    const now=Math.floor(Date.now()/1000),ip=await smsHash(c.env,"ip",c.req.header("CF-Connecting-IP")||"local");
    await claimSmsBudget(c.env,`email-attempt:${ip}:${Math.floor(now/600)}`,30,now+600);
    const verified=await verifyTurnstile(c,body.turnstileToken);if(!verified.success) throw new SmsError(verified.message||"请先完成人机验证");
    if(await c.env.DB.prepare("SELECT id FROM users WHERE lower(email)=? LIMIT 1").bind(email).first()) throw new SmsError("该邮箱已注册，请登录已有账号");
    const hash=await smsHash(c.env,"email",email);
    await claimSmsBudget(c.env,`email-cooldown:${hash}`,1,now+60);
    await claimSmsBudget(c.env,`email-recipient:${hash}:${Math.floor(now/86400)}`,config.recipientDaily,(Math.floor(now/86400)+1)*86400);
    await claimSmsBudget(c.env,`email-ip:${ip}:${Math.floor(now/3600)}`,config.ipHourly,(Math.floor(now/3600)+1)*3600);
    await claimSmsBudget(c.env,`email-total:${Math.floor(now/86400)}`,config.totalDaily,(Math.floor(now/86400)+1)*86400);
    const prior=getCookie(c,"shirine_email")||"",browser=/^[\w-]{43}$/.test(prior)?prior:randomValue(),id=randomValue();
    const random=new Uint32Array(1);do{crypto.getRandomValues(random);}while(random[0]>=4294000000);
    const code=String(random[0]%1000000).padStart(6,"0");
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM sms_rate_limits WHERE expires_at<=?").bind(now),
      c.env.DB.prepare("DELETE FROM email_challenges WHERE expires_at<=? OR recipient_hash=?").bind(now,hash),
      c.env.DB.prepare("INSERT INTO email_challenges (id,recipient_hash,browser_hash,code_hash,expires_at) VALUES (?,?,?,?,?)").bind(id,hash,await digest(browser),await smsHash(c.env,"email-code",`${id}\0${hash}\0${code}`),now+300),
    ]);
    try{await sendEmail(config,email,code);}catch{throw new SmsError("邮件服务商暂未确认发送，请稍后重试或联系站长；本次请求仍计入限额",503);}
    await c.env.DB.prepare("UPDATE email_challenges SET issued=1 WHERE id=?").bind(id).run();
    const secure=c.env.ENVIRONMENT==="production" || new URL(c.req.url).protocol==="https:";
    c.header("Set-Cookie",`shirine_email=${browser}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=600${secure?"; Secure":""}`,{append:true});
    return c.json({success:true,challengeId:id,retryAfter:60,expiresIn:300});
  }catch(err){return c.json({success:false,error:err instanceof SmsError ? err.message : "邮件发送暂时不可用"},err instanceof SmsError ? err.status : 503);}
});
