<p align="center">
  <img src="client/public/logo/icon.webp" alt="Shirine Logo" width="120" height="120" style="border-radius: 28px;" />
</p>

<h1 align="center">Shirine</h1>

<p align="center">
  <strong>Material 3 Expressive Dynamic Full-Stack Anime Blog System</strong>
</p>

<p align="center">
  <a href="https://github.com/yiran168/Shirine/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/yiran168/Shirine/actions"><img src="https://img.shields.io/badge/CI%2FCD-Cloudflare%20Pages%20%2B%20Workers-orange.svg" alt="Deploy" /></a>
  <a href="https://astro.build"><img src="https://img.shields.io/badge/Astro-5-BC52EE.svg" alt="Astro" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/badge/Svelte-5-FF3E00.svg" alt="Svelte" /></a>
  <a href="https://developers.cloudflare.com/workers/"><img src="https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1%20%2B%20R2-F38020.svg" alt="Cloudflare" /></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="https://github.com/yiran168/Shirine">Documentation</a>
</p>

---

## 📖 Introduction

**Shirine** is a modern, dynamic anime-themed blog system designed for creators, developers, and otaku culture enthusiasts.

It marries the visual elegance of Google's **Material 3 Expressive** (2025) design standard with the powerful **Serverless architecture** of Cloudflare Pages, Workers, D1 database, and R2 object storage. No more waiting minutes for static site builds: publish in admin, refresh, and see your new content immediately!

---

## ✨ Features

- 🎨 **Material 3 Expressive Standard**:
  - 100% compliant with Google M3E design tokens, fluid layouts, and expressive spring animations.
  - HCT dynamic color palette: adjusting theme hue (0-360°) automatically generates compliant tonal palettes.
  - Rich Markdown extensions: Admonitions, Steps, Collapse panels, Code grouping, Mermaid diagrams, KaTeX formulas, and Bilibili/audio media players.
- ⚡ **Instant Dynamic Publishing**:
  - Frontend: Astro 5 SSR on Cloudflare Pages.
  - Backend: Cloudflare Workers + Hono + Drizzle ORM.
  - Storage: Cloudflare D1 distributed SQL for content, Cloudflare R2 for images.
  - Newly published posts, albums, and moments appear on the frontend **immediately on refresh**.
- 🔒 **3-Tier Permissions & Points Store**:
  - **Public**: Accessible to anyone.
  - **Login Required**: Frosted glass lock cover and login gate card.
  - **Points Required**: Costs configurable points to permanently unlock with confetti particle animation.
- 🎁 **Daily Check-in Reward Engine**:
  - **Fixed mode**: Awards fixed points daily.
  - **Random range mode**: Awards points randomly within $[min, max]$ range.
  - Tracks consecutive check-in streaks and history.
- 👤 **First Registered User Superadmin**:
  - The first user to register automatically becomes `superadmin` with full system control.
- 🖼️ **50 Preset Anime WebP Avatars**:
  - 50 anime avatars with high-res and thumbnails; switcher grid modal.
  - Global navbar avatar menu adapting to 3 states: Guest (Sign In/Up), User (Check-in/Avatar/Sign Out), Admin (Admin Panel/Avatar/Sign Out).
- 🐱 **Sandboxed Pio Live2D Widget**:
  - Embedded via an isolated iframe, preventing CSS class collisions and script conflicts.
  - Independent toggles for visitor frontend and admin console; floating toggle button.
- 🛡️ **Cloudflare Turnstile Anti-bot Protection**:
  - Server-side and client-side integration for frictionless bot protection.
- 🌍 **Internationalization (i18n)**:
  - English, Simplified Chinese, Traditional Chinese, and Japanese.
- 📡 **RSS 2.0 & Atom 1.0 Feeds**:
  - Smart permission filtering to keep protected content secure.

---

## 🚀 Quick Start

### 1. Clone
```bash
git clone https://github.com/yiran168/Shirine.git
cd Shirine
```

### 2. Start Backend (Server)
```bash
cd server
npm install
npx wrangler d1 execute DB --local --file=./src/db/schema.sql
npm run dev
```

### 3. Start Frontend (Client)
```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:4321`. The first registered user is automatically promoted to superadmin! Access `/admin` for the admin dashboard.

---

## ☁️ 5-Minute Cloudflare Deployment

Deploy entirely on Cloudflare's free tier:

1. **Backend**:
   ```bash
   cd server
   wrangler d1 create shirine-db
   wrangler r2 bucket create shirine-storage
   wrangler d1 execute shirine-db --remote --file=./src/db/schema.sql
   wrangler deploy
   ```
2. **Frontend**:
   - In Cloudflare Dashboard, create a new Pages project connected to your GitHub repository.
   - Build settings: Root directory `client`, Build command `npm run build`, Output directory `dist`.
   - Environment variable: `PUBLIC_API_URL: https://<your-worker>.workers.dev/api`.
3. **Enjoy**: Visit your blog and register to activate superadmin!

---

## 📄 License

Shirine is open source software licensed under the [MIT License](LICENSE).
