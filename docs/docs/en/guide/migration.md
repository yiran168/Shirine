# Shirine Upgrade & Migration Guide

This guide helps existing users upgrade and migrate to the latest release of Shirine.

---

## Architecture Overview

Shirine adopts a modern Cloudflare full-stack decoupled architecture:

- **Frontend Client**: Built on Astro 5 SSR + Svelte 5, deployed to **Cloudflare Pages**.
- **Backend Service**: Powered by Cloudflare Workers + Hono + Drizzle ORM for sub-millisecond cold starts.
- **Data & Storage**:
  - **Cloudflare D1**: Distributed SQLite persisting posts, moments, albums, users, ledgers, and site settings.
  - **Cloudflare R2**: Object storage for media uploads and custom audio with custom domain support.

---

## Migration Steps

### Step 1: Sync Latest Repository

```bash
git fetch origin
git checkout main
git merge origin/main
```

### Step 2: D1 Database Schema Migration

Shirine's database schema is defined in `server/src/db/schema.sql`, featuring full idempotence (`CREATE TABLE IF NOT EXISTS` and safe index definitions).

Execute schema synchronization against your remote D1 database:

```bash
cd server
# Login to Cloudflare Wrangler
npx wrangler login

# Execute schema script on remote D1 database
npx wrangler d1 execute DB --remote --file=./src/db/schema.sql
```

> **Note**: For existing installations, idempotent execution creates missing tables (such as `users`, `points_ledger`, `site_configs`, `system_configs`) without altering existing articles.

### Step 3: Configure Cloudflare R2 Storage

To enable custom music uploads and asset hosting:

1. Create an R2 bucket in your Cloudflare Dashboard (e.g., `shirine-media`).
2. Bind the bucket in `server/wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "MEDIA_BUCKET"
   bucket_name = "shirine-media"
   ```
3. Set your public R2 domain in the Admin Panel under **System Settings** (e.g. `https://pub-xxxx.r2.dev` or a custom sub-domain).

### Step 4: Environment Variables Checklist

Ensure the following variables are configured in GitHub Secrets or Cloudflare dashboard:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | Yes | Cryptographic secret for signing auth tokens (32+ chars) |
| `PUBLIC_API_URL` | Yes | Public API address (e.g. `https://api.yourdomain.com`) |
| `PUBLIC_R2_URL` | No | Public domain URL for R2 bucket assets |
| `TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile public site key |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile secret key |

### Step 5: Deploy Frontend and Backend

Run the deployment commands or let GitHub Actions build automatically:

```bash
# Deploy Backend Worker
cd server && bun run deploy

# Build & Deploy Frontend Pages
cd ../client && bun run build
```

After deployment finishes, visit `/admin` to verify site settings, music tracks, and Live2D configuration.