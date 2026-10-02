# 注册短信验证码

在 **管理后台 → 系统与设置 → 手机号注册 · 短信验证码** 中独立保存。默认关闭；开启后增加手机号注册选项，必须填写手机号和六位验证码，无需邮箱。默认的 [邮箱注册](./email.md) 始终保留且不要求短信，第三方 OAuth 注册也不要求短信。已注册的手机号可配合密码登录，也可使用用户名；本功能不是短信快捷登录，也不会修改现有账号的手机号。

## 接入步骤

1. 在下表任一服务商开通短信业务，准备凭据、可发送的号码或签名、已审核模板，并确认账户额度和目标国家/地区权限。
2. 选择一个服务商，按字段填写凭据及模板。`{{code}}` 替换为六位验证码，`{{minutes}}` 替换为 `5`。模板变量名称、顺序及正文必须与服务商审核的内容一致。
3. 设置允许的国际区号（默认 `86`，不带 `+`，多个用逗号分隔），设置每号码每天、每 IP 每小时、全站每天的发送上限。
4. 开启开关，点击 **保存短信注册设置**。这是独立设置，不需要再点击其他系统设置的保存按钮。
5. 在前台打开注册，选择“手机号注册”，填写用户名、密码及手机号，通过人机验证后发送验证码。收到短信后填写验证码，等新一次人机验证完成后提交注册。

发送验证码会消耗一次 Turnstile 令牌，组件随后自动重新验证；用户是否需要再次点击由 Cloudflare 决定。后端发送接口与注册接口分别校验，不能用同一枚一次性令牌重复提交。关闭 Turnstile 时不显示这一步。详见 [Turnstile 配置](./turnstile.md)。

## 服务商配置对照

