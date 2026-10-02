import { getApiBase } from "./api";
export interface EmailSettings { enabled:boolean;provider:string;sender:string;senderName:string;apiKey:string;hasSecret:boolean;clearSecret?:boolean;domain:string;region:"us"|"eu";accessKeyId?:string;cloudRegion?:string;templateId?:string;templateParams?:string;smtpHost?:string;smtpPort?:number;smtpUser?:string;recipientDaily:number;ipHourly:number;totalDaily:number;providers:{id:string;name:string;docs:string}[] }
async function call(path:string,options:RequestInit={}) {
  const headers=new Headers(options.headers);if(options.body) headers.set("Content-Type","application/json");
  try{const token=localStorage.getItem("shirine_token");if(token)headers.set("Authorization",`Bearer ${token}`);}catch{}
  const response=await fetch(`${getApiBase()}/auth/email${path}`,{...options,headers,credentials:"include",cache:"no-store",signal:AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok || !result.success)throw new Error(result.error||"邮件服务暂不可用");return result;
}
export const emailApi={config:():Promise<{enabled:boolean}>=>call("/config"),settings:():Promise<EmailSettings>=>call("/settings"),save:(settings:EmailSettings)=>call("/settings",{method:"PUT",body:JSON.stringify(settings)}),send:(email:string,turnstileToken:string):Promise<{challengeId:string;retryAfter:number}>=>call("/send",{method:"POST",body:JSON.stringify({email,turnstileToken})})};
