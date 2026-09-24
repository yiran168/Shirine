# Shirine 升级与迁移指南

本指南旨在指导现有用户顺利升级或迁移至 Shirine 最新版本。

---

## 架构概览

Shirine 采用前沿的 Cloudflare 全栈解耦架构：

- **前端客户端 (Client)**：基于 Astro 5 SSR + Svelte 5，部署于 **Cloudflare Pages**。
- **后端服务 (Server)**：基于 Cloudflare Workers + Hono + Drizzle ORM，毫秒级冷启动。
- **数据与存储**：
  - **Cloudflare D1**：持久化保存文章、动态、相册、用户积分与系统配置。
  - **Cloudflare R2**：海量多媒体与音乐音频存储，支持自定义公共域名绑定。

---

## 升级与迁移步骤

### 第一步：同步最新代码仓库

```bash
git fetch origin
git checkout main
git merge origin/main
```

### 第二步：数据库结构平滑更新 (D1 Migration)

Shirine 的数据库表结构定义位于 `server/src/db/schema.sql`，具备严格的幂等性（包含 `IF NOT EXISTS` 与安全索引约束）。

运行以下命令将最新数据表同步至生产环境 D1 数据库：

```bash
cd server
# 登录 Cloudflare 认证
npx wrangler login

# 执行 SQL 模式同步至远程 D1 数据库
npx wrangler d1 execute DB --remote --file=./src/db/schema.sql
```

> **提示**：若已有旧版本数据，幂等 SQL 会自动新增缺失的数据表（如 `users`, `points_ledger`, `site_configs`, `system_configs` 等）而不破坏已有文章记录。

### 第三步：配置 R2 对象存储与跨域 (CORS)

如需启用自定义音乐和图床附件直传：

1. 在 Cloudflare Dashboard 中创建 R2 存储桶（例如 `shirine-media`）。
2. 在 `server/wrangler.toml` 中绑定 R2：
   ```toml
   [[r2_buckets]]
   binding = "MEDIA_BUCKET"
   bucket_name = "shirine-media"
   ```
3. 在管理后台 **「系统设置」** 中填写您解析至 R2 的自定义公共域名（如 `https://pub-xxxx.r2.dev` 或自定义二级域名），保存后全站图片与音频即刻生效。

### 第四步：环境变量检查

确保您的 GitHub Actions 或 Cloudflare 环境变量已配置以下核心项：

| 变量名 | 必填 | 说明 |
| :--- | :--- | :--- |
| `JWT_SECRET` | 是 | 用于管理员与用户身份签名的安全密钥（建议 32 位以上随机字符） |
| `PUBLIC_API_URL` | 是 | 生产环境前端访问后端 API 的公开绝对地址（如 `https://api.yourdomain.com`） |
| `PUBLIC_R2_URL` | 否 | R2 存储桶公共访问域名 |
| `TURNSTILE_SITE_KEY` | 否 | Cloudflare Turnstile 人机验证公钥 |
| `TURNSTILE_SECRET_KEY` | 否 | Cloudflare Turnstile 人机验证私钥 |

### 第五步：部署前端与后端

运行根目录部署脚本或通过 GitHub Actions 自动化触发：

```bash
# 部署后端 Worker
cd server && bun run deploy

# 构建并部署前端 Pages
cd ../client && bun run build
```

升级完成后，进入 `/admin` 管理后台，检查全站外观、音乐曲目与 Live2D 看板娘配置。
