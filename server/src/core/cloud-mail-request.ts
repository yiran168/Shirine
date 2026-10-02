import { sha256, hmac, hex } from "./sms-providers";
import type { EmailConfig } from "./email-config";
const escape=(value:string)=>encodeURIComponent(value).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const canonicalHeaders=(headers:Record<string,string>)=>Object.keys(headers).sort().map(k=>`${k}:${headers[k].trim()}\n`).join("");
export async function directMailSignature(params:Record<string,string>,secret:string):Promise<string> {
  const query=Object.keys(params).sort().map(k=>`${escape(k)}=${escape(params[k])}`).join("&");
  const bytes=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",bytes.encode(`${secret}&`),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC",key,bytes.encode(`POST&%2F&${escape(query)}`)))));
}
export async function cloudMailRequest(config:EmailConfig,to:string,code:string,now=new Date()):Promise<Request> {
  if(config.provider==="aliyun") {
    const region=config.cloudRegion || "cn-hangzhou";
    const host=region==="cn-hangzhou" ? "dm.aliyuncs.com" : `dm.${region}.aliyuncs.com`;
    const params:Record<string,string>={Action:"SingleSendMail",Version:"2015-11-23",Format:"JSON",RegionId:region,AccessKeyId:config.accessKeyId!,SignatureMethod:"HMAC-SHA1",SignatureVersion:"1.0",SignatureNonce:crypto.randomUUID(),Timestamp:now.toISOString().replace(/\.\d{3}Z$/,"Z"),AccountName:config.sender,AddressType:"1",ReplyToAddress:"false",ToAddress:to,Subject:"Shirine 注册验证码",TextBody:`你的 Shirine 注册验证码是 ${code}，5 分钟内有效。如非本人操作，请忽略。`,FromAlias:config.senderName};
    const signature=await directMailSignature(params,config.apiKey);
    return new Request(`https://${host}/`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...params,Signature:signature}),redirect:"error"});
  }
  const templateParams=(config.templateParams || '{"code":"{{code}}"}').replaceAll("{{code}}",code).replaceAll("{{minutes}}","5");
  const body=JSON.stringify({FromEmailAddress:`${config.senderName} <${config.sender}>`,Destination:[to],Subject:"Shirine 注册验证码",Template:{TemplateID:Number(config.templateId),TemplateData:templateParams},TriggerType:1});
  const date=now.toISOString().slice(0,10),timestamp=String(Math.floor(now.getTime()/1000)),scope=`${date}/ses/tc3_request`;
  const signed={"content-type":"application/json; charset=utf-8",host:"ses.tencentcloudapi.com","x-tc-action":"sendemail"};
  const names=Object.keys(signed).sort().join(";"),canonical=["POST","/","",canonicalHeaders(signed),names,await sha256(body)].join("\n");
  const key=await hmac(await hmac(await hmac(`TC3${config.apiKey}`,date),"ses"),"tc3_request");
  const signature=hex(await hmac(key,`TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${await sha256(canonical)}`));
  return new Request("https://ses.tencentcloudapi.com/",{method:"POST",headers:{...signed,"x-tc-action":"SendEmail","x-tc-version":"2020-10-02","x-tc-region":config.cloudRegion || "ap-guangzhou","x-tc-timestamp":timestamp,authorization:`TC3-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}`},body,redirect:"error"});
}
