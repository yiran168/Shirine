import { getApiBase } from "./api";
export interface SmsField { key: string; label: string; secret?: boolean; default?: string; optional?: boolean; multiline?: boolean }
export interface SmsProviderSetting { id: string; name: string; docs: string; domesticOnly?: boolean; fields: SmsField[]; values: Record<string,string>; savedSecrets: string[]; clearSecrets?: string[] }
export interface SmsSettings { enabled: boolean; provider: string; countries: string[]; phoneDaily: number; ipHourly: number; totalDaily: number; providers: SmsProviderSetting[] }
async function call(path: string, options: RequestInit = {}) {
  const headers=new Headers(options.headers);
  if(options.body) headers.set("Content-Type","application/json");
  try { const token=localStorage.getItem("shirine_token"); if(token) headers.set("Authorization",`Bearer ${token}`); } catch {}
  const response=await fetch(`${getApiBase()}/auth/sms${path}`,{...options,headers,credentials:"include",cache:"no-store",signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok || !result.success) throw new Error(result.error || "短信服务暂时不可用");
  return result;
}
export const smsApi={
  config:():Promise<{enabled:boolean;countries:string[]}>=>call("/config"),
  settings:():Promise<SmsSettings>=>call("/settings"),
  save:(settings:SmsSettings)=>call("/settings",{method:"PUT",body:JSON.stringify(settings)}),
  send:(phone:string,turnstileToken:string):Promise<{challengeId:string;maskedPhone:string;retryAfter:number;expiresIn:number}>=>call("/send",{method:"POST",body:JSON.stringify({phone,turnstileToken})}),
};
