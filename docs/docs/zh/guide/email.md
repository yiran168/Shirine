# 邮箱注册、验证码与 SMTP

Shirine 默认使用邮箱注册。**管理后台 → 系统与设置 → 邮箱注册 · 邮箱验证码** 的开关决定是否要求填写邮箱验证码；默认关闭。关闭验证码不等于关闭邮箱注册，仍需有效邮箱、用户名和密码。

**手机号注册 · 短信验证码** 是另一项独立设置，默认关闭。开启后，注册表单才出现“邮箱注册 / 手机号注册”选项；选择手机号注册时不要求邮箱，但必须验证短信。邮箱注册不要求手机号，第三方 OAuth 注册也不要求本站邮箱或短信验证码。详情见 [短信设置](./sms.md) 和 [OAuth 设置](./oauth.md)。

## 统一接入流程

1. 在邮件服务商处开通发送能力，验证发件人或发信域名，并按控制台要求配置 SPF / DKIM 等记录。SMTP 邮箱则需开启 SMTP、获取授权码或应用密码。
2. 在后台选择服务商，填写发件邮箱、发件人名称和凭据。发件邮箱必须与服务商已批准的发送身份匹配。
3. 如使用腾讯云 SES，先提交验证码邮件模板并获得审核通过的模板 ID，再填写模板变量 JSON。
4. 设置每邮箱每天、每 IP 每小时和全站每天的发送次数，开启邮箱验证码，点击 **保存邮箱注册设置**。此区域独立保存。
5. 在前台选择邮箱注册，填写邮箱并发送验证码。开启 Turnstile 时，发送前必须完成验证；发送后组件会自动重置，为提交注册获取新令牌。填写收到的六位验证码和其他注册信息后提交。

每次只使用当前选中的服务商。更换服务商必须重新填写对应密钥；同一服务商编辑时，密钥留空保留原值。保存后不会回显。接入不包含自动开通服务、购买额度或真实发信测试。

## 国内邮件 API

