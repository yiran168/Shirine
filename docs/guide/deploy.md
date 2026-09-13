# 部署指南 (Deployment Guide)

Shirine 采用现代化无服务器（Serverless）架构，整套系统可以**完全免费**托管在 Cloudflare 基础设施上：
- **前端客户端**：Cloudflare Pages
- **后端服务**：Cloudflare Workers
- **数据库**：Cloudflare D1 (分布式 SQL)
- **对象存储**：Cloudflare R2 (免费 10GB 存储，无出站流量费)
- **人机安全**：Cloudflare Turnstile (免费无感验证)

---

## 一、准备工作

1. 一个 [Cloudflare 账号](https://dash.cloudflare.com/)。
2. 本地已安装 Node.js (>= 20.0.0) 或 Bun (>= 1.1.0)。
3. 安装 Cloudflare Wrangler CLI：
   ```bash
   npm install -g wrangler
   # 登录你的 Cloudflare 账户
   wrangler login
   ```

---

## 二、部署后端 (Cloudflare Workers + D1 + R2)

### 1. 创建 D1 数据库
在终端执行以下命令创建 D1 数据库：
```bash
wrangler d1 create shirine-db
```
执行后终端会输出形如下方的数据库绑定信息：
```json
[[d1_databases]]
binding = "DB"
database_name = "shirine-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 创建 R2 存储桶
创建一个名为 `shirine-storage` 的 R2 存储桶：
```bash
wrangler r2 bucket create shirine-storage
```

### 3. 配置 `server/wrangler.jsonc`
编辑 `server/wrangler.jsonc`，填入你的 `database_id`：
```jsonc
{
  "name": "shirine-server",
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "shirine-db",
      "database_id": "你的-d1-database-id"
    }
  ],
  "r2_buckets": [
    {
      "binding": "STORAGE",
      "bucket_name": "shirine-storage"
    }
  ],
  "vars": {
    "JWT_SECRET": "请设置一个强随机字符串作为签名密钥",
    "PUBLIC_R2_URL": ""
  }
}
```

### 4. 初始化数据库表结构
在 `server/` 目录下执行初始化脚本：
```bash
# 本地测试时初始化
wrangler d1 execute shirine-db --local --file=./src/db/schema.sql

# 远程线上生产环境初始化
wrangler d1 execute shirine-db --remote --file=./src/db/schema.sql
```

### 5. 部署 Workers 服务
在 `server/` 目录下执行：
```bash
cd server
npm install
wrangler deploy
```
部署完成后，你将获得一个 Workers 服务域名，例如 `https://shirine-server.your-name.workers.dev`。

---

## 三、部署前端 (Cloudflare Pages)

### 1. 配置前端 API 目标地址
在 `client/` 根目录下创建或编辑 `.env` 文件：
```env
PUBLIC_API_URL=https://shirine-server.your-name.workers.dev/api
```

### 2. 通过 Cloudflare Dashboard 部署
1. 登录 Cloudflare 控制台，进入 **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**。
2. 授权并选择你的 GitHub 仓库（`Shirine`）。
3. 构建配置填写如下：
   - **Framework preset**: `Astro`
   - **Root directory**: `client`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 在 **Environment variables** 中添加：
   - `PUBLIC_API_URL`: `https://shirine-server.your-name.workers.dev/api`
   - `NODE_VERSION`: `20`
5. 点击 **Save and Deploy**，即可完成自动化构建上线！

---

## 四、初次使用与管理员激活

1. 部署完成后，访问你的博客前端。
2. 点击顶栏右上角的头像按钮，选择 **注册账号**。
3. **重要提示**：在系统中**首位注册**的用户将被系统自动赋予 **超级管理员 (`superadmin`)** 权限！
4. 注册成功后，点击头像下拉菜单中的 **管理面板** (`/admin`)，即可进入完整的可视化管理后台发布博文、配置签到积分与自定义相册！
