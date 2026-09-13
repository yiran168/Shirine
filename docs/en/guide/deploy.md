# Deployment Guide

Shirine can be deployed completely for free on Cloudflare:
- **Frontend**: Cloudflare Pages
- **Backend API**: Cloudflare Workers
- **Database**: Cloudflare D1 (Serverless SQLite)
- **Object Storage**: Cloudflare R2 (Images and attachments)
- **Security**: Cloudflare Turnstile

---

## 1. Prerequisites

1. A [Cloudflare Account](https://dash.cloudflare.com/).
2. Node.js (>= 20) or Bun (>= 1.1) installed.
3. Wrangler CLI installed:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

---

## 2. Deploy Backend (Cloudflare Workers + D1 + R2)

1. Create D1 Database:
   ```bash
   wrangler d1 create shirine-db
   ```
2. Create R2 Storage Bucket:
   ```bash
   wrangler r2 bucket create shirine-storage
   ```
3. Configure `server/wrangler.jsonc` with your `database_id`.
4. Initialize database schema:
   ```bash
   wrangler d1 execute shirine-db --remote --file=./src/db/schema.sql
   ```
5. Deploy Workers:
   ```bash
   cd server
   npm install
   wrangler deploy
   ```

---

## 3. Deploy Frontend (Cloudflare Pages)

1. Go to Cloudflare Dashboard -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
2. Select your `Shirine` repository.
3. Build Settings:
   - **Framework preset**: `Astro`
   - **Root directory**: `client`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Environment variables:
   - `PUBLIC_API_URL`: `https://shirine-server.your-name.workers.dev/api`
5. Click **Save and Deploy**.

---

## 4. First User Superadmin

Visit your newly deployed blog frontend, click the avatar button at the top right, and register. The **first registered user** will automatically receive `superadmin` privileges!
