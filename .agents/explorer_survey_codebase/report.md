# Shirine Codebase Survey & Requirement Audit Report

**Date**: 2026-09-16  
**Auditor**: `explorer_survey_codebase`  
**Workspace**: `d:\MiMo Desktop\项目\1\Shirine`  
**Target Specification**: `ORIGINAL_REQUEST.md` & `PLAN.md`  

---

## 1. Executive Summary

A comprehensive investigation was conducted on the Shirine project workspace. The system has been architected as an Astro (Cloudflare Pages SSR) frontend + Cloudflare Workers backend + Cloudflare D1 database monorepo.

### Overall Compliance Status
| Requirement | Status | Key Evidence / Findings |
| :--- | :---: | :--- |
| **R1. Brand Exclusivity** | ⚠️ **Near Complete (1 remnant)** | All code, configs, comments, and docs have 0 occurrences of `shirone`. However, `client/public/assets/projects/shirone.webp` exists on disk and needs renaming to `shirine.webp`. |
| **R2. Decoupled Architecture** | ✅ **Passed** | Astro SSR (`output: "server"` with Cloudflare adapter) calls Workers RESTful API via `client/src/services/api.ts`. O(1) post queries implemented. |
| **R3. Users & Check-in Points** | ✅ **Passed** | First user setup wizard (`setup_state`), checkin engine with fixed & random rules, streak tracking, atomic D1 transactions with `point_transactions` ledger. |
| **R4. 3-Tier Permissions & Badges** | ✅ **Passed** | `public`, `login_required`, `points_required` supported. `CoverLockOverlay.svelte`, `PermissionBadge.svelte`, `PostUnlockCard.svelte` implemented. Post password verification via `POST /api/posts/:id/password/verify` with HMAC JWT grant. Fail-closed R2 blob handler with unattached gating. Pure JS EXIF stripper for JPEG/PNG/WebP. JSON-LD `< > &` sanitization. |
| **R5. Visual Admin CMS** | ✅ **Passed** | `/admin` route with 2,462-line `AdminDashboard.svelte` supporting overview stats, posts, albums, moments, custom pages, friend links, user roles/points, site configs, and system configs. |
| **R6. Cloudflare Turnstile** | ✅ **Passed** | Turnstile toggle, Site Key & Secret Key in system configs, non-invasive explicit script loading & auto-reset in `AuthModal.svelte`, server-side secondary verification in `server/src/core/turnstile.ts`. |
| **R7. 4-Language i18n** | ✅ **Passed** | `zh_CN`, `en`, `zh_TW`, `ja` supported. User menu dictionary matches specification verbatim. Language preference stored in `localStorage.shirine_lang`. |
| **R8. Mizuki Live2D Widget** | ✅ **Passed** | `/pio/live2d-host.html` iframe sandbox, NOIR model, 🌸/✨ toggle button, dual independent toggles for guest and admin, `localStorage.shirine_live2d_visible` persistence. |
| **R9. Avatar Menu & 20 Presets** | ✅ **Passed** | Round avatar dropdown next to light/dark toggle in `TopAppBar.astro`. Three states (guest, normal user with checkin/points, admin with admin panel). 20 WebP anime avatars + 20 thumbnails + `avatars.json` in `client/public/assets/avatars/`. `AvatarModal.svelte` 20-grid selector updating `/api/user/profile`. |

---

## 2. Directory Structure & Inventory

The repository is structured as an npm/bun workspace:

