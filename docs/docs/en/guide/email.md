# Email registration and SMTP

Email is the default registration method. Under **Admin → System settings → Email registration**, enable or disable email OTP verification independently. A valid email address, username and password remain required when OTP verification is off. Phone registration is a separate, disabled-by-default option: enabling it adds a phone signup choice with mandatory SMS verification and no required email. OAuth signup requires neither local email nor SMS OTPs.

## Supported sending options

| Provider | Required configuration | Reference |
| --- | --- | --- |
| Alibaba Cloud Direct Mail | AccessKey ID/Secret, sending region, verified sending address. Permission: dm:SingleSendMail. | [SingleSendMail](https://www.alibabacloud.com/help/en/direct-mail/api-dm-2015-11-23-singlesendmail) |
| Tencent Cloud SES | SecretId/SecretKey, ap-guangzhou or ap-hongkong, approved template ID, named variable JSON. Uses template sending rather than deprecated Simple mode. | [SendEmail](https://cloud.tencent.com/document/api/1288/51034) |
| SendCloud | API_USER, API Key, verified sender. | [Send API](https://www.sendcloud.net/doc/email_v2/send_email/) |
| Resend | API Key and verified sender/domain. | [Send Email](https://resend.com/docs/api-reference/emails/send-email) |
| SendGrid | Mail Send API Key and verified sender identity. | [Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) |
| Mailgun | API Key, sending domain, US/EU region, sender. | [Messages](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages) |
| Postmark | Server API Token and verified sender; outbound transactional stream. | [Email API](https://postmarkapp.com/developer/api/email-api) |
| Brevo | API Key, verified sender, transactional sending permission. | [Transactional email](https://developers.brevo.com/reference/send-transac-email) |
| SMTP2GO | API Key and verified domain/sender. HTTP API integration. | [Send an Email](https://developers.smtp2go.com/docs/send-an-email) |
| SMTP | Public server hostname, TLS port, login username and app password/authorization code. | [Workers TCP](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/) |

Verify the domain/sender with the provider, enter credentials in the independent email settings section, set quotas, enable verification, and save. Tencent template JSON can be `{"code":"{{code}}","minutes":"{{minutes}}"}`; keys must match the approved template. Placeholders become the six-digit code and `5` minutes. Switching provider requires new credentials; blank edits preserve credentials only for the same provider.

## SMTP

The UI includes editable hints for QQ (`smtp.qq.com`), 163 (`smtp.163.com`), 126 (`smtp.126.com`), NetEase Enterprise (`smtp.qiye.163.com`), Tencent Enterprise (`smtp.exmail.qq.com`) and Alibaba Mail (`smtp.qiye.aliyun.com`). Enterprise server names/ports may vary by account or region; confirm them in the mailbox console.

Supported: implicit TLS on 465/994 and mandatory STARTTLS on 587, with AUTH PLAIN or LOGIN only after encryption. Enable SMTP in the mailbox and use its app password/authorization code. The sender must be authorized for the account. There is no port 25 or plaintext fallback. IP addresses, internal hostnames and URLs are rejected.

SMTP uses `cloudflare:sockets` in the backend Worker. A plain Node/Bun development server does not provide that runtime; use Wrangler for real SMTP integration testing. A provider may restrict Cloudflare outbound connections or app authentication; use its logs or switch to an HTTP integration when necessary.

## Verification and limits

When Turnstile is enabled, all ordinary and OAuth login/signup flows require it server-side. Sending a code also consumes a token; the widget resets to obtain a fresh token before final registration. Email and phone OTPs are independent and cannot substitute for one another.

Codes expire after five minutes, allow five attempts and are bound to the recipient and browser. Resending invalidates the old code. Account creation and consumption are transactional. Defaults: 60-second cooldown, five requests per recipient per UTC day, ten per IP per UTC hour, 100 per day globally. Failed or timed-out requests count too and are never retried automatically.

Secrets are encrypted and OTPs are stored as keyed hashes. Keep `JWT_SECRET` stable and migrate encrypted configuration/data before rotation. Provider acceptance does not guarantee inbox delivery: check spam folders, identity verification, template approval, quota and delivery logs. The integration does not create vendor accounts or purchase credits.

Apply `server/src/db/schema.sql` before manual upgrades; the deployment workflow creates verification tables automatically. See [SMS setup](./sms.md), [OAuth setup](./oauth.md) and the [detailed Chinese guide](../../zh/guide/email.md).
