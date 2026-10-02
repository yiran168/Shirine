# Cloudflare Turnstile 人机防护

Cloudflare Turnstile 是一种保护网站免受机器人恶意攻击的智能验证工具，相比传统验证码（CAPTCHA），它具有无需拼图、无需选图的极致无感体验。

---

## 一、获取 Turnstile 密钥

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在左侧导航栏选择 **Turnstile**。
3. 点击 **Add site** 添加新站点：
   - **Site name**: `Shirine Blog`
   - **Domain**: 填入你的博客域名（如 `yourblog.com`，开发测试可添加 `localhost`）
   - **Widget Mode**: 推荐选择 **Managed**（智能管护）
4. 创建完成后，你将获得两组密钥：
   - **Site Key (站点密钥)**：公开在前端使用；
   - **Secret Key (通信密钥)**：保密，仅用于服务端验证。

---

## 二、在 Shirine 后台一键配置

1. 使用管理员账号登录 Shirine 博客，进入 `/admin` 管理后台。
2. 点击 **系统与设置** -> **Cloudflare Turnstile 人机验证**。
3. 开启 **启用开关**。
4. 分别填入 **Site Key** 与 **Secret Key**，点击 **保存所有配置修改**。

配置保存后，系统即刻生效：
- 访客在点击 **注册** 或 **登录** 时，弹窗中将自动加载 Turnstile 验证挂件；
- 服务端在处理用户提交请求时，会向 Cloudflare 官方接口校验令牌；验证失败时拒绝登录或注册。
- [第三方账号登录与注册](./oauth) 同样受此设置控制：必须先完成 Turnstile 才能点击平台按钮，服务端核验成功后才发起 OAuth 授权。回调使用此次已验证的一次性状态，不会再次要求验证；重新发起授权时需重新验证。