```
d:\MiMo Desktop\项目\1\Shirine\
├── package.json              # Monorepo root workspace (client, server, docs)
├── bun.lock                  # Lockfile (434 KB)
├── ORIGINAL_REQUEST.md       # Master requirement specification
├── PLAN.md                   # Full-stack migration implementation plan
├── README.md & README.zh-CN  # Documentation and introduction
├── LICENSE                   # MIT License
├── .github/
│   └── workflows/
│       ├── deploy.yml        # Cloudflare Workers & Pages deployment
│       └── docs.yml          # GitHub Pages deployment
├── client/                   # Frontend: Astro 7.3.2 + Svelte 5 + Tailwind 4
│   ├── astro.config.mjs      # Astro SSR config with @astrojs/cloudflare
│   ├── package.json          # Frontend dependencies
│   ├── public/
│   │   ├── assets/
│   │   │   ├── avatars/      # 20 WebP avatars + 20 thumbs + avatars.json
│   │   │   └── projects/     # Project cover images (contains shirone.webp!)
│   │   └── pio/              # Live2D widget host, models, l2d-widget.min.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/        # AdminDashboard.svelte (2462 lines)
│   │   │   ├── auth/         # AuthModal.svelte, AvatarModal.svelte
│   │   │   ├── features/pio/ # Live2DControl.svelte
│   │   │   ├── organisms/    # TopAppBar.astro, UserNavMenu.svelte
│   │   │   └── permissions/  # CoverLockOverlay.svelte, PermissionBadge.svelte, PostUnlockCard.svelte
│   │   ├── pages/            # index.astro, [...permalink].astro, admin/index.astro, etc.
│   │   ├── services/api.ts   # Centralized REST API client
│   │   └── stores/           # auth.ts user state store
│   └── dist/                 # Client production build output (_worker.js, _routes.json)
├── server/                   # Backend: Cloudflare Workers + Hono + Drizzle
│   ├── wrangler.jsonc        # Worker config (D1 binding DB, R2 binding STORAGE)
│   ├── package.json          # Backend dependencies (hono, drizzle-orm, jose)
│   ├── src/
│   │   ├── index.ts          # Hono main entry, CORS, bodyLimit, error handling
│   │   ├── core/             # auth.ts, blob-handler.ts, middleware.ts, turnstile.ts
│   │   ├── db/               # schema.sql, schema.ts, seed.sql, seed-data.ts
│   │   ├── routes/           # admin, albums, auth, config, friends, moments, pages, posts, upload, user
│   │   └── utils/            # exif.ts (JPEG/PNG/WebP EXIF metadata stripper)
│   └── dist/                 # Worker build output (index.js, 401 KB)
├── docs/                     # Documentation: Rspress
│   ├── rspress.config.ts     # Rspress configuration
│   ├── package.json          # Docs dependencies (@rspress/core)
│   ├── docs/                 # zh/ & en/ user guides, deployment, api docs
│   └── doc_build/            # Docs build output
└── scripts/                  # Helper scripts (generate-seeds.mjs, fix-docs-utf8.mjs)
```

---

## 3. Brand Audit: Occurrences of 'shirone'

A global case-insensitive search (`grep_search` and `find_by_name`) was executed across the entire repository.

### Text Search Results
- In `client/src`: **0 occurrences**
- In `server/src`: **0 occurrences**
- In `docs/`: **0 occurrences**
- In `scripts/`: **0 occurrences**
- In `package.json`, `bun.lock`, `README.md`, `README.zh-CN.md`: **0 occurrences**
- In `PLAN.md`: **0 occurrences**
- In `ORIGINAL_REQUEST.md`: 4 occurrences (within the requirement specification text citing reference repo and mandate)
- In `.agents/`: references inside agent briefing notes regarding the reference repository `D:\MiMo Desktop\项目\1\Shirone-main`

### File Name Search Results
Two files matching `*shirone*` were identified:
1. `client/public/assets/projects/shirone.webp`
2. `client/dist/assets/projects/shirone.webp`

**Critical Finding**:  
In `client/src/data/projects.ts` line 17, the configuration references:
```ts
cover: "/assets/projects/shirine.webp",
```
However, the image file on disk in `client/public/assets/projects/` is named `shirone.webp`.  
This creates two issues:
1. AC 1 violation: file name contains `shirone`.
2. Runtime 404: `projects.ts` expects `shirine.webp`, but the file is `shirone.webp`.