| 服务商 | 后台字段 | 准备事项 |
| --- | --- | --- |
| 阿里云邮件推送 | AccessKey ID、AccessKey Secret、服务地区、发件邮箱 | 在对应地区创建发信域名和地址，授予 `dm:SingleSendMail` 权限。使用 SingleSendMail，并验证官方签名示例。地区必须与控制台相同。[发送接口](https://www.alibabacloud.com/help/en/direct-mail/api-dm-2015-11-23-singlesendmail)、[地区地址](https://www.alibabacloud.com/help/en/direct-mail/api-endpoints) |
| 腾讯云 SES | SecretId、SecretKey、地区、已审核邮件模板 ID、模板变量 JSON | 当前接口地区为 `ap-guangzhou` 或 `ap-hongkong`。默认必须使用审核模板，不依赖已废弃的 Simple 正文模式。[发送接口](https://cloud.tencent.com/document/api/1288/51034) |
| SendCloud | API_USER、API Key、已验证发件邮箱 | 使用事务类邮件账号及 `/apiv2/mail/send` 接口；确认发送域名、账户额度和风控状态。[发送接口](https://www.sendcloud.net/doc/email_v2/send_email/) |

腾讯云模板示例：模板正文“你的注册验证码为 `%code%`，`%minutes%` 分钟内有效”，后台变量填写 `{"code":"{{code}}","minutes":"{{minutes}}"}`。具体模板占位符格式以腾讯云编辑器为准；后台变量键名必须与审核模板一致。`{{code}}` 替换为六位随机码，`{{minutes}}` 替换为 `5`。

## 其他邮件 API

| 服务商 | 配置 | 官方文档 |
| --- | --- | --- |
| Resend | 已验证发信域名下的邮箱、具备发送权限的 API Key | [Send Email](https://resend.com/docs/api-reference/emails/send-email) |
| SendGrid | 已验证 Sender Identity / 域名、具备 Mail Send 权限的 API Key | [Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) |
| Mailgun | 发信域名、US / EU 区域、对应域名的 API Key、发件邮箱 | [Messages](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages) |
| Postmark | Server API Token、已验证发件人或域名；使用 outbound 事务消息流 | [Email API](https://postmarkapp.com/developer/api/email-api) |
| Brevo | API Key、已验证发件人、事务邮件发送权限 | [Transactional email](https://developers.brevo.com/reference/send-transac-email) |
| SMTP2GO | API Key、已验证发信域名或单个发件人；使用 HTTP API | [Send an Email](https://developers.smtp2go.com/docs/send-an-email) |

各服务商的试用限制、域名审批、限额和地区支持不同；凭据填写完整并不保证邮件能送达所有收件箱。系统只检查服务商是否接受发送，实际送达请查看服务商投递日志。

## 普通 SMTP：QQ、网易和企业邮箱

选择 **普通 SMTP（TLS / STARTTLS）**。后台提供 QQ、163、126、网易企业、腾讯企业和阿里企业邮箱的常用服务器提示，也可手动填写其他服务商的公网 SMTP 域名。企业邮箱可能根据版本、地区或专属域名使用不同地址和端口，请以本账号控制台为准。

| 常用配置 | 服务器提示 | 说明 |
| --- | --- | --- |
| QQ 邮箱 | `smtp.qq.com` | 开启 SMTP 后使用授权码。[QQ 官方帮助](https://service.mail.qq.com/detail/0/75) |
| 163 / 126 | `smtp.163.com` / `smtp.126.com` | 使用客户端授权密码，核对 SSL 端口。[网易官方帮助](https://help.mail.126.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac25c12dcb3d46222b6) |
| 网易企业邮箱 | `smtp.qiye.163.com` | 企业管理员提供本账号的服务器和 TLS 端口；必要时改为专属地区服务器。 |
| 腾讯企业邮箱 | `smtp.exmail.qq.com` | 使用企业管理员允许的客户端账号和授权凭据。 |
| 阿里企业邮箱 | `smtp.qiye.aliyun.com` | 官方通用配置为 TLS 465；不使用未开放的 587。[阿里邮箱官方帮助](https://help.aliyun.com/zh/document_detail/36576.html) |

登录账号通常填写完整邮箱地址；密码字段填写服务商要求的授权码 / 应用密码，不要把 OAuth Client Secret 当作 SMTP 密码。发件邮箱通常应与登录账号或授权别名一致。

支持 **465 / 994 隐式 TLS** 和 **587 STARTTLS**。587 必须成功升级 TLS 后才发送认证信息，禁止降级明文；支持 AUTH PLAIN / LOGIN。仅支持公网域名，不接受 IP、内网域名或带路径的 URL。Cloudflare Workers 默认限制 SMTP 25，因此不提供 25 端口或明文认证。[Cloudflare TCP 文档](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)

SMTP 运行于 Cloudflare 后端 Worker 的 TCP socket。普通 Node/Bun 本地 API 运行器不提供 `cloudflare:sockets`；本地真实 SMTP 联调需使用 Wrangler Worker 运行时。邮件服务商仍可能限制 Cloudflare 出口连接、地区或应用密码权限，遇到问题应检查服务商日志或使用同一页面的 HTTP API。

## 验证规则与排错

- 验证码 5 分钟有效，单次最多尝试 5 次；重发使旧码失效，成功注册后不可重用。验证码绑定邮箱和发起浏览器，修改邮箱后需重发。
- 默认每邮箱每天 5 次、每 IP 每小时 10 次、全站每天 100 次，重发间隔 60 秒。自然日 / 小时按 UTC 计算；失败或超时请求也占额度，不自动重试以避免重复发送。
- Turnstile 开启时，普通登录、邮箱注册、手机号注册、第三方登录及第三方注册均由后端校验；邮件和短信发送也先验证。令牌一次有效，发送之后需要新令牌提交注册。
- API Key / SMTP 密码加密存储，验证码仅保存带密钥哈希，接口及日志不回传验证码或服务商原始错误。保持 `JWT_SECRET` 稳定，更换前需迁移加密设置和关联数据。
- 邮箱格式会统一为小写，已有邮箱不能重复注册。手机号注册不填写或绑定未经验证的邮箱。
- “验证码已发送”但未收到时，检查垃圾邮件、发件身份验证、服务商额度、模板状态和投递日志。不要连续重试；等待倒计时后再操作。
- 部署脚本会通过 `server/src/db/schema.sql` 建立 `email_challenges` 等验证表；手动部署需先应用该幂等结构。旧账号继续使用原密码，不会被要求重新注册。
