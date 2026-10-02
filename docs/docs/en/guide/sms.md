# SMS verification for registration

Open **Admin → System settings → Phone registration · SMS verification** and use its independent save button. Phone registration is disabled by default. Enabling it adds a separate phone signup choice with mandatory SMS verification and no required email. Default [email signup](./email.md) and OAuth signup do not require SMS. Registered phone numbers can be used with the account password to log in; this feature does not add SMS-only login or password recovery.

## Setup

1. Open an account with one supported vendor. Obtain sending credentials, approved sender/signature and templates, sufficient balance, and permission for the destination countries.
2. Select the vendor below and enter its fields. `{{code}}` becomes the six-digit code; `{{minutes}}` becomes `5`. Template names and parameter order must match the approved template.
3. Set allowed country calling codes (default `86`, comma separated without `+`) and per-phone, per-IP and global limits.
4. Enable SMS and save. Test using a number you control after configuring a real vendor account.

If Turnstile is enabled, both sending the SMS and submitting registration require verification. Sending consumes the first token; the widget resets automatically to obtain a fresh token for registration. Cloudflare decides whether further interaction is required. All password and OAuth login/signup flows retain their server-side Turnstile checks.

## Supported vendors

| Vendor | Fields and prerequisites | Documentation |
| --- | --- | --- |
| Alibaba Cloud | RAM AccessKey ID/Secret, approved SignName, TemplateCode, named parameter JSON. This adapter uses mainland China SendSms. | [SendSms](https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms) |
| Tencent Cloud | SecretId/SecretKey, SmsSdkAppId, approved sign, TemplateId, Region (default ap-guangzhou), ordered parameter array. | [SendSms](https://cloud.tencent.com/document/api/382/55981) |
| Huawei Cloud | APP Key/Secret, app-specific HTTPS root endpoint, sender channel, signature, templateId, ordered parameters. | [SMS API](https://support.huaweicloud.com/devg-msgsms/sms_04_0002.html) |
| Volcengine | Access Key ID/Secret, SmsAccount message group, sign, TemplateID, Region (default cn-north-1), named parameters. | [SendSms](https://www.volcengine.com/docs/6361/67380) |
| Yunpian | APIKEY, complete approved message text including signature. International destinations require corresponding permission. | [SMS API](https://www.yunpian.com/official/document/sms/en/domestic_list) |
| SUBMAIL | SMS AppID/AppKey, project template ID, named parameters. Mainland China `/sms/xsend.json`. | [Template sending](https://en.mysubmail.com/documents/tXdKH1) |
| Twilio | Account SID, Auth Token, SMS-capable sender or MG Messaging Service SID, message. Trial accounts restrict recipients. | [Message resource](https://www.twilio.com/docs/messaging/api/message-resource) |
| Vonage | API key/secret, registered sender ID or number, Unicode message. Classic SMS API. | [SMS API](https://developer.vonage.com/en/api/sms) |
| Plivo | Auth ID/token, authorized src number or sender ID, message. | [Message API](https://www.plivo.com/docs/messaging/api/message) |
| Infobip | SMS-authorized API key, account HTTPS base URL, sender, message. Uses v2 advanced sending. | [Official example](https://www.infobip.com/developers/blog/send-an-sms-message-with-node-js-and-infobip) |
| MessageBird | Classic SMS Live Access Key, originator, message. Bird Channels credentials are different. | [Classic SMS API](https://developers.messagebird.com/api/sms-messaging/) |
| Amazon SNS | Access key ID/secret, region, optional temporary session token and Sender ID, message. IAM Publish permission and SMS sandbox/production setup required. | [Publish](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html) |

Named template example: `{"code":"{{code}}","minutes":"{{minutes}}"}`. Ordered example: `["{{code}}","{{minutes}}"]`. Include only variables used by the approved template. Free-text example: `Your Shirine registration code is {{code}}. It expires in {{minutes}} minutes.`

The integration does not create vendor accounts, purchase credits or obtain approvals. Only one selected vendor is used; there is no automatic paid failover. Vendor acceptance is not a delivery guarantee.

## Limits and storage

Codes expire after five minutes and allow at most five attempts. A resend invalidates the previous code. Codes are bound to the requesting browser and phone and can create only one account. Creation, phone association and code consumption are transactional.

Defaults: 60-second resend cooldown, five requests per phone per day, ten per IP per hour, 100 globally per day. Maximum settings: 20, 100 and 10,000 respectively. Windows use UTC calendar days/hours. Failed or timed-out vendor requests still consume quotas and are not retried automatically. These are request limits, not monetary limits: long messages may be billed as multiple segments. Configure spending limits and destination restrictions with the vendor too.

Secrets and phone numbers are encrypted in D1. OTPs and phone lookup identifiers use keyed hashes; public responses do not disclose these values. Secret fields remain blank after saving; blank edits preserve saved credentials. Keep `JWT_SECRET` stable: changing it requires a migration of encrypted configuration, phone data and lookup hashes.

The deployment schema creates `sms_challenges`, `sms_rate_limits` and `user_phones` without replacing existing accounts. Manual deployments must also apply `server/src/db/schema.sql` before releasing the backend and frontend. See the [detailed Chinese guide](../../zh/guide/sms.md) for troubleshooting.