| 服务商 | 后台所需配置 | 控制台准备与官方文档 |
| --- | --- | --- |
| 阿里云短信 | AccessKey ID / Secret、SignName、TemplateCode、变量对象，如 `{"code":"{{code}}"}` | 使用拥有发送权限的 RAM 凭据，签名和模板先审核。此接入使用中国大陆 SendSms。[官方文档](https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms) |
| 腾讯云短信 | SecretId / SecretKey、SmsSdkAppId、SignName、TemplateId、Region、变量数组，如 `["{{code}}","{{minutes}}"]` | 在短信应用中获取 SDK AppID，按模板变量顺序填写，地区默认 `ap-guangzhou`。[官方文档](https://cloud.tencent.com/document/api/382/55981) |
| 华为云短信 | APP Key / Secret、应用接入 HTTPS 根地址、sender 通道号、签名、templateId、变量数组 | 从应用详情获取专属接入地址，如 `https://smsapi.cn-north-4.myhuaweicloud.com`，不要填完整发送路径。使用 `/sms/batchSendSms/v1`。[官方文档](https://support.huaweicloud.com/devg-msgsms/sms_04_0002.html) |
| 火山引擎短信 | Access Key ID / Secret、消息组 SmsAccount、签名、TemplateID、Region、变量对象 | 创建短信消息组及审核模板；默认 `cn-north-1`。调用 SendSms，签名服务名为 volcSMS。[官方文档](https://www.volcengine.com/docs/6361/67380) |
| 云片 | APIKEY、完整短信正文 | 正文包含已审核签名，内容与模板匹配；单条发送 v2。国际发送需开通相应权限。[官方文档](https://www.yunpian.com/official/document/sms/en/domestic_list) |
| 赛邮 SUBMAIL | 短信 AppID / AppKey、project 模板 ID、变量对象 | 使用国内 `/sms/xsend.json` 模板发送；变量名对应模板占位符。[官方文档](https://en.mysubmail.com/documents/tXdKH1) |
| Twilio | Account SID、Auth Token、发送号码或 MG 开头的 Messaging Service SID、短信正文 | 先取得可发送 SMS 的号码或配置 Messaging Service；试用账户通常只能向已验证号码发送。[官方文档](https://www.twilio.com/docs/messaging/api/message-resource) |
| Vonage | API Key / Secret、Sender ID 或发送号码、短信正文 | 使用经典 SMS API；按目的地开通 Sender ID / 号码，Unicode 正文。[官方文档](https://developer.vonage.com/en/api/sms) |
| Plivo | Auth ID / Token、src 发送号码或 Sender ID、短信正文 | 使用 Message API，号码需具备相应发送能力。[官方文档](https://www.plivo.com/docs/messaging/api/message) |
| Infobip | API Key、账户 API Base URL、Sender ID / 发送号码、短信正文 | API Key 需具备 SMS 发送权限；Base URL 如 `https://xxxxx.api.infobip.com`，使用 v2 advanced 接口。[官方示例](https://www.infobip.com/developers/blog/send-an-sms-message-with-node-js-and-infobip) |
| MessageBird | Live API Access Key、originator、短信正文 | 使用经典 SMS REST API 的 AccessKey，不是 Bird Channels API 凭据。[官方文档](https://developers.messagebird.com/api/sms-messaging/) |
| Amazon SNS | Access Key ID / Secret、Region、可选 Session Token、可选 Sender ID、短信正文 | IAM 身份需允许 SNS Publish；短信沙箱需验证接收号码，生产发送需退出沙箱并设置支出额度。临时凭据到期需更新。[官方文档](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html) |

各服务商的账户资格、地区覆盖和发送方要求不同。系统提供这些官方 API 的适配，不会替你开通账户、审批模板或购买短信；没有有效凭据时不要开启验证。一次仅使用当前选中的服务商，不自动切换备用通道。

### 模板例子

已审核正文可以是 `【你的签名】注册验证码为 123456，5 分钟内有效。`，后台使用 `【你的签名】注册验证码为 {{code}}，{{minutes}} 分钟内有效。`。替换“你的签名”为实际批准的签名。

命名变量模板填写 `{"code":"{{code}}","minutes":"{{minutes}}"}`；位置变量模板填写 `["{{code}}","{{minutes}}"]`。如果已审核模板只有验证码一个变量，就只填写这一项，不要添加多余变量。

## 保护与限额

- 每号码至少间隔 60 秒，默认每号码每天 5 次、每 IP 每小时 10 次、全站每天 100 次。自然日和自然小时按 UTC 计算。允许设置的最大值分别为 20、100、10000。
- 全站额度是请求次数上限，不等于计费金额上限：长短信可能拆分多条计费。请同时在服务商控制台配置费用告警、支出上限及国家/地区权限。
- 验证码使用安全随机数，5 分钟有效，最多尝试 5 次；重发使旧验证码失效。验证码绑定手机号与浏览器，成功注册后无法重放。
- 手机号与账号建立唯一关联；验证码验证及账号创建在事务中完成。以后可用手机号加密码登录；此功能不包含短信找回密码。
- 服务商密钥和手机号加密存入 D1，验证码仅保存带密钥哈希；公开接口不返回手机号、密钥或验证码。密钥保存后不回显，留空保留，勾选清除可移除。
- 加密依赖后端 `JWT_SECRET`，必须保持稳定并妥善备份；直接替换会使已有加密配置和手机号记录无法解密，也会使号码哈希改变。更换前需制定数据迁移方案。
- 每次请求仅向服务商发送一次。超时或失败仍消耗配额，避免不确定是否已发送时自动重试造成费用。接口“已发送”表示服务商已接受，实际送达仍取决于运营商。

## 常见问题

**按钮灰色：** 先填写手机号并完成人机验证；已发送需等待倒计时。注册按钮还需要六位验证码、有效发送记录和新的 Turnstile 令牌。

**收不到短信：** 检查服务商发送记录、额度、模板变量、签名、地区权限及号码黑名单。不要反复提交；等待 60 秒后再试。开发测试使用模拟响应，不会验证真实运营商送达。

**设置保存失败：** 当前启用服务商的必填字段必须齐全。华为云及 Infobip 地址只能是对应官方 HTTPS 根地址；阿里云和 SUBMAIL 当前适配仅允许区号 `86`。

**更新后接口报错：** 部署流程会运行 `server/src/db/schema.sql` 创建 `sms_challenges`、`sms_rate_limits`、`user_phones`，保留现有账号。手动部署时也需先应用该幂等数据库结构，再发布后端和前端。
