import type { Env } from "../types";
import { seal, unseal } from "./oauth-config";

export interface SmsField { key: string; label: string; secret?: boolean; default?: string; optional?: boolean; multiline?: boolean }
const f = (key: string, label: string, extras: Partial<SmsField> = {}): SmsField => ({ key, label, ...extras });
const namedParams = f("params", "模板变量 JSON（{{code}} 为验证码，{{minutes}} 为有效分钟数）", { default: '{"code":"{{code}}"}', multiline: true });
const orderedParams = f("params", "模板变量数组（按审核模板的变量顺序填写）", { default: '["{{code}}"]', multiline: true });
const message = f("message", "短信正文（必须含 {{code}}）", { default: "【Shirine】你的注册验证码是 {{code}}，{{minutes}} 分钟内有效，请勿泄露。", multiline: true });
export const smsProviders = [
  { id: "aliyun", name: "阿里云短信", domesticOnly: true, docs: "https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms", fields: [f("accessKeyId", "AccessKey ID"), f("accessKeySecret", "AccessKey Secret", { secret: true }), f("sign", "已审核签名名称"), f("template", "TemplateCode"), namedParams] },
  { id: "tencent", name: "腾讯云短信", docs: "https://cloud.tencent.com/document/api/382/55981", fields: [f("accessKeyId", "SecretId"), f("accessKeySecret", "SecretKey", { secret: true }), f("appId", "SmsSdkAppId"), f("sign", "已审核签名名称"), f("template", "TemplateId"), f("region", "Region", { default: "ap-guangzhou" }), orderedParams] },
  { id: "huawei", name: "华为云短信", docs: "https://support.huaweicloud.com/devg-msgsms/sms_04_0002.html", fields: [f("appId", "APP Key"), f("secret", "APP Secret", { secret: true }), f("endpoint", "应用接入地址（华为云控制台提供的 HTTPS 地址）"), f("sender", "发送通道号（sender）"), f("sign", "已审核签名名称"), f("template", "templateId"), orderedParams] },
  { id: "volcengine", name: "火山引擎短信", docs: "https://www.volcengine.com/docs/6361/67380", fields: [f("accessKeyId", "Access Key ID"), f("accessKeySecret", "Secret Access Key", { secret: true }), f("appId", "消息组 ID（SmsAccount）"), f("sign", "已审核签名名称"), f("template", "TemplateID"), f("region", "Region", { default: "cn-north-1" }), namedParams] },
  { id: "yunpian", name: "云片短信", docs: "https://www.yunpian.com/official/document/sms/en/domestic_list", fields: [f("apiKey", "APIKEY", { secret: true }), message] },
  { id: "submail", name: "赛邮 SUBMAIL", domesticOnly: true, docs: "https://en.mysubmail.com/documents/tXdKH1", fields: [f("appId", "短信 AppID"), f("secret", "短信 AppKey", { secret: true }), f("template", "短信模板 ID（project）"), namedParams] },
  { id: "twilio", name: "Twilio", docs: "https://www.twilio.com/docs/messaging/api/message-resource", fields: [f("appId", "Account SID"), f("secret", "Auth Token", { secret: true }), f("sender", "发送号码（E.164）或 Messaging Service SID（MG 开头）"), message] },
  { id: "vonage", name: "Vonage", docs: "https://developer.vonage.com/en/api/sms", fields: [f("appId", "API Key"), f("secret", "API Secret", { secret: true }), f("sender", "Sender ID / 发送号码"), message] },
  { id: "plivo", name: "Plivo", docs: "https://www.plivo.com/docs/messaging/api/message", fields: [f("appId", "Auth ID"), f("secret", "Auth Token", { secret: true }), f("sender", "src（发送号码 / Sender ID）"), message] },
  { id: "infobip", name: "Infobip", docs: "https://www.infobip.com/docs/api/channels/sms/outbound-sms/send-sms-message", fields: [f("apiKey", "API Key", { secret: true }), f("endpoint", "账户 API Base URL（https://xxx.api.infobip.com）"), f("sender", "Sender ID / 发送号码"), message] },
  { id: "messagebird", name: "MessageBird（经典 SMS API）", docs: "https://developers.messagebird.com/api/sms-messaging/", fields: [f("apiKey", "Live API Access Key", { secret: true }), f("sender", "originator（发送号码 / Sender ID）"), message] },
  { id: "aws", name: "Amazon SNS", docs: "https://docs.aws.amazon.com/sns/latest/api/API_Publish.html", fields: [f("accessKeyId", "AWS Access Key ID"), f("accessKeySecret", "AWS Secret Access Key", { secret: true }), f("sessionToken", "Session Token（仅临时凭据填写）", { secret: true, optional: true }), f("region", "AWS Region", { default: "us-east-1" }), f("sender", "Sender ID（可选，需目的地支持）", { optional: true }), message] },
] as const;
export type SmsProvider = typeof smsProviders[number]["id"];
export type SmsValues = Record<string, string>;
export interface SmsConfig { enabled: boolean; provider: SmsProvider; countries: string[]; phoneDaily: number; ipHourly: number; totalDaily: number; providers: Partial<Record<SmsProvider, SmsValues>> }
export const defaultSmsConfig = (): SmsConfig => ({ enabled: false, provider: "aliyun", countries: ["86"], phoneDaily: 5, ipHourly: 10, totalDaily: 100, providers: {} });
const key = "registration_sms_v1";
export function isSmsProvider(id: string): id is SmsProvider { return smsProviders.some(p => p.id === id); }
export async function readSmsConfig(env: Env): Promise<SmsConfig> {
  const row = await env.DB.prepare("SELECT value FROM system_configs WHERE key = ?").bind(key).first<{ value: string }>();
  return row ? JSON.parse(await unseal(row.value, env, key)) : defaultSmsConfig();
}
export async function writeSmsConfig(env: Env, value: SmsConfig) {
  await env.DB.prepare("INSERT INTO system_configs (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()")
    .bind(key, await seal(JSON.stringify(value), env, key)).run();
}
export function providerValues(config: SmsConfig): SmsValues {
  const provider = smsProviders.find(p => p.id === config.provider)!;
  return Object.fromEntries(provider.fields.map(field => [field.key, config.providers[provider.id]?.[field.key] || field.default || ""]));
}
export function safeSmsEndpoint(provider: "huawei" | "infobip", input: string): string {
  const u = new URL(input);
  const allowed = provider === "huawei" ? /^smsapi(?:\.[a-z\d-]+)?\.myhuaweicloud\.com$/i : /^(?:[a-z\d-]+\.)?api\.infobip\.com$/i;
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/" || (u.port && u.port !== "443") || !allowed.test(u.hostname)) throw new Error("短信接入地址必须为对应服务商提供的 HTTPS 根地址");
  return u.origin;
}
export function validateSmsValues(id: SmsProvider, values: SmsValues, required: boolean): void {
  const provider = smsProviders.find(p => p.id === id)!;
  for (const field of provider.fields) {
    const value = values[field.key] || field.default || "";
    if (required && !field.optional && !value) throw new Error(`${provider.name} 缺少 ${field.label}`);
    if (value.length > 2048 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error("短信字段过长或含无效字符");
  }
  if (values.endpoint && (id === "huawei" || id === "infobip")) safeSmsEndpoint(id, values.endpoint);
  if (values.region && !(id === "tencent" ? /^[a-z]{2}-[a-z]+(?:-\d+)?$/ : id === "aws" ? /^[a-z]{2}-(?:gov-)?[a-z]+-\d$/ : /^[a-z]{2}-[a-z]+-\d$/).test(values.region)) throw new Error("Region 格式不正确");
  if (id === "twilio" && values.appId && !/^AC[a-f\d]{32}$/i.test(values.appId)) throw new Error("Twilio Account SID 应为 AC 开头的 34 位标识");
  if (id === "plivo" && values.appId && !/^[a-z\d]{5,64}$/i.test(values.appId)) throw new Error("Plivo Auth ID 格式不正确");
  if (values.params) {
    let p: unknown;
    try { p = JSON.parse(values.params); } catch { throw new Error("模板变量必须为有效 JSON"); }
    const ordered = id === "tencent" || id === "huawei";
    if (!p || typeof p !== "object" || Array.isArray(p) !== ordered || Object.keys(p).length > 10 || Object.values(p).some(v => typeof v !== "string") || !values.params.includes("{{code}}")) throw new Error(ordered ? "模板变量应为含 {{code}} 的字符串数组" : "模板变量应为含 {{code}} 的字符串对象");
  }
  if (values.message && (values.message.length > 300 || !values.message.includes("{{code}}"))) throw new Error("短信正文必须包含 {{code}}，且不超过 300 个字符");
}
export function normalizePhone(input: unknown, countries: string[]): string {
  if (typeof input !== "string" || input.length > 32 || !/^\+?[\d -]+$/.test(input)) throw new Error("请输入有效的手机号和国际区号");
  let phone = input.replace(/[ -]/g, "");
  if (/^1[3-9]\d{9}$/.test(phone)) phone = `+86${phone}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !countries.some(country => phone.startsWith(`+${country}`))) throw new Error("该号码无效或不在允许发送的国家/地区范围内");
  if (phone.startsWith("+86") && !/^\+861[3-9]\d{9}$/.test(phone)) throw new Error("中国大陆手机号格式不正确");
  return phone;
}
