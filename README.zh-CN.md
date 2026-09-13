<p align="center">
  <img src="client/public/logo/icon.webp" alt="Shirine Logo" width="120" height="120" style="border-radius: 28px;" />
</p>

<h1 align="center">Shirine</h1>

<p align="center">
  <strong>优雅灵动的 Material 3 Expressive 现代二次元动态全栈博客系统</strong>
</p>

<p align="center">
  <a href="https://github.com/yiran168/Shirine/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/yiran168/Shirine/actions"><img src="https://img.shields.io/badge/CI%2FCD-Cloudflare%20Pages%20%2B%20Workers-orange.svg" alt="Deploy" /></a>
  <a href="https://astro.build"><img src="https://img.shields.io/badge/Astro-5-BC52EE.svg" alt="Astro" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/badge/Svelte-5-FF3E00.svg" alt="Svelte" /></a>
  <a href="https://developers.cloudflare.com/workers/"><img src="https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1%20%2B%20R2-F38020.svg" alt="Cloudflare" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong> · <a href="https://github.com/yiran168/Shirine">官方文档</a>
</p>

---

## 📖 项目简介

**Shirine** 是一款专为二次元、开发者与创作者打造的高性能动态博客系统。

深度融合了 Google Material 3 Expressive (2025) 设计语言与强大的 Cloudflare Serverless 动态全栈架构，彻底终结了静态博客“发布一篇文章必须全量构建数分钟”的历史：在后台编辑发布，刷新前台立刻直呈！

---

## ✨ 核心特性

- 🎨 **Material 3 Expressive 设计规范**：
  - 100% 遵循 Google M3E 大圆角流体布局与层级阴影；
  - HCT 动态色彩算法：调整单一主色相（0-360°）即可自动派生全站合规色阶；
  - 丰富的 Markdown 扩展：提示框 (Admonition)、步骤容器 (Steps)、折叠面板、代码分组、Mermaid 架构图、KaTeX 数学公式、多媒体播放器。
- ⚡ **毫秒级全动态响应（即写即看）**：
  - 前端基于 Astro 5 SSR + Cloudflare Pages；
  - 后端基于 Cloudflare Workers + Hono + Drizzle ORM，毫秒级冷启动；
  - 数据持久化于 Cloudflare D1 分布式 SQLite 数据库，文件存储于 Cloudflare R2 对象存储；
  - 后台发布博文、新建相册或发布动态日记，**前台刷新即刻可见**。
- 🔒 **三级阅读权限与积分商城**：
  - **公开 (Public)**：全网畅读；
  - **登录专属 (Login Required)**：毛玻璃锁面 + 引导登录卡片；
  - **积分解锁 (Points Required)**：博主自定义所需积分，读者通过每日签到积攒点数永久解锁，附带五彩纸屑粒子动画。
- 🎁 **每日签到与积分奖励引擎**：
  - **固定模式**：每日发放固定点数；
  - **区间随机模式**：在 $[min, max]$ 闭区间内密码学随机抽奖，趣味性强；
  - 记录连续签到天数与打卡历史。
- 👤 **首位注册超级管理员机制**：
  - 部署完成后，系统首位注册用户自动提拔为最高权限 `superadmin`。
- 🖼️ **20 款精选二次元 WebP 预设头像**：
  - 内置 20 款动漫头像（含缩略图与高清图），支持网格弹窗自由切换；
  - 全局导航栏右上角圆形头像自适应三种状态：未登录（登录/注册）、普通用户（打卡/换头像/登出）、管理员（管理后台/换头像/登出）。
- 🐱 **Pio Live2D 看板娘沙箱隔离**：
  - 基于 Mizuki 看板娘引擎，使用 iframe 沙箱彻底隔离渲染环境，避免样式污染与脚本冲突；
  - 后台独立配置前台访客与后台控制台的开启状态；前台右下角常驻悬浮折叠按钮。
- 🛡️ **Cloudflare Turnstile 智能人机防护**：
  - 后台一键开启并配置 Site Key / Secret Key，非侵入式防御恶意爆破。
- 🌍 **完整国际化 (i18n)**：
  - 前台、用户菜单及后台支持简体中文、繁体中文、英语、日语多语言切换。
- 📡 **RSS 2.0 & Atom 1.0 全文订阅**：
  - 智能权限过滤，保护会员与积分解锁内容不被公共源泄露。

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/yiran168/Shirine.git
cd Shirine
```

### 2. 启动后端 (Server)
```bash
cd server
npm install
# 初始化本地 D1 数据库
npx wrangler d1 execute DB --local --file=./src/db/schema.sql
# 启动后端 API (端口 11498)
npm run dev
```

### 3. 启动前端博客 (Client)
```bash
cd client
npm install
# 启动前端博客 (端口 4321)
npm run dev
```

访问 `http://localhost:4321`，注册首个账户自动成为超级管理员，访问 `http://localhost:4321/admin` 进入管理后台！

---

## ☁️ 一键免费部署到 Cloudflare

整套 Shirine 系统可在 Cloudflare 免费配额内完整运行：

1. **后端服务**：
   ```bash
   cd server
   wrangler d1 create shirine-db
   wrangler r2 bucket create shirine-storage
   # 在 wrangler.jsonc 中填入 database_id
   wrangler d1 execute shirine-db --remote --file=./src/db/schema.sql
   wrangler deploy
   ```
2. **前端博客**：
   - 在 Cloudflare 控制台创建 Pages 项目，连接你的 GitHub 仓库；
   - 根目录选择 `client`，构建命令 `npm run build`，输出目录 `dist`；
   - 环境变量添加 `PUBLIC_API_URL: https://你的Workers域名/api`。
3. **完成部署**：访问前端注册账号，立刻体验全新动态博客！

---

## 📚 详细文档

更多进阶指南请查阅官方文档：
- [快速开始与部署指南](docs/guide/deploy.md)
- [权限与积分系统设计](docs/guide/permissions.md)
- [管理后台与即写即看](docs/guide/admin.md)
- [Live2D 看板娘配置](docs/guide/live2d.md)
- [Cloudflare Turnstile 配置](docs/guide/turnstile.md)
- [REST API 接口文档](docs/guide/api.md)

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 开源许可证。
