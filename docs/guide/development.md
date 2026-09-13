# 本地开发指南 (Local Development)

本指南指导你在本地搭建 Shirine 的全栈开发环境。

---

## 一、环境依赖

- **Node.js**: >= 20.0.0 或 **Bun**: >= 1.1.0
- **Git**: 最新版本
- **包管理器**: 推荐使用 `npm` 或 `bun`

---

## 二、克隆仓库与目录结构

```bash
git clone https://github.com/yiran168/Shirine.git
cd Shirine
```

项目主要结构如下：
```
Shirine/
├── client/              # 前端项目 (Astro + Svelte + Tailwind)
│   ├── public/          # 静态资源 (Pio 看板娘、预设头像、图标)
│   └── src/             # 前端源代码 (组件、页面、状态、服务)
├── server/              # 后端服务 (Cloudflare Workers + Hono + Drizzle)
│   ├── src/
│   │   ├── core/        # 认证、加密与中间件
│   │   ├── db/          # D1 Schema 与 SQL 定义
│   │   ├── routes/      # REST API 路由
│   │   └── index.ts     # Workers 入口
│   └── wrangler.jsonc   # Cloudflare 配置文件
├── docs/                # VitePress 官方文档站点
└── .github/workflows/   # GitHub Actions CI/CD 流水线
```

---

## 三、启动后端服务 (Server)

1. 进入 `server` 目录并安装依赖：
   ```bash
   cd server
   npm install
   ```

2. 初始化本地 D1 数据库：
   ```bash
   npx wrangler d1 execute DB --local --file=./src/db/schema.sql
   ```

3. 启动本地 Workers 服务：
   ```bash
   npm run dev
   ```
   后端将在 `http://localhost:11498` 启动，并提供全套 `/api/*` 路由。

---

## 四、启动前端博客 (Client)

1. 在新的终端窗口中进入 `client` 目录并安装依赖：
   ```bash
   cd client
   npm install
   ```

2. 启动前端开发服务器：
   ```bash
   npm run dev
   ```
   前端博客将在 `http://localhost:4321` 启动。

3. 打开浏览器访问 `http://localhost:4321`：
   - 首次注册的账户将自动获得超级管理员权限；
   - 访问 `http://localhost:4321/admin` 即可体验管理面板！

---

## 五、启动文档站点 (Docs)

```bash
cd docs
npm install
npm run dev
```
文档将在 `http://localhost:5173` 启动。
