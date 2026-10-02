import type { EmailConfig } from "./email-config";
import { sendSmtp } from "./smtp";
import { cloudMailRequest } from "./cloud-mail-request";

export async function buildEmailRequest(config:EmailConfig,to:string,code:string):Promise<Request> {
  if(config.provider==="aliyun" || config.provider==="tencent") return cloudMailRequest(config,to,code);
  const subject="Shirine 注册验证码";
  const text=`你的 Shirine 注册验证码是 ${code}，5 分钟内有效。请勿将验证码告知他人。如非本人操作，请忽略此邮件。`;
  const from=`${config.senderName} <${config.sender}>`;
  const headers:Record<string,string>={"content-type":"application/json",accept:"application/json"};
  let url="",body:BodyInit="";
  switch(config.provider) {
    case "sendcloud": url="https://api.sendcloud.net/apiv2/mail/send"; headers["content-type"]="application/x-www-form-urlencoded"; body=new URLSearchParams({apiUser:config.accessKeyId || "",apiKey:config.apiKey,from:config.sender,fromName:config.senderName,to,subject,plain:text}); break;
    case "resend": url="https://api.resend.com/emails"; headers.authorization=`Bearer ${config.apiKey}`; body=JSON.stringify({from,to:[to],subject,text}); break;
    case "sendgrid": url="https://api.sendgrid.com/v3/mail/send"; headers.authorization=`Bearer ${config.apiKey}`; body=JSON.stringify({personalizations:[{to:[{email:to}]}],from:{email:config.sender,name:config.senderName},subject,content:[{type:"text/plain",value:text}]}); break;
    case "mailgun": {
      url=`https://api${config.region==="eu"?".eu":""}.mailgun.net/v3/${encodeURIComponent(config.domain)}/messages`;
      headers.authorization=`Basic ${btoa(`api:${config.apiKey}`)}`;
      delete headers["content-type"];
      const form=new FormData(); for(const [key,value] of Object.entries({from,to,subject,text})) form.append(key,value); body=form; break;
    }
    case "postmark": url="https://api.postmarkapp.com/email"; headers["X-Postmark-Server-Token"]=config.apiKey; body=JSON.stringify({From:from,To:to,Subject:subject,TextBody:text,MessageStream:"outbound"}); break;
    case "brevo": url="https://api.brevo.com/v3/smtp/email"; headers["api-key"]=config.apiKey; body=JSON.stringify({sender:{email:config.sender,name:config.senderName},to:[{email:to}],subject,textContent:text}); break;
    case "smtp2go": url="https://api.smtp2go.com/v3/email/send"; headers["X-Smtp2go-Api-Key"]=config.apiKey; body=JSON.stringify({sender:from,to:[to],subject,text_body:text}); break;
  }
  return new Request(url,{method:"POST",headers,body,redirect:"error"});
}
export async function sendEmail(config:EmailConfig,to:string,code:string):Promise<void> {
  if(config.provider==="smtp") return sendSmtp(config,to,code);
  const response=await fetch(await buildEmailRequest(config,to,code),{signal:AbortSignal.timeout(10000),redirect:"error"});
  if(!response.ok) throw new Error("邮件服务商未接受请求");
  if(config.provider==="sendgrid") { if(response.status!==202) throw new Error("邮件未被确认"); return; }
  const text=await response.text(); if(text.length>256*1024) throw new Error("邮件响应异常");
  const data=JSON.parse(text);
  const ok=config.provider==="aliyun" ? typeof data.EnvId==="string" && !data.Code
    : config.provider==="tencent" ? typeof data.Response?.MessageId==="string" && !data.Response?.Error
    : config.provider==="sendcloud" ? data.result===true && data.statusCode===200
    : config.provider==="resend" ? typeof data.id==="string" && !data.error
    : config.provider==="mailgun" ? typeof data.id==="string" && typeof data.message==="string"
    : config.provider==="postmark" ? data.ErrorCode===0 && typeof data.MessageID==="string"
    : config.provider==="brevo" ? typeof data.messageId==="string"
    : config.provider==="smtp2go" ? data.data?.succeeded===1 && !data.data?.failed && !data.data?.error : false;
  if(!ok) throw new Error("邮件服务商未确认发送");
}
