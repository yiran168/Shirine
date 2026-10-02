import { afterEach, describe, expect, it } from "bun:test";
import { createTestEnv, type TestEnvironment } from "../helpers/test-env";
import { defaultSmsConfig, normalizePhone, providerValues, readSmsConfig, safeSmsEndpoint, smsProviders, validateSmsValues, writeSmsConfig, type SmsProvider } from "../../server/src/core/sms-config";
import { buildSmsRequest, sendSms } from "../../server/src/core/sms-providers";
import { claimSmsBudget } from "../../server/src/core/sms-registration";
import { unseal, writeOAuthConfig } from "../../server/src/core/oauth-config";
import { createHash, createHmac } from "node:crypto";
import { defaultEmailConfig,writeEmailConfig } from "../../server/src/core/email-config";

let env: TestEnvironment;
const originalFetch=globalThis.fetch;
let lastCode="", sends=0;
const phone="13800138000";
afterEach(()=>{ globalThis.fetch=originalFetch; env?.close(); });
async function setup(enabled=true, captcha=false) {
  env=createTestEnv(); sends=0;
  const config=defaultSmsConfig(); config.enabled=enabled; config.provider="yunpian";
  config.providers.yunpian={apiKey:"private-provider-key",message:"【Shirine】验证码 {{code}}，{{minutes}} 分钟有效"};
  await writeSmsConfig(env.env,config);
  if(captcha) env.d1.sqlite.query("INSERT INTO system_configs (key,value) VALUES ('turnstile',?)").run(JSON.stringify({enabled:true,siteKey:"test"}));
  globalThis.fetch=(async(input:any,options:any)=>{
    if(String(input).includes("siteverify")) return Response.json({success:options.body.get("response")==="captcha-valid"});
    const request=input as Request;
    expect(request.url).toBe("https://sms.yunpian.com/v2/sms/single_send.json");
    sends++; lastCode=new URLSearchParams(await request.text()).get("text")!.match(/\d{6}/)![0];
    return Response.json({code:0,sid:123});
  }) as typeof fetch;
}
const post=(path:string,body:any,cookie="",ip="1.2.3.4")=>env.requestJson(path,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie,"CF-Connecting-IP":ip},body:JSON.stringify(body)});
async function send(number=phone,token="",ip="1.2.3.4") {
  const result=await post("/api/auth/sms/send",{phone:number,turnstileToken:token},"",ip);
  return {...result,code:lastCode,cookie:result.headers.get("set-cookie")?.split(";")[0] || ""};
}
function register(flow:Awaited<ReturnType<typeof send>>,overrides:any={}) {
  return post("/api/auth/register",{registrationMethod:"phone",username:"sms_reader",password:"password123",phone,smsCode:flow.code,smsChallengeId:flow.data.challengeId,...overrides},flow.cookie);
}
describe("SMS registration authorization and lifecycle",()=>{
  it("defaults off and leaves password login and ordinary registration compatible",async()=>{
    await setup(false);
    expect((await env.requestJson("/api/auth/sms/config")).data.enabled).toBe(false);
    expect((await send()).status).toBe(403);
    expect((await post("/api/auth/register",{username:"regular",email:"regular@example.com",password:"password123"})).status).toBe(201);
    expect((await post("/api/auth/register",{registrationMethod:"phone",username:"not_allowed",password:"password123",phone})).status).toBe(403);
    expect((await post("/api/auth/login",{username:"regular",password:"password123"})).status).toBe(200);
    expect(sends).toBe(0);
  });
  it("enforces Turnstile before paid SMS and again before registration",async()=>{
    await setup(true,true);
    expect((await send()).status).toBe(400);
    expect((await send(phone,"invalid")).status).toBe(400);
    expect(sends).toBe(0);
    const flow=await send(phone,"captcha-valid"); expect(flow.status).toBe(200);
    expect((await register(flow)).status).toBe(400);
    expect((await register(flow,{turnstileToken:"captcha-valid"})).status).toBe(201);
    expect(sends).toBe(1);
  });
  it("requires OTP even for direct registration API calls and keeps codes and phones encrypted",async()=>{
    await setup();
    expect((await post("/api/auth/register",{registrationMethod:"phone",username:"bypass",password:"password123"})).status).toBe(400);
    const flow=await send(); expect(flow.status).toBe(200);
    expect(flow.headers.get("set-cookie")).toContain("HttpOnly");
    expect(flow.data.code).toBeUndefined();
    const stored=env.d1.sqlite.query("SELECT * FROM sms_challenges").get() as any;
    expect(JSON.stringify(stored)).not.toContain("13800138000");
    expect(stored.code_hash).not.toBe(flow.code);
    expect(await unseal(stored.phone_encrypted,env.env,"sms-phone")).toBe("+8613800138000");
    const created=await register(flow); expect(created.status).toBe(201); expect(created.data.user.role).toBe("user");
    expect(created.data.user.email).toBe("");
    expect((await post("/api/auth/login",{username:phone,password:"password123"})).status).toBe(200);
    expect(created.data.user.phone).toBeUndefined();
    expect((await register(flow,{username:"replay",email:"replay@example.com"})).status).toBe(400);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM user_phones").get() as any).n).toBe(1);
    expect((await send()).status).toBe(400);
  });
  it("rejects a different browser, changed phone and expired codes",async()=>{
    await setup(); const flow=await send();
    expect((await register({...flow,cookie:""})).status).toBe(400);
    expect((await register(flow,{phone:"13900139000"})).status).toBe(400);
    env.d1.sqlite.query("UPDATE sms_challenges SET expires_at=0").run();
    expect((await register(flow)).status).toBe(400);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM users").get() as any).n).toBe(0);
  });
  it("locks verification after five wrong attempts, including concurrent calls",async()=>{
    await setup(); const flow=await send();
    const wrong=flow.code==="000000" ? "111111" : "000000";
    const failures=await Promise.all(Array.from({length:8},()=>register(flow,{smsCode:wrong})));
    expect(failures.every(r=>r.status===400)).toBe(true);
    expect((env.d1.sqlite.query("SELECT attempts FROM sms_challenges").get() as any).attempts).toBe(5);
    expect((await register(flow)).status).toBe(400);
  });
  it("issues at most one account from concurrent redemption",async()=>{
    await setup(); const flow=await send();
    const results=await Promise.all([register(flow),register(flow,{username:"other",email:"other@example.com"})]);
    expect(results.map(r=>r.status).sort()).toEqual([201,400]);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM users").get() as any).n).toBe(1);
  });
  it("rolls back user creation and OTP consumption on database failure",async()=>{
    await setup(); const flow=await send();
    env.d1.sqlite.exec("CREATE TRIGGER fail_phone BEFORE INSERT ON user_phones BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    expect((await register(flow)).status).toBe(500);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM users").get() as any).n).toBe(0);
    expect((env.d1.sqlite.query("SELECT used_at FROM sms_challenges").get() as any).used_at).toBeNull();
    env.d1.sqlite.exec("DROP TRIGGER fail_phone");
    expect((await register(flow)).status).toBe(201);
  });
  it("enforces cooldown atomically and invalidates old codes on resend",async()=>{
    await setup();
    const results=await Promise.all([send(),send(),send()]);
    expect(results.map(r=>r.status).sort()).toEqual([200,429,429]); expect(sends).toBe(1);
    const old=results.find(r=>r.status===200)!;
    env.d1.sqlite.query("UPDATE sms_rate_limits SET expires_at=0 WHERE bucket LIKE 'cooldown:%'").run();
    const fresh=await send(); expect(fresh.status).toBe(200);
    expect((await register(old)).status).toBe(400);
    expect((await register(fresh)).status).toBe(201);
  });
  it("caps phone, IP and total budgets and prevents concurrent overrun",async()=>{
    await setup(); const cfg=await readSmsConfig(env.env); cfg.totalDaily=1; await writeSmsConfig(env.env,cfg);
    expect((await send()).status).toBe(200);
    expect((await send("13900139000","","5.6.7.8")).status).toBe(429); expect(sends).toBe(1);
    const now=Math.floor(Date.now()/1000);
    const attempts=await Promise.allSettled(Array.from({length:10},()=>claimSmsBudget(env.env,"concurrent-budget",3,now+600)));
    expect(attempts.filter(x=>x.status==="fulfilled")).toHaveLength(3);
    cfg.totalDaily=100; cfg.ipHourly=1; await writeSmsConfig(env.env,cfg);
    expect((await send("13700137000")).status).toBe(429);
    cfg.ipHourly=10; cfg.phoneDaily=1; await writeSmsConfig(env.env,cfg);
    env.d1.sqlite.query("UPDATE sms_rate_limits SET expires_at=0 WHERE bucket LIKE 'cooldown:%'").run();
    expect((await send()).status).toBe(429);
  });
  it("does not retry or issue usable codes when vendor confirmation fails",async()=>{
    await setup(); let calls=0;
    globalThis.fetch=(async()=>{ calls++; throw new Error("network timeout secret-payload"); }) as typeof fetch;
    const flow=await send(); expect(flow.status).toBe(503); expect(calls).toBe(1);
    expect(JSON.stringify(flow.data)).not.toContain("secret-payload");
    expect((env.d1.sqlite.query("SELECT issued FROM sms_challenges").get() as any).issued).toBe(0);
    expect((await send()).status).toBe(429); expect(calls).toBe(1);
  });
  it("does not impose SMS on OAuth first registration",async()=>{
    await setup();
    await writeEmailConfig(env.env,{...defaultEmailConfig(),enabled:true,sender:"sender@example.com",apiKey:"unused"});
    await writeOAuthConfig(env.env,{origin:"http://localhost",providers:{github:{enabled:true,clientId:"app",secret:"secret"}}});
    const start=await env.requestJson("/api/auth/oauth/github/start",{method:"POST",headers:{Origin:"http://localhost","Content-Type":"application/json"},body:"{}"});
    const state=new URL(start.data.url).searchParams.get("state");
    globalThis.fetch=(async(input:any)=>String(input).includes("access_token") ? Response.json({access_token:"token"}) : Response.json({id:123,login:"oauth_sms_free"})) as typeof fetch;
    const result=await env.request(`/api/auth/oauth/github/callback?state=${state}&code=test`,{headers:{Cookie:start.headers.get("set-cookie")!.split(";")[0]}});
    expect(result.status).toBe(200);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM users").get() as any).n).toBe(1);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM user_phones").get() as any).n).toBe(0);
  });
  it("protects admin settings, hides secrets, preserves blank edits and validates destinations",async()=>{
    await setup(); const admin=await env.createSuperadmin(); const user=await env.createUser();
    expect((await env.request("/api/auth/sms/settings")).status).toBe(401);
    expect((await env.request("/api/auth/sms/settings",{headers:{Authorization:`Bearer ${user.token}`}})).status).toBe(403);
    const headers={Authorization:`Bearer ${admin.token}`,"Content-Type":"application/json"};
    const settings=(await env.requestJson("/api/auth/sms/settings",{headers})).data;
    expect(settings.providers).toHaveLength(12);
    expect(JSON.stringify(settings)).not.toContain("private-provider-key");
    expect(JSON.stringify(env.d1.sqlite.query("SELECT value FROM system_configs").all())).not.toContain("private-provider-key");
    const save=()=>env.request("/api/auth/sms/settings",{method:"PUT",headers,body:JSON.stringify(settings)});
    expect((await save()).status).toBe(200);
    expect((await readSmsConfig(env.env)).providers.yunpian?.apiKey).toBe("private-provider-key");
    settings.providers.find((p:any)=>p.id==="yunpian").clearSecrets=["apiKey"];
    expect((await save()).status).toBe(400);
    settings.enabled=false; expect((await save()).status).toBe(200);
    expect((await readSmsConfig(env.env)).providers.yunpian?.apiKey).toBe("");
    settings.totalDaily=10001; expect((await save()).status).toBe(400);
    for(const url of ["http://localhost","https://api.infobip.com.evil.test","https://user@api.infobip.com","https://api.infobip.com/path","https://169.254.169.254","https://api.infobip.com:8080"]) expect(()=>safeSmsEndpoint("infobip",url)).toThrow();
    expect(normalizePhone(phone,["86"])).toBe("+8613800138000");
    expect(()=>normalizePhone("+14155552671",["86"])).toThrow();
    expect(()=>normalizePhone("13800138000,13900139000",["86"])).toThrow();
  });
});

