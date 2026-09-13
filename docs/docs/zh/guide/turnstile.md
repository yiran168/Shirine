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
- 服务端在处理用户提交请求时，会自动向 Cloudflare 官方校验接口发起服务端二次验证，杜绝一切自动化撞库脚本与垃圾注册。
