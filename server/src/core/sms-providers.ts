import { safeSmsEndpoint, type SmsProvider, type SmsValues } from "./sms-config";

const enc = new TextEncoder();
export const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("");
export async function sha256(value: string): Promise<string> { return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }
export async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, enc.encode(value)));
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const escape = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const query = (values: Record<string, string>) => Object.keys(values).sort().map(k => `${escape(k)}=${escape(values[k])}`).join("&");
const canonicalHeaders = (headers: Record<string, string>) => Object.keys(headers).sort().map(k => `${k}:${headers[k].trim()}\n`).join("");
const substitute = (text: string, code: string) => text.replaceAll("{{code}}", code).replaceAll("{{minutes}}", "5");

export async function buildSmsRequest(id: SmsProvider, v: SmsValues, phone: string, code: string, now = new Date()): Promise<Request> {
  const text = substitute(v.message || "", code);
  const params = v.params ? JSON.parse(substitute(v.params, code)) : {};
  const domestic = phone.replace(/^\+86/, "");
  let url = "", body = "";
  let headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const basic = (key: string, secret: string) => `Basic ${btoa(`${key}:${secret}`)}`;
  if (id === "aliyun") {
    url = `https://dysmsapi.aliyuncs.com/?${query({ PhoneNumbers: domestic, SignName: v.sign, TemplateCode: v.template, TemplateParam: JSON.stringify(params) })}`;
    const signed = { host: "dysmsapi.aliyuncs.com", "x-acs-action": "SendSms", "x-acs-version": "2017-05-25", "x-acs-date": now.toISOString().replace(/\.\d{3}Z$/, "Z"), "x-acs-signature-nonce": crypto.randomUUID(), "x-acs-content-sha256": await sha256("") };
    const names = Object.keys(signed).sort().join(";");
    const canonical = ["POST", "/", new URL(url).search.slice(1), canonicalHeaders(signed), names, signed["x-acs-content-sha256"]].join("\n");
    headers = { ...headers, ...signed, authorization: `ACS3-HMAC-SHA256 Credential=${v.accessKeyId},SignedHeaders=${names},Signature=${hex(await hmac(v.accessKeySecret, `ACS3-HMAC-SHA256\n${await sha256(canonical)}`))}` };
  } else if (id === "tencent") {
    url = "https://sms.tencentcloudapi.com/";
    body = JSON.stringify({ PhoneNumberSet: [phone], SmsSdkAppId: v.appId, SignName: v.sign, TemplateId: v.template, TemplateParamSet: params });
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const date = now.toISOString().slice(0, 10);
    const scope = `${date}/sms/tc3_request`;
    const signed = { "content-type": "application/json; charset=utf-8", host: "sms.tencentcloudapi.com", "x-tc-action": "sendsms" };
    const names = Object.keys(signed).sort().join(";");
    const canonical = ["POST", "/", "", canonicalHeaders(signed), names, await sha256(body)].join("\n");
    const key = await hmac(await hmac(await hmac(`TC3${v.accessKeySecret}`, date), "sms"), "tc3_request");
    const signature = hex(await hmac(key, `TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${await sha256(canonical)}`));
    headers = { ...headers, ...signed, "x-tc-action": "SendSms", "x-tc-version": "2021-01-11", "x-tc-region": v.region, "x-tc-timestamp": timestamp, authorization: `TC3-HMAC-SHA256 Credential=${v.accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}` };
  } else if (id === "huawei") {
    url = `${safeSmsEndpoint("huawei", v.endpoint)}/sms/batchSendSms/v1`;
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const created = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const passwordDigest = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(nonce + created + v.secret))));
    headers = { ...headers, "content-type": "application/x-www-form-urlencoded", authorization: 'WSSE realm="SDP",profile="UsernameToken",type="Appkey"', "x-wsse": `UsernameToken Username="${v.appId}",PasswordDigest="${passwordDigest}",Nonce="${nonce}",Created="${created}"` };
    body = new URLSearchParams({ from: v.sender, to: phone, templateId: v.template, templateParas: JSON.stringify(params), signature: v.sign }).toString();
  } else if (id === "volcengine" || id === "aws") {
    const aws = id === "aws";
    const service = aws ? "sns" : "volcSMS";
    const algorithm = aws ? "AWS4-HMAC-SHA256" : "HMAC-SHA256";
    const terminator = aws ? "aws4_request" : "request";
    const date = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const day = date.slice(0, 8);
    url = aws ? `https://sns.${v.region}.amazonaws.com${v.region.startsWith("cn-") ? ".cn" : ""}/` : "https://sms.volcengineapi.com/?Action=SendSms&Version=2020-01-01";
    if (aws) {
      const fields: Record<string, string> = { Action: "Publish", Version: "2010-03-31", PhoneNumber: phone, Message: text, "MessageAttributes.entry.1.Name": "AWS.SNS.SMS.SMSType", "MessageAttributes.entry.1.Value.DataType": "String", "MessageAttributes.entry.1.Value.StringValue": "Transactional" };
      if (v.sender) Object.assign(fields, { "MessageAttributes.entry.2.Name": "AWS.SNS.SMS.SenderID", "MessageAttributes.entry.2.Value.DataType": "String", "MessageAttributes.entry.2.Value.StringValue": v.sender });
      body = new URLSearchParams(fields).toString();
    } else body = JSON.stringify({ SmsAccount: v.appId, Sign: v.sign, TemplateID: v.template, TemplateParam: JSON.stringify(params), PhoneNumbers: phone });
    const payload = await sha256(body);
    const signed: Record<string, string> = { "content-type": aws ? "application/x-www-form-urlencoded; charset=utf-8" : "application/json", host: new URL(url).host, [aws ? "x-amz-date" : "x-date"]: date, [aws ? "x-amz-content-sha256" : "x-content-sha256"]: payload };
    if (aws && v.sessionToken) signed["x-amz-security-token"] = v.sessionToken;
    const names = Object.keys(signed).sort().join(";");
    const canonical = ["POST", "/", new URL(url).search.slice(1), canonicalHeaders(signed), names, payload].join("\n");
    const scope = `${day}/${v.region}/${service}/${terminator}`;
    const key = await hmac(await hmac(await hmac(await hmac(`${aws ? "AWS4" : ""}${v.accessKeySecret}`, day), v.region), service), terminator);
    const signature = hex(await hmac(key, `${algorithm}\n${date}\n${scope}\n${await sha256(canonical)}`));
    headers = { ...headers, ...signed, authorization: `${algorithm} Credential=${v.accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}` };
  } else if (id === "yunpian") {
    url = "https://sms.yunpian.com/v2/sms/single_send.json";
    headers["content-type"] = "application/x-www-form-urlencoded; charset=utf-8";
    body = new URLSearchParams({ apikey: v.apiKey, mobile: phone.startsWith("+86") ? domestic : phone, text }).toString();
  } else if (id === "submail") {
    url = "https://api-v4.mysubmail.com/sms/xsend.json";
    body = JSON.stringify({ appid: v.appId, signature: v.secret, project: v.template, to: domestic, vars: JSON.stringify(params) });
  } else if (id === "twilio") {
    url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.appId)}/Messages.json`;
    headers = { ...headers, "content-type": "application/x-www-form-urlencoded", authorization: basic(v.appId, v.secret) };
    body = new URLSearchParams({ To: phone, Body: text, [v.sender.startsWith("MG") ? "MessagingServiceSid" : "From"]: v.sender }).toString();
  } else if (id === "vonage") {
    url = "https://rest.nexmo.com/sms/json";
    headers.authorization = basic(v.appId, v.secret);
    body = JSON.stringify({ from: v.sender, to: phone.slice(1), text, type: "unicode" });
  } else if (id === "plivo") {
    url = `https://api.plivo.com/v1/Account/${encodeURIComponent(v.appId)}/Message/`;
    headers.authorization = basic(v.appId, v.secret);
    body = JSON.stringify({ src: v.sender, dst: phone.slice(1), text, type: "sms" });
  } else if (id === "infobip") {
    url = `${safeSmsEndpoint("infobip", v.endpoint)}/sms/2/text/advanced`;
    headers.authorization = `App ${v.apiKey}`;
    body = JSON.stringify({ messages: [{ from: v.sender, destinations: [{ to: phone.slice(1) }], text }] });
  } else if (id === "messagebird") {
    url = "https://rest.messagebird.com/messages";
    headers = { ...headers, "content-type": "application/x-www-form-urlencoded", authorization: `AccessKey ${v.apiKey}` };
    body = new URLSearchParams({ recipients: phone.slice(1), originator: v.sender, body: text, datacoding: "unicode" }).toString();
  }
  return new Request(url, { method: "POST", headers, body, redirect: "error" });
}

