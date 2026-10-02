import { afterEach,describe,expect,it } from "bun:test";
import { createTestEnv,type TestEnvironment } from "../helpers/test-env";
import { defaultEmailConfig,emailProviders,normalizeEmail,readEmailConfig,writeEmailConfig,type EmailProvider } from "../../server/src/core/email-config";
import { buildEmailRequest,sendEmail } from "../../server/src/core/email-providers";
import { defaultSmsConfig,writeSmsConfig } from "../../server/src/core/sms-config";
import { directMailSignature } from "../../server/src/core/cloud-mail-request";
import { sendSmtp,validateSmtpHost,type SmtpConnect } from "../../server/src/core/smtp";
let env:TestEnvironment,lastCode="",sends=0;
const realFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=realFetch;env?.close();});
const post=(path:string,body:any,cookie="",ip="1.2.3.4")=>env.requestJson(path,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie,"CF-Connecting-IP":ip},body:JSON.stringify(body)});
async function setup(enabled=true,captcha=false){
  env=createTestEnv();sends=0;
  await writeEmailConfig(env.env,{...defaultEmailConfig(),enabled,sender:"noreply@example.com",apiKey:"email-secret"});
  const sms=defaultSmsConfig();sms.enabled=true;sms.provider="yunpian";sms.providers.yunpian={apiKey:"sms-secret",message:"Code {{code}}"};await writeSmsConfig(env.env,sms);
  if(captcha)env.d1.sqlite.query("INSERT INTO system_configs (key,value) VALUES ('turnstile',?)").run(JSON.stringify({enabled:true,siteKey:"test"}));
  globalThis.fetch=(async(input:any,options:any)=>{
    if(String(input).includes("siteverify"))return Response.json({success:options.body.get("response")==="captcha-valid"});
    const req=input as Request;expect(req.url).toBe("https://api.resend.com/emails");
    lastCode=(await req.json() as any).text.match(/\d{6}/)[0];sends++;return Response.json({id:"accepted-email"});
  }) as typeof fetch;
}
async function send(email="reader@example.com",token="",ip="1.2.3.4"){
  const result=await post("/api/auth/email/send",{email,turnstileToken:token},"",ip);
  return {...result,email,code:lastCode,cookie:result.headers.get("set-cookie")?.split(";")[0]||""};
}
const register=(flow:Awaited<ReturnType<typeof send>>,extra:any={})=>post("/api/auth/register",{username:"email_reader",password:"password123",email:flow.email,emailCode:flow.code,emailChallengeId:flow.data.challengeId,...extra},flow.cookie);
describe("Email-first registration and independent phone option",()=>{
  it("requires a mailbox but no phone when email verification is off, even with phone signup on",async()=>{
    await setup(false);
    expect((await post("/api/auth/register",{username:"missing_email",password:"password123"})).status).toBe(400);
    const result=await post("/api/auth/register",{username:"email_only",email:"Email-Only@example.com",password:"password123"});expect(result.status).toBe(201);expect(result.data.user.email).toBe("email-only@example.com");
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM user_phones").get() as any).n).toBe(0);
    expect((await send()).status).toBe(403);
  });
  it("enforces Turnstile on both send and signup and requires an email code without demanding SMS",async()=>{
    await setup(true,true);
    expect((await send()).status).toBe(400);expect((await send("reader@example.com","invalid")).status).toBe(400);expect(sends).toBe(0);
    const flow=await send("reader@example.com","captcha-valid");expect(flow.status).toBe(200);
    expect((await register(flow)).status).toBe(400);
    expect((await register(flow,{turnstileToken:"captcha-valid",emailCode:""})).status).toBe(400);
    const result=await register(flow,{turnstileToken:"captcha-valid"});expect(result.status).toBe(201);expect(result.data.user.role).toBe("user");expect(sends).toBe(1);
    expect((env.d1.sqlite.query("SELECT count(*) AS n FROM user_phones").get() as any).n).toBe(0);
  });
  it("fails closed on direct bypass, wrong channel and browser mismatch",async()=>{
    await setup();const flow=await send();expect(flow.headers.get("set-cookie")).toContain("HttpOnly");expect(flow.data.code).toBeUndefined();
    expect((await register({...flow,cookie:""})).status).toBe(400);
    expect((await register(flow,{email:"changed@example.com"})).status).toBe(400);
    expect((await register(flow,{registrationMethod:"phone",phone:"13800138000",smsCode:flow.code,smsChallengeId:flow.data.challengeId})).status).toBe(400);
    expect((await register(flow,{registrationMethod:"skip"})).status).toBe(400);
    expect((await register(flow,{emailCode:""})).status).toBe(400);
    expect((await register(flow)).status).toBe(201);
    expect((await register(flow,{username:"replay"})).status).toBe(400);
  });
  it("locks a code after five attempts and rejects expiration",async()=>{
    await setup();const flow=await send(),wrong=flow.code==="000000"?"111111":"000000";
    const results=await Promise.all(Array.from({length:8},()=>register(flow,{emailCode:wrong})));
    expect(results.every(r=>r.status===400)).toBe(true);expect((env.d1.sqlite.query("SELECT attempts FROM email_challenges").get() as any).attempts).toBe(5);
    expect((await register(flow)).status).toBe(400);
    const fresh=await send("fresh@example.com");env.d1.sqlite.query("UPDATE email_challenges SET expires_at=0").run();expect((await register(fresh)).status).toBe(400);
  });
  it("atomically redeems one email code and rolls back failures",async()=>{
    await setup();const flow=await send();
    env.d1.sqlite.exec("CREATE TRIGGER fail_email BEFORE UPDATE OF used_at ON email_challenges BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
    expect((await register(flow)).status).toBe(500);expect((env.d1.sqlite.query("SELECT count(*) AS n FROM users").get() as any).n).toBe(0);
    env.d1.sqlite.exec("DROP TRIGGER fail_email");
    const results=await Promise.all([register(flow),register(flow,{username:"second_reader"})]);expect(results.map(r=>r.status).sort()).toEqual([201,400]);
  });
  it("normalizes recipient quotas, rejects lists/header injection and enforces global cap",async()=>{
    await setup();
    for(const address of ["a@example.com,b@example.com","a@example.com\r\nBcc:x@example.com","Name <a@example.com>","a..b@example.com"]){expect(()=>normalizeEmail(address)).toThrow();expect((await send(address)).status).toBe(400);}
    expect((await send("Reader@Example.com")).status).toBe(200);expect((await send("reader@example.com")).status).toBe(429);expect(sends).toBe(1);
    const config=await readEmailConfig(env.env);config.totalDaily=1;await writeEmailConfig(env.env,config);expect((await send("second@example.com","","8.8.8.8")).status).toBe(429);expect(sends).toBe(1);
  });
  it("invalidates old codes after resending and never retries failed provider sends",async()=>{
    await setup();const first=await send();env.d1.sqlite.query("UPDATE sms_rate_limits SET expires_at=0 WHERE bucket LIKE 'email-cooldown:%'").run();const fresh=await send();
    expect((await register(first)).status).toBe(400);expect((await register(fresh)).status).toBe(201);
    let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error("secret-vendor-error");}) as typeof fetch;
    const failed=await send("failed@example.com");expect(failed.status).toBe(503);expect(JSON.stringify(failed.data)).not.toContain("secret-vendor-error");expect(calls).toBe(1);
  });
  it("protects admin configuration and validates encrypted credentials, SMTP and Chinese vendors",async()=>{
    await setup();const admin=await env.createSuperadmin(),user=await env.createUser();const headers={Authorization:`Bearer ${admin.token}`,"Content-Type":"application/json"};
    expect((await env.request("/api/auth/email/settings")).status).toBe(401);expect((await env.request("/api/auth/email/settings",{headers:{Authorization:`Bearer ${user.token}`}})).status).toBe(403);
    const settings=(await env.requestJson("/api/auth/email/settings",{headers})).data;expect(settings.providers).toHaveLength(10);expect(JSON.stringify(settings)).not.toContain("email-secret");expect(JSON.stringify(env.d1.sqlite.query("SELECT value FROM system_configs").all())).not.toContain("email-secret");
    const save=()=>env.request("/api/auth/email/settings",{method:"PUT",headers,body:JSON.stringify(settings)});
    expect((await save()).status).toBe(200);expect((await readEmailConfig(env.env)).apiKey).toBe("email-secret");
    settings.provider="sendgrid";expect((await save()).status).toBe(400);settings.apiKey="new-key";expect((await save()).status).toBe(200);
    settings.provider="smtp";settings.smtpHost="localhost";settings.smtpUser="a@example.com";expect((await save()).status).toBe(400);
    settings.smtpHost="smtp.qq.com";settings.smtpPort=25;expect((await save()).status).toBe(400);settings.smtpPort=465;expect((await save()).status).toBe(200);
    settings.provider="tencent";settings.accessKeyId="id";settings.cloudRegion="ap-guangzhou";expect((await save()).status).toBe(400);settings.templateId="123";settings.templateParams='{"code":"{{code}}"}';expect((await save()).status).toBe(200);
    settings.clearSecret=true;expect((await save()).status).toBe(400);settings.enabled=false;expect((await save()).status).toBe(200);expect((await readEmailConfig(env.env)).apiKey).toBe("");
  });
});
const responses:Record<Exclude<EmailProvider,"smtp">,unknown>={resend:{id:"id"},sendgrid:null,mailgun:{id:"id",message:"Queued"},postmark:{ErrorCode:0,MessageID:"id"},brevo:{messageId:"id"},smtp2go:{data:{succeeded:1,failed:0}},aliyun:{EnvId:"id",RequestId:"req"},tencent:{Response:{MessageId:"id"}},sendcloud:{result:true,statusCode:200}};
describe("Mail provider protocols",()=>{
  for(const provider of emailProviders.filter(p=>p.id!=="smtp"))it(`${provider.id}: accepts only confirmed single-recipient sends`,async()=>{
    const config={...defaultEmailConfig(),provider:provider.id,sender:"noreply@example.com",apiKey:"test-key",accessKeyId:"test-id",domain:"mail.example.com",templateId:"123",cloudRegion:provider.id==="tencent"?"ap-guangzhou":"cn-hangzhou"};
    const request=await buildEmailRequest(config,"recipient@example.com","123456");expect(request.redirect).toBe("error");expect(request.url).toStartWith("https://");expect(new URL(request.url).search).toBe("");
    const body=decodeURIComponent(await request.clone().text());expect(body).toContain("123456");expect(body).toContain("recipient@example.com");
    if(provider.id==="tencent"){const json=await request.json() as any;expect(json.Template.TemplateID).toBe(123);expect(json.Simple).toBeUndefined();}
    globalThis.fetch=(async()=>provider.id==="sendgrid"?new Response(null,{status:202}):Response.json(responses[provider.id as Exclude<EmailProvider,"smtp">])) as typeof fetch;
    await sendEmail(config,"recipient@example.com","123456");
    globalThis.fetch=(async()=>Response.json({error:"rejected"})) as typeof fetch;await expect(sendEmail(config,"recipient@example.com","123456")).rejects.toThrow();
  });
  it("matches Alibaba Direct Mail's published HMAC-SHA1 signature vector",async()=>{
    const params={AccessKeyId:"testid",AccountName:"<a%b'>",Action:"SingleSendMail",AddressType:"1",Format:"XML",HtmlBody:"4",RegionId:"cn-hangzhou",ReplyToAddress:"true",SignatureMethod:"HMAC-SHA1",SignatureNonce:"c1b2c332-4cfb-4a0f-b8cc-ebe622aa0a5c",SignatureVersion:"1.0",Subject:"3",TagName:"2",Timestamp:"2016-10-20T06:27:56Z",ToAddress:"1@test.com",Version:"2015-11-23"};
    expect(await directMailSignature(params,"testsecret")).toBe("llJfXJjBW3OacrVgxxsITgYaYm0=");
  });
});