const success:Record<SmsProvider,unknown>={aliyun:{Code:"OK"},tencent:{Response:{SendStatusSet:[{Code:"Ok"}]}},huawei:{code:"000000",result:[{status:"000000"}]},volcengine:{Result:{MessageID:["123"]}},yunpian:{code:0},submail:{status:"success"},twilio:{sid:"SM"+"a".repeat(32),status:"queued",error_code:null},vonage:{messages:[{status:"0"}]},plivo:{message_uuid:["uuid"]},infobip:{messages:[{status:{groupId:1}}]},messagebird:{id:"id",recipients:{totalCount:1,totalSentCount:1,totalDeliveredCount:0}},aws:"<PublishResponse><MessageId>123-abcd</MessageId></PublishResponse>"};
const endpoints:Record<SmsProvider,string>={aliyun:"dysmsapi.aliyuncs.com",tencent:"sms.tencentcloudapi.com",huawei:"smsapi.cn-north-4.myhuaweicloud.com",volcengine:"sms.volcengineapi.com",yunpian:"sms.yunpian.com",submail:"api-v4.mysubmail.com",twilio:"api.twilio.com",vonage:"rest.nexmo.com",plivo:"api.plivo.com",infobip:"test.api.infobip.com",messagebird:"rest.messagebird.com",aws:"sns.us-east-1.amazonaws.com"};
describe("SMS provider request and error contracts",()=>{
  for(const provider of smsProviders) it(`${provider.id}: builds one recipient, accepts documented success and rejects vendor errors`,async()=>{
    const config=defaultSmsConfig(); config.provider=provider.id;
    config.providers[provider.id]=Object.fromEntries(provider.fields.map(f=>[f.key,f.default || (f.key==="endpoint" ? `https://${endpoints[provider.id]}` : f.key==="appId" && provider.id==="twilio" ? "AC"+"a".repeat(32) : "test-value")]));
    if(provider.id==="plivo") config.providers.plivo!.appId="TESTAUTHID";
    const values=providerValues(config); validateSmsValues(provider.id,values,true);
    const req=await buildSmsRequest(provider.id,values,"+8613800138000","123456",new Date("2026-10-02T00:00:00Z"));
    expect(new URL(req.url).hostname).toBe(endpoints[provider.id]); expect(req.method).toBe("POST"); expect(req.redirect).toBe("error");
    const data=decodeURIComponent(await req.clone().text())+decodeURIComponent(req.url);
    expect(data).toContain("123456"); expect(data).toContain("13800138000"); expect(data).not.toContain("{{code}}");
    if(["aliyun","tencent","volcengine","aws"].includes(provider.id)) expect(req.headers.get("authorization")).toContain("Signature=");
    globalThis.fetch=(async()=>provider.id==="aws" ? new Response(success.aws as string) : Response.json(success[provider.id])) as typeof fetch;
    await sendSms(provider.id,values,"+8613800138000","123456");
    globalThis.fetch=(async()=>Response.json({error:"failure"})) as typeof fetch;
    await expect(sendSms(provider.id,values,"+8613800138000","123456")).rejects.toThrow();
    globalThis.fetch=(async()=>new Response("provider-secret-error",{status:403})) as typeof fetch;
    await expect(sendSms(provider.id,values,"+8613800138000","123456")).rejects.toThrow("未接受请求");
  });
  it("matches independent AWS SigV4 calculation including temporary credentials",async()=>{
    const values={accessKeyId:"AKIDEXAMPLE",accessKeySecret:"secret",sessionToken:"temporary",region:"us-east-1",message:"Code {{code}}"};
    const request=await buildSmsRequest("aws",values,"+14155552671","123456",new Date("2026-10-02T00:00:00Z"));
    const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
    const mac=(key:any,value:string)=>createHmac("sha256",key).update(value).digest();
    const names=["content-type","host","x-amz-content-sha256","x-amz-date","x-amz-security-token"];
    const canonical=["POST","/","",names.map(n=>`${n}:${request.headers.get(n)}\n`).join(""),names.join(";"),hash(await request.text())].join("\n");
    const signingKey=mac(mac(mac(mac("AWS4secret","20261002"),"us-east-1"),"sns"),"aws4_request");
    const signature=mac(signingKey,`AWS4-HMAC-SHA256\n20261002T000000Z\n20261002/us-east-1/sns/aws4_request\n${hash(canonical)}`).toString("hex");
    expect(request.headers.get("authorization")).toEndWith(`Signature=${signature}`);
    expect(request.headers.get("x-amz-security-token")).toBe("temporary");
  });
});
