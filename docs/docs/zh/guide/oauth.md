# 第三方账号登录与注册（OAuth）

Shirine 支持 Microsoft、Apple、GitHub、Google、QQ、Facebook、X / Twitter、Discord、微信、飞书及 GitLab.com。你需要先在对应平台创建自己的应用，再在 **管理后台 → 系统与全站配置 → 第三方登录 · OAuth** 中填写凭据并启用。

默认全部关闭。只有已启用且凭据完整的平台，才会在登录、注册按钮上方显示。应用审核、账号范围及 API 额度仍由对应平台决定；填写完整并不等于平台已批准上线。

[邮箱验证码](./email.md) 只用于邮箱注册，[短信验证](./sms.md) 只用于可选的手机号注册，不会额外要求第三方账号填写本站验证码。开启 Turnstile 后，普通和第三方的登录、注册都必须先通过人机验证。

## 统一配置步骤

1. 升级部署前后端并执行数据库迁移。项目的部署脚本会通过 `server/src/db/schema.sql` 自动建立 OAuth 所需的数据表。
2. 进入后台第三方登录设置，填写 **网站地址**，例如 `https://blog.example.com`。这里填写前台根地址，不是后端 Worker 地址，也不带 `/api` 或其他路径。
3. 展开要接入的平台，复制该平台的 **授权回调地址**。
4. 在平台开发者控制台创建 Web / 网站应用，把回调地址原样加入允许列表。
5. 把应用 ID、应用密钥及平台专用字段填回 Shirine，勾选启用，点击本节底部的 **保存第三方登录设置**。此按钮独立于顶部外观配置保存按钮。
6. 在新的浏览器窗口打开博客，分别检查登录、注册界面。完成平台授权后会返回发起授权的页面，头像菜单更新为已登录状态。

密钥保存后不回显。修改其他字段时，密钥输入框留空表示保留；清除密钥时必须同时关闭该平台。更换应用 ID 会形成新的平台身份空间，不会自动迁移旧应用下的账号。

### 回调地址对照

将下表的 `https://blog.example.com` 替换为你填写的网站地址。大小写、协议、域名、路径和末尾斜杠都应与平台配置一致。

| 平台 | 回调地址 |
| --- | --- |
| Microsoft | `https://blog.example.com/api/auth/oauth/microsoft/callback` |
| Apple | `https://blog.example.com/api/auth/oauth/apple/callback` |
| GitHub | `https://blog.example.com/api/auth/oauth/github/callback` |
| Google | `https://blog.example.com/api/auth/oauth/google/callback` |
| QQ | `https://blog.example.com/api/auth/oauth/qq/callback` |
| Facebook | `https://blog.example.com/api/auth/oauth/facebook/callback` |
| X / Twitter | `https://blog.example.com/api/auth/oauth/twitter/callback` |
| Discord | `https://blog.example.com/api/auth/oauth/discord/callback` |
| 微信 | `https://blog.example.com/api/auth/oauth/wechat/callback` |
| 飞书 | `https://blog.example.com/api/auth/oauth/feishu/callback` |
| GitLab.com | `https://blog.example.com/api/auth/oauth/gitlab/callback` |

公开站点使用 HTTPS。开发环境允许 `http://localhost` 或 `http://127.0.0.1`，但还需平台支持该回调；Apple 网页登录要求 HTTPS 域名。使用自定义域名后，同时更新 Shirine 网站地址和各平台回调配置。

## 各平台申请与填写方法

### Microsoft（微软邮箱、工作或学校账号）