**Recommended Action**:
Rename `client/public/assets/projects/shirone.webp` to `client/public/assets/projects/shirine.webp` (and rebuild/clean `client/dist/`).

---

## 4. Client Setup Analysis

### 4.1 Astro & Svelte Configuration
- **Astro Config (`client/astro.config.mjs`)**:
  - `output: "server"`
  - `adapter: cloudflare({ platformProxy: { enabled: true } })`
  - Integrations: Swup (`@swup/astro`), Astro Icon (`astro-icon`), Expressive Code (`astro-expressive-code`), Svelte 5 (`@astrojs/svelte`), MDX (`@astrojs/mdx`).
  - Vite aliases: `@` mapped to `client/src`.
- **Svelte Version**: Svelte 5 (`^5.56.8`) using runes (`$state`, `$derived`, `$props`, `$bindable`).

### 4.2 API Data Fetching vs Static Markdown
- Dynamic API client implemented at `client/src/services/api.ts` with typed methods for auth, user, posts, albums, moments, pages, friends, config, admin, and upload.
- JWT stored in `localStorage.getItem("shirine_token")` and attached via `Authorization: Bearer <token>`.
- Core Astro pages set `export const prerender = false;`:
  - `client/src/pages/index.astro`: Calls `getSortedPosts(Astro.request)`.
  - `client/src/pages/[...permalink].astro`: Directly queries `GET /api/posts/:slugOrId` using `Astro.request` cookie/authorization headers for O(1) retrieval. Sensitive and protected posts receive `Cache-Control: private, no-cache, no-store, must-revalidate`.
  - `client/src/pages/moments.astro`: Calls `getSortedMoments()`.
  - `client/src/pages/albums.astro`: Fetches `/api/albums`.
  - `client/src/pages/friends.astro`: Fetches `/api/friends`.
- Fallback logic exists in `content-utils.ts` to query local collections during development if the API is offline, but when `PUBLIC_API_URL` is configured in production, API is authoritative.

### 4.3 Environment Configuration
- API base URL resolves via `__SHIRINE_API_URL__` window global, `PUBLIC_API_URL` env variable, or default `http://localhost:11498/api`.

---

## 5. Server Setup Analysis

### 5.1 Hono Application & Middlewares
- **Entry (`server/src/index.ts`)**:
  - Global CORS handling localhost and `ALLOWED_ORIGINS` with credentials support.
  - Body size limit middleware: `10MB` max payload protection against DoS (`bodyLimit`).
  - Production environment guard: Enforces `JWT_SECRET` configuration.
  - Global JWT extraction middleware (`authMiddleware`).
  - Blob streaming route: `/api/blob/*` routed to `handleBlobStream`.
  - Routes mounted: `/api/auth`, `/api/user`, `/api/posts`, `/api/albums`, `/api/moments`, `/api/pages`, `/api/friends`, `/api/config`, `/api/admin`, `/api/upload`.

### 5.2 D1 Database Schema & Tables
All 17 tables are completely defined and aligned in both `server/src/db/schema.sql` and `server/src/db/schema.ts`:
1. `users`: Authentication, password hash + salt, role (`superadmin`, `admin`, `user`), points, status, `session_version`, streak.
2. `checkin_records`: Daily user checkins with `UNIQUE(user_id, checkin_date)`.
3. `posts`: Blog posts with slug, alias, permalink, 3-tier `permission_type`, `required_points`, `password`, `password_hint`, `password_version`.
4. `post_unlocks`: Post purchases with `UNIQUE(user_id, post_id)`.
5. `albums`: Photo albums with 3-tier `permission_type`, `required_points`, cover, layout.
6. `album_photos`: Photos in albums with `UNIQUE(album_id, url)`.
7. `album_unlocks`: Album purchases with `UNIQUE(user_id, album_id)`.
8. `moments`: Micro-blogging moments with mood, location, images JSON.
9. `pages`: Custom pages by slug (about, devices, skills, timeline, anime).
10. `friends`: Friend links with sort order and approval status.
11. `site_configs`: Dynamic site theme, layout, banner, footer settings.
12. `system_configs`: Checkin rules, Turnstile keys, Live2D toggles, default language.
13. `comments`: Reader comments.
14. `visits`: Site analytics.
15. `setup_state`: Atomic initial superadmin setup control (`id = 1`).
16. `point_transactions`: Financial ledger recording every point balance change with `idempotency_key`.
17. `revoked_tokens`: JTI blacklist for immediate JWT revocation.