export async function sendSms(id: SmsProvider, values: SmsValues, phone: string, code: string): Promise<void> {
  const request = await buildSmsRequest(id, values, phone, code);
  const response = await fetch(request, { signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok) throw new Error("短信服务商未接受请求，请检查配置或稍后重试");
  const text = await response.text();
  if (text.length > 256 * 1024) throw new Error("短信服务商响应异常");
  if (id === "aws") {
    if (!/<MessageId>[a-z\d-]+<\/MessageId>/i.test(text) || /<Error>/.test(text)) throw new Error("短信发送未被确认");
    return;
  }
  const data = JSON.parse(text);
  const ok = id === "aliyun" ? data.Code === "OK"
    : id === "tencent" ? !data.Response?.Error && data.Response?.SendStatusSet?.length === 1 && data.Response.SendStatusSet[0].Code === "Ok"
    : id === "huawei" ? data.code === "000000" && data.result?.length === 1 && data.result[0].status === "000000"
    : id === "volcengine" ? !data.ResponseMetadata?.Error && data.Result?.MessageID?.length === 1
    : id === "yunpian" ? data.code === 0
    : id === "submail" ? data.status === "success"
    : id === "twilio" ? typeof data.sid === "string" && /^SM[a-f\d]+$/i.test(data.sid) && !data.error_code && ["accepted", "queued", "sending", "sent", "delivered"].includes(data.status)
    : id === "vonage" ? data.messages?.length === 1 && data.messages[0].status === "0"
    : id === "plivo" ? Array.isArray(data.message_uuid) && data.message_uuid.length === 1 && !data.error
    : id === "infobip" ? data.messages?.length === 1 && [1, 3].includes(data.messages[0].status?.groupId)
    : id === "messagebird" ? !!data.id && !data.errors && data.recipients?.totalCount === 1 && data.recipients?.totalSentCount + data.recipients?.totalDeliveredCount > 0
    : false;
  if (!ok) throw new Error("短信服务商未确认发送，请检查签名、模板、发送权限和额度");
}