在 [Microsoft Entra 管理中心](https://entra.microsoft.com/) 的应用注册中创建应用。将重定向 URI 的平台类型选为 **Web**，填入 Microsoft 回调地址。

- **Client ID**：应用概述中的 Application (client) ID。
- **Client Secret**：Certificates & secrets 中创建的客户端密码的 **Value**，不是 Secret ID；创建时保存好这个值并留意有效期。
- **账号范围 / 租户**：`common` 支持个人及组织账号；`consumers` 仅个人账号；`organizations` 仅组织账号；也可填写具体租户 UUID。这里的选择必须与应用注册时的 Supported account types 相匹配。

这里只用 `openid profile` 识别身份，不读取 Outlook 邮件。[官方 OIDC 文档](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)。

### Apple

在 [Apple Developer](https://developer.apple.com/account/) 中准备启用了 Sign in with Apple 的 App ID，并创建与其关联的 **Services ID**。在网站配置中添加你的域名及 Apple Return URL。创建启用了 Sign in with Apple 的签名密钥并下载 `.p8` 文件。

- **Services ID**：填写网页服务标识，不是 iOS Bundle ID。
- **Team ID**：开发者团队的 10 位标识。
- **Key ID**：签名密钥的 10 位标识。
- **.p8 私钥**：粘贴完整 PEM 文本，保留 `BEGIN PRIVATE KEY` 与 `END PRIVATE KEY` 两行。

Shirine 在服务端生成短期 client secret，不需要你手动生成或定期粘贴 JWT。Apple 使用跨站 POST 回调；请勿用防火墙规则拦截该回调，浏览器需要允许本次登录流程的 Cookie。本实现不申请邮箱和姓名，初始昵称可以使用默认值。[Apple 官方接入说明](https://developer.apple.com/documentation/signinwithapplerestapi)。

### GitHub

在 [GitHub Developer settings → OAuth Apps](https://github.com/settings/developers) 创建 **OAuth App**，填写博客地址和 GitHub Authorization callback URL。复制 **Client ID**，生成 **Client Secret** 后填入 Shirine。不要用 Personal access token 代替。

请求 `read:user`，仅将用户资料用于登录。使用授权码及 PKCE 校验。[GitHub 官方流程](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)。

### Google

在 [Google Cloud Console](https://console.cloud.google.com/) 配置 Google Auth Platform 的品牌信息、受众及 OAuth 同意屏幕，创建类型为 **Web application** 的 OAuth 客户端。

在 Authorized redirect URIs 中添加 Google 回调地址，把 **Client ID**、**Client Secret** 填入 Shirine。测试模式需要把试用账号加入 Test users；公开使用应按控制台要求发布应用、验证域名或完成审核。只请求 `openid profile`。[Google 官方 OIDC 文档](https://developers.google.com/identity/openid-connect/openid-connect)。

### QQ

在 [QQ 互联](https://connect.qq.com/) 注册开发者并创建 **网站应用**，按平台要求填写站点资料、回调域和审核信息。应用通过审核后，将 **App ID** 填入 Client ID、**App Key** 填入密钥，并配置 QQ 回调地址。

这里只请求 `get_user_info`。请使用 QQ 互联网站应用凭据，不要填 QQ 号、机器人密钥或小程序密钥。[QQ 官方授权码流程](https://wiki.connect.qq.com/使用authorization_code获取access_token)。

### Facebook

在 [Meta for Developers](https://developers.facebook.com/apps/) 创建支持 **Facebook Login** 的应用，在登录设置的 Valid OAuth Redirect URIs 中填写 Facebook 回调地址。把 **App ID** 与 **App Secret** 填入 Shirine。

请求 `public_profile`。开发模式通常限应用角色和测试账号；面向访客前，按平台提示补齐隐私政策、数据删除说明、必要验证和发布要求。接口使用文档核对时的 Graph API `v26.0`。[Facebook 官方手动登录流程](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)。

### X / Twitter

在 [X Developer Console](https://console.x.com/) 的应用中启用 **OAuth 2.0 User authentication**，选择可保存密钥的 **Web App** 类型，填写 Callback URI 和 Website URL。

使用 **OAuth 2.0 Client ID / Client Secret**，不要填写 API Key / API Key Secret 或 App-only Bearer Token。授权使用 PKCE，身份接口为 `/2/users/me`，请求 `users.read tweet.read`。应用必须有相应接口访问权限和可用额度；权限或额度不足时无法完成登录。[X 官方授权码文档](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)。

### Discord

在 [Discord Developer Portal](https://discord.com/developers/applications) 创建应用，在 OAuth2 页面添加 Discord Redirect，复制 **Client ID** 和 **Client Secret**。

只请求 `identify`；不需要创建机器人，也不要填 Bot Token。[Discord 官方 OAuth2 文档](https://discord.com/developers/docs/topics/oauth2)。

### 微信

在 [微信开放平台](https://open.weixin.qq.com/) 创建 **网站应用**，完成应用审核并获得微信登录权限。填写站点授权回调域，再将 **AppID / AppSecret** 填入 Shirine。

采用网站扫码登录 `snsapi_login`，符合微信条件的桌面客户端也可能提供快速确认。不要使用公众号、小程序 AppID 替代网站应用 AppID。没有审核通过的网站应用时，保持关闭。[微信官方接入文档](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html)。

### 飞书

在 [飞书开发者后台](https://open.feishu.cn/app) 创建应用，复制 **App ID / App Secret**。在安全设置中添加飞书重定向 URL，并按应用类型配置网页应用能力、可用范围和发布版本。

使用飞书现行网页授权码接口、v2 Token 接口及用户信息接口，并使用 PKCE。基本身份信息不申请手机号、邮箱、通讯录或离线访问权限。企业自建应用只允许可用范围内的用户使用，不等于所有飞书用户都能登录。[获取授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)、[获取用户访问令牌](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token)。

### GitLab.com

在 [GitLab.com Applications](https://gitlab.com/-/user_settings/applications) 新建应用，填写 GitLab Redirect URI，启用 **Confidential**，选择 **openid**、**profile** 权限。

把 **Application ID** 和 **Secret** 填入 Shirine。当前仅支持 GitLab.com，不接受任意自建 GitLab 地址。[GitLab 官方 OIDC 文档](https://docs.gitlab.com/integration/openid_connect_provider/)。

## Turnstile 与账号行为

- 开启 [Cloudflare Turnstile](./turnstile) 后，必须先通过验证才能点击第三方按钮；服务端也会在发起授权前校验令牌。直接调用接口同样无法跳过。
- 授权回调凭已验证、限时且只能使用一次的状态继续，不会再次弹出验证码。授权失败后重新发起时需完成新的验证。
- 第一次使用某平台账号会自动建立普通用户，后续按“平台 + 应用 + 平台用户标识”登录同一账号。微软身份还包含租户标识。
- 不按相同邮箱、昵称自动合并账号。因此原来用密码注册的账号，与第一次第三方注册的账号可能是两个账号；已有积分和解锁归属原账号。
- 第三方登录不会自动授予管理员权限。管理员入口仍检查本地角色；只有已由站长授予管理权限的账号才能进入后台。
- 不保存第三方访问令牌，不导入第三方头像。用户仍可使用本站预设头像；本地会话使用 HttpOnly Cookie。
- 平台密钥加密保存在 D1，加密依赖 Worker 的 `JWT_SECRET`。请妥善保管该密钥及数据库备份；更换 `JWT_SECRET` 会令旧 OAuth 配置无法解密，需要管理员重新初始化 OAuth 配置并录入平台凭据。

## 常见问题

| 现象 | 检查项 |
| --- | --- |
| 没有显示第三方按钮 | 平台是否启用、凭据是否完整、是否点了本节保存按钮；重新打开登录弹窗读取最新配置 |
| 按钮灰色不可点 | 人机验证是否完成，验证是否过期，是否正在处理另一个登录请求 |
| 当前域名与网站地址不一致 | 后台网站地址应与当前前台域名一致；不要填 Worker 域名或其他预览域名 |
| `redirect_uri_mismatch`、回调不合法 | 平台允许列表与复制的回调地址是否逐字一致，是否误加末尾斜杠 |
| 只有开发者自己能登录 | 应用是否仍在测试/开发模式，账号是否在测试用户、应用角色或飞书可用范围中 |
| 密钥错误 | 是否把 Secret ID、API Key、Bot Token 当成 Client Secret；密钥是否过期；Apple PEM 是否完整 |
| 状态过期或 Cookie 无效 | 从本站重新发起，使用同一浏览器完成，不要复制授权链接给其他人；检查代理和 Cookie 设置 |
| 平台授权成功但本站未登录 | 查看服务端是否完成迁移、JWT_SECRET 是否稳定、平台用户接口是否可用；不要对 `/api/auth/oauth/*` 配置缓存 |
| X 返回权限或额度错误 | 开发者应用套餐、接口授权和当前额度是否允许 `/2/users/me` |
| Apple POST 回调失败 | HTTPS、Services ID、域名、Return URL、`.p8` 所属团队及密钥授权是否匹配 |

接入代码和模拟回调测试不替代你自己的应用验收。正式开放每个平台前，请使用其真实开发者应用完成一次登录、退出、再次登录和注册入口测试。