function smtpServer(port:465|587|994,options:{noTls?:boolean;rejectRecipient?:boolean;login?:boolean}={}){
  const commands:{secure:boolean;line:string}[]=[];let upgraded=false,closed=0;
  const connect:SmtpConnect=(_address,transport)=>{
    const make=(secure:boolean,greeting:boolean)=>{
      let controller:ReadableStreamDefaultController<Uint8Array>;const enc=new TextEncoder();const enqueue=(text:string)=>controller.enqueue(enc.encode(text+"\r\n"));
      const readable=new ReadableStream<Uint8Array>({start(c){controller=c;if(greeting)enqueue("220 example SMTP");}});
      let loginStep=0;
      return {readable,writable:new WritableStream<Uint8Array>({write(chunk){const line=new TextDecoder().decode(chunk).replace(/\r\n$/,"");commands.push({secure,line});
        if(line.startsWith("EHLO"))enqueue(`250-example\r\n${!secure&&!options.noTls?"250-STARTTLS\r\n":""}250 AUTH ${options.login?"LOGIN":"PLAIN"}`);
        else if(line==="STARTTLS")enqueue("220 Upgrade");
        else if(line==="AUTH LOGIN"){loginStep=1;enqueue("334 VXNlcm5hbWU6");}
        else if(loginStep===1){loginStep=2;enqueue("334 UGFzc3dvcmQ6");}
        else if(loginStep===2){loginStep=0;enqueue("235 Accepted");}
        else if(line.startsWith("AUTH PLAIN"))enqueue("235 Accepted");
        else if(line.startsWith("MAIL FROM"))enqueue("250 Sender");
        else if(line.startsWith("RCPT TO"))enqueue(options.rejectRecipient?"550 Rejected":"250 Recipient");
        else if(line==="DATA")enqueue("354 Send data");
        else if(line.startsWith("From:"))enqueue("250 Queued");
      }}),opened:Promise.resolve(),closed:new Promise(()=>{}),close:async()=>{closed++;},startTls:()=>{upgraded=true;return make(true,false);}};
    };expect(transport.secureTransport).toBe(port===587?"starttls":"on");return make(port!==587,true);
  };
  return {connect,commands,get upgraded(){return upgraded;},get closed(){return closed;}};
}
describe("SMTP transport security",()=>{
  for(const port of [465,587,994] as const)it(`uses encrypted authentication and MIME message on port ${port}`,async()=>{
    const mock=smtpServer(port,{login:port===465});
    await sendSmtp({...defaultEmailConfig(),provider:"smtp",sender:"a@example.com",apiKey:"application-password",smtpUser:"a@example.com",smtpHost:"smtp.qq.com",smtpPort:port},"b@example.com","123456",mock.connect);
    expect(mock.commands.filter(c=>c.line.startsWith("AUTH")).every(c=>c.secure)).toBe(true);expect(mock.upgraded).toBe(port===587);expect(mock.closed).toBeGreaterThan(0);
    const mail=mock.commands.find(c=>c.line.startsWith("From:"))!.line;expect(mail).toContain("Content-Transfer-Encoding: base64");const body=mail.split("\r\n\r\n")[1].replace(/\r\n\.$/,"").replaceAll("\r\n","");expect(Buffer.from(body,"base64").toString()).toContain("123456");
  });
  it("refuses STARTTLS downgrade without ever sending credentials",async()=>{
    const mock=smtpServer(587,{noTls:true});await expect(sendSmtp({...defaultEmailConfig(),sender:"a@example.com",apiKey:"password",smtpUser:"a@example.com",smtpHost:"smtp.qq.com",smtpPort:587},"b@example.com","123456",mock.connect)).rejects.toThrow("STARTTLS");expect(mock.commands.some(c=>c.line.startsWith("AUTH"))).toBe(false);
  });
  it("does not send DATA after recipient rejection and disallows internal hosts",async()=>{
    const mock=smtpServer(465,{rejectRecipient:true});await expect(sendSmtp({...defaultEmailConfig(),sender:"a@example.com",apiKey:"password",smtpUser:"a@example.com",smtpHost:"smtp.qq.com",smtpPort:465},"b@example.com","123456",mock.connect)).rejects.toThrow();expect(mock.commands.some(c=>c.line==="DATA")).toBe(false);
    for(const host of ["localhost","127.0.0.1","169.254.169.254","smtp.internal","smtp.local","https://smtp.qq.com","smtp.qq.com:25","[::1]"])expect(()=>validateSmtpHost(host)).toThrow();
  });
});