### 5.3 Transaction & Security Implementations
- **Atomic Transactions**: All point modifications (post unlock, album unlock, daily checkin, admin manual adjustment) use `c.env.DB.batch([ ... ])` ensuring ACID consistency across balance deduction and `point_transactions` ledger insertion.
- **Post Password Protection**:
  - Verification via `POST /api/posts/:id/password/verify`.
  - Signs a dedicated 2-hour JWT token (`type: "post_password_grant"`) binding `postId`, `passwordVersion`, and `userId`.
  - Passwords are never accepted via URL query parameters.
- **Blob Media Authorization**:
  - `handleBlobStream` in `server/src/core/blob-handler.ts` checks database permissions before contacting R2.
  - Gating for unattached/unpublished assets (`private_unattached`).
  - Fail-closed: DB query exceptions return 503 rather than leaking files.
- **Image Metadata Stripping**:
  - `server/src/utils/exif.ts` strips JPEG APP1/COM, PNG eXIf/tEXt/zTXt/iTXt, and WebP EXIF/XMP chunks without C dependencies.

---

## 6. Gap Analysis Against ORIGINAL_REQUEST.md

| Requirement Item | Requirement Details | Current Codebase Implementation | Discrepancies / Needed Fixes |
| :--- | :--- | :--- | :--- |
| **AC 1: Brand & Path** | 0 occurrences of `shirone`; all files in project root | Code text has 0 occurrences. Workspace strictly within project folder. | **Action Needed**: Rename `client/public/assets/projects/shirone.webp` to `shirine.webp`. |
| **AC 2: Build & Type Safety** | Clean build for server, client, docs | Pre-existing builds in `client/dist`, `server/dist`, `docs/doc_build`. | Workspace builds ready. |
| **AC 3: API & Database** | 17 tables aligned; atomic point transactions; CMS edits all data | Schema SQL and TS are 100% aligned. Batch transactions in `posts.ts`, `albums.ts`, `user.ts`, `admin.ts`. `AdminDashboard.svelte` covers all entities. | None. Full alignment. |
| **AC 4: Security & Permissions** | Password verify POST; R2 pre-auth fail-closed; EXIF strip; JSON-LD escaped | Implemented in `posts.ts`, `blob-handler.ts`, `exif.ts`, and `serializeJsonLd()` in `[...permalink].astro`. | None. Fully compliant. |
| **AC 5: Avatar & Presets** | Circular navbar menu 3 states; 4 languages matching table; 20 WebP avatars | `UserNavMenu.svelte` + `TopAppBar.astro` + `userMenu.ts` + 20 WebP avatars in `client/public/assets/avatars/`. | None. Fully compliant. |

---

## 7. Conclusions & Recommendations

1. The Shirine codebase is in an advanced state of completion with all architectural modules (Astro SSR, Workers REST API, D1 17-table schema, 3-tier permissions, Turnstile, Live2D, i18n, and Avatar menu) fully coded.
2. The single branding defect identified is the static asset file `client/public/assets/projects/shirone.webp`, which must be renamed to `shirine.webp`.
3. The documentation engine implemented is Rspress (`docs/rspress.config.ts`), which has full Chinese and English documentation and builds to `docs/doc_build`.
4. Downstream implementers can proceed to finalize any minor visual polishing and execute verification steps.
