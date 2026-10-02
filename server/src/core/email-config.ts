import type { Env } from "../types";
import { seal, unseal } from "./oauth-config";
export const emailProviders = [
  { id:"aliyun",name:"阿里云邮件推送",docs:"https://help.aliyun.com/zh/direct-mail/developer-reference/api-dm-2015-11-23-singlesendmail" },
  { id:"tencent",name:"腾讯云 SES",docs:"https://cloud.tencent.com/document/api/1288/51034" },
  { id:"sendcloud",name:"SendCloud",docs:"https://www.sendcloud.net/doc/email_v2/send_email/" },
  { id:"resend",name:"Resend",docs:"https://resend.com/docs/api-reference/emails/send-email" },
  { id:"sendgrid",name:"SendGrid",docs:"https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send" },
  { id:"mailgun",name:"Mailgun",docs:"https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages" },
  { id:"postmark",name:"Postmark",docs:"https://postmarkapp.com/developer/api/email-api" },
  { id:"brevo",name:"Brevo",docs:"https://developers.brevo.com/reference/send-transac-email" },
  { id:"smtp2go",name:"SMTP2GO",docs:"https://developers.smtp2go.com/docs/send-an-email" },
  { id:"smtp",name:"普通 SMTP（TLS / STARTTLS）",docs:"https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/" },
] as const;
export type EmailProvider=typeof emailProviders[number]["id"];
export interface EmailConfig { enabled:boolean; provider:EmailProvider; sender:string; senderName:string; apiKey:string; domain:string; region:"us"|"eu"; accessKeyId?:string; cloudRegion?:string; templateId?:string; templateParams?:string; smtpHost?:string; smtpPort?:465|587|994; smtpUser?:string; recipientDaily:number; ipHourly:number; totalDaily:number }
export const defaultEmailConfig=():EmailConfig=>({enabled:false,provider:"resend",sender:"",senderName:"Shirine",apiKey:"",domain:"",region:"us",smtpHost:"",smtpPort:465,smtpUser:"",recipientDaily:5,ipHourly:10,totalDaily:100});
const key="registration_email_v1";
export async function readEmailConfig(env:Env):Promise<EmailConfig> {
  const row=await env.DB.prepare("SELECT value FROM system_configs WHERE key=?").bind(key).first<{value:string}>();
  return row ? JSON.parse(await unseal(row.value,env,key)) : defaultEmailConfig();
}
export async function writeEmailConfig(env:Env,value:EmailConfig) {
  await env.DB.prepare("INSERT INTO system_configs (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=unixepoch()")
    .bind(key,await seal(JSON.stringify(value),env,key)).run();
}
export function normalizeEmail(input:unknown):string {
  if(typeof input!=="string") throw new Error("请输入有效邮箱地址");
  const value=input.trim().toLowerCase();
  // A single mailbox only: no header delimiters, display names, lists or quoted addresses.
  if(value.length>254 || !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(value) || value.split("@")[0].length>64 || value.startsWith(".") || value.includes("..") || value.includes(".@")) throw new Error("请输入有效邮箱地址");
  return value;
}
