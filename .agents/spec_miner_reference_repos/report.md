# Comprehensive Specification Mining Report: Reference Repositories & Architecture Patterns for Shirine

**Document Identifier**: `SHIRINE-SPEC-MINING-001`  
**Date**: 2026-09-16  
**Author**: `spec_miner_reference_repos`  
**Target Project**: `Shirine` (`d:\MiMo Desktop\项目\1\Shirine`)  
**Repositories Analyzed**:
1. `D:\MiMo Desktop\项目\1\Shirone-main` (Native UI, M3 Expressive, HCT, Swup, Textures, Markdown Plugins)
2. `D:\MiMo Desktop\项目\1\Rin-main` (D1 Schema, Drizzle ORM, CF Workers Hono Routing, R2 Storage, CI/CD)
3. `D:\MiMo Desktop\项目\1\Mizuki-master` (Pio Live2D Integration, Iframe Sandboxing, Swup Hooks)
4. `D:\MiMo Desktop\项目\1\live2d-widget-master` (Live2D Core Widget Engine, Tips, Drag, Tools)

---

## 1. Executive Summary

This report establishes the authoritative architectural blueprint, component contracts, database schemas, and integration patterns for **Shirine**—a modern, dynamic full-stack blog platform built on Cloudflare Pages, Workers, D1, R2, and Turnstile.

By analyzing the four reference codebases, we have extracted:
- **Visual Design System**: The complete Material 3 Expressive (2025) design tokens, 9-style HCT chromatic engine, 5 procedural background textures, and Swup SPA navigation lifecycle from `Shirone-main`.
- **Backend & Storage Infrastructure**: The edge-optimized Hono v4 routing topology, D1 SQL schema with Drizzle ORM mappings, content-addressed R2 storage proxy, and CI/CD workflow from `Rin-main`.
- **Live2D Sandboxed Widget**: The zero-pollution iframe sandbox architecture, dynamic height auto-negotiation protocol, and responsive view controller from `Mizuki-master` and `live2d-widget-master`.
- **System Constraints & Compliance**: Absolute enforcement of the `Shirine` brand identity (eliminating all legacy `Shirone` references) and rigid workspace filesystem boundaries.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Visual / Theme | HCT Dynamic Color Scheme | Derives 42 Material 3 color roles from a single seed hue (0–360) across 9 palette styles and 2 spec versions | `hue` (0–360), `isDark` (boolean), `style` (McStyle), `spec` (McSpec) | Sets 42 `--mc-*` CSS custom properties on `:root` | Defaults to hue 250, tonalSpot style, 2025 spec if parameters invalid | `Shirone-main/src/utils/mc-utils.ts`, `theme-utils.ts` |
| 2 | Visual / Theme | M3 State Layer Tokens | Standardized hover (8%), focus (10%), pressed (12%) interactive state overlays in OKLab color space | CSS class `.m3-state-layer` | Pseudo-element `::before` overlay with exact alpha blend | Fallback to default on-surface color if `--m3e-state-color` omitted | `Shirone-main/src/styles/main.css` |
| 3 | Visual / Theme | Ambient Background Textures | Procedural CSS + inline SVG mask patterns rendered in a fixed canvas without external network requests | `html[data-texture-preset]` (`none`, `starlight`, `cyber-dots`, `topography`, `geometric`, `sakura`) | Masked gradient canvas at `#m3e-texture-canvas` with continuous micro-animations | `none` completely detaches from render tree (`display: none !important`) | `Shirone-main/src/styles/textures.css` |
| 4 | Visual / Theme | Reduced Motion Graceful Degradation | System-level or manual toggle to collapse all transitions and animations to 0.01ms and remove stagger delays | `prefers-reduced-motion: reduce` or `html.motion-reduced` | Zero motion, instantaneous UI state updates | Retains layout and element visibility without getting stuck in starting state | `Shirone-main/src/styles/main.css`, `transition.css` |
| 5 | Visual / Layout | PostCard Adaptive Cover Layout | Responsive blog card with 2:1 top cover on mobile, 28% right cover on desktop, hover dark mask with zoom chevron | Post metadata (title, excerpt, cover URL, tags, category, pin, encryption status) | Structured `<article class="m3-blog-postcard">` | Renders enter button chevron on right if cover image is absent | `Shirone-main/src/components/atoms/blog/PostCard.astro` |
| 6 | Visual / Layout | Container Query Grid Waterfall | Switches blog list from horizontal cards to 16:9 vertical cards in multi-column container environments | Container width `@container post-list-layout (min-width: 41rem / 49rem / 57rem)` | Modifies layout class to `.m3e-post-list--grid` with compact metadata | Collapses to single-column list if container width insufficient | `Shirone-main/src/components/atoms/blog/PostCard.astro` |
| 7 | Navigation | Swup Smooth Page Transitions | Seamless client-side page replacement with animation hooks and selective stylesheet persistence | Navigation anchor clicks | Smooth fade-out/fade-in, updates `<main>` and `#toc` containers | Falls back to native browser navigation if URL contains hash or click aborted | `Shirone-main/astro.config.mjs`, `transition.css` |
| 8 | Content Rendering | Expressive Code Integration | Syntax highlighting with collapsible code blocks, language badges, and copy button | Markdown code blocks (```` ```lang ````) | Syntactically styled `.expressive-code` figure with frame titlebar | Unrecognized languages fall back to plain monospace text | `Shirone-main/astro.config.mjs`, `custom-copy-button.ts`, `language-badge.ts` |
| 9 | Content Rendering | Code Block Auto-Collapsing | Automatically collapses code blocks exceeding line threshold with expand/collapse toggle | Threshold (default 20 lines), preview height (default 10 lines) | Collapsible frame with toggle button | Skips `.m3-code-tree` containers to prevent nested scrolling conflict | `Shirone-main/src/utils/code-collapse.ts` |
| 10 | Content Rendering | KaTeX Formula Rendering & Scroll | Server-rendered math formulas with client-side OverlayScrollbars for wide display equations | `$...$` (inline) or `$$...$$` (block) LaTeX strings | MathML + HTML span trees; wide blocks wrapped in `.katex-display-container` | Fallback text displayed if LaTeX syntax invalid; stylesheet has `data-swup-optional="math"` | `Shirone-main/src/utils/katex-scroll.ts`, `markdown-processor.mjs` |
| 11 | Content Rendering | Mermaid Diagram Pipeline | Remark interceptor keeps Mermaid out of Expressive Code; client renders SVG with M3 dynamic theme matching | Code block with `mermaid` language tag | `<figure class="markdown-mermaid">` with fallback `<pre>` and interactive SVG | Diagram displays `.markdown-mermaid__fallback` on error or JS disabled | `Shirone-main/src/plugins/remark-mermaid.mjs`, `utils/mermaid.ts` |
| 12 | Database / Schema | D1 Edge SQLite Schema | 12 relational tables managing users, checkins, posts, unlocks, albums, moments, pages, friends, and configs | D1 binding `c.env.DB` | Drizzle ORM typed schema entities and relationships | Transactions fail-closed; foreign keys enforce referential integrity | `Rin-main/server/src/db/schema.ts`, `PLAN.md` |
| 13 | Database / Schema | Atomic Points & Transactions | Two-phase deduction and ledger record creation for unlockable posts, albums, and daily checkins | `userId`, `targetId`, `pointsDelta`, `actionType` | Updated user point balance + entry in `point_transactions` | Aborts transaction and rolls back if user balance is insufficient | `PLAN.md`, `ORIGINAL_REQUEST.md` |
| 14 | Database / Schema | First-User Superadmin Auto-Promotion | Automatically assigns `superadmin` role to the very first user registering on the instance | Registration request body (`username`, `password`) | User entity created with `role: 'superadmin'`, initial points awarded | Subsequent registrations strictly assigned `role: 'user'` | `Rin-main/server/src/services/user.ts`, `PLAN.md` |
| 15 | Backend / API | Hono Modular Gateway | Lightweight edge router organizing RESTful endpoints with centralized error handling and timing profiles | Incoming Worker HTTP Request | JSON responses with Server-Timing headers and standard status codes | Custom error classes mapped to HTTP 400, 401, 403, 404, 500 | `Rin-main/server/src/core/hono-app.ts`, `register-routes.ts` |
| 16 | Storage / Media | Content-Addressed R2 Storage | Deduplicated blob storage with SHA hash keys, public CDN URLs, or authenticated blob proxy | Uploaded file buffer + MIME type + key suffix | JSON `{ url: string }` pointing to public CDN or `/api/blob/:key` | Throws 400 on missing payload; 500 on unconfigured storage bucket | `Rin-main/server/src/services/storage.ts`, `utils/storage.ts` |
| 17 | Storage / Media | EXIF Privacy Stripping | Strips JPEG APP1 and WebP EXIF/XMP chunks on upload to erase GPS coordinates and camera metadata | File binary stream | Sanitized binary stream saved to R2 | Corrupted image files rejected with 400 Bad Request | `ORIGINAL_REQUEST.md` R4 |
| 18 | Security / Auth | Salted Password Hash & JWT | Web Crypto SHA-256 with unique user salt; signs and verifies 7-day HTTP-only JWT cookies | Plaintext password, user salt | Stored `password_hash`, HTTP-only `token` cookie | Throws 403 on hash mismatch; rejects expired or malformed JWT | `Rin-main/server/src/services/auth.ts`, `core/hono-middleware.ts` |
| 19 | Security / Anti-bot | Cloudflare Turnstile Verification | Server-side validation of Turnstile captcha token via official Cloudflare siteverify endpoint | `cf-turnstile-response` token, remote client IP | JSON verification outcome (`success: boolean`) | Returns 400 on invalid or reused token; bypasses check when disabled | `PLAN.md`, SkyMail reference, `ORIGINAL_REQUEST.md` |
| 20 | Interactive Widget | Live2D Iframe Sandbox Isolation | Runs Cubism 2/4 engine inside isolated `live2d-host.html` iframe to prevent CSS/JS global namespace contamination | `postMessage({ type: 'l2d-init', config })` | Rendered Live2D canvas with interactive mouse tracking and speech bubble | Iframe remains hidden if script fails to load; does not break host page | `Mizuki-master/src/components/features/pio/Pio.astro`, `live2d-host.html` |
| 21 | Interactive Widget | Live2D Dynamic Auto-Height | Monitors DOM bounding rect of speech bubbles inside iframe and dynamically resizes host iframe height | Resize and MutationObserver events within iframe | `postMessage({ type: 'l2d-loaded', contentHeight })` | Clamps height to base model size if speech bubbles are hidden | `Mizuki-master/public/pio/live2d-host.html` |
| 22 | Interactive Widget | Live2D Dual Admin/Guest Switches | Independent administrative toggles for displaying the Live2D widget on visitor pages vs admin console | `system_configs` keys (`live2d_guest_enabled`, `live2d_admin_enabled`) | Renders or omits iframe component conditionally | Default fallback: visitor enabled, admin disabled | `PLAN.md` R8 |
| 23 | Interactive Widget | Live2D Local Toggle Micro-button | Floating micro-button (🌸/✨) on screen corner allowing visitors to show/hide the character with persistence | User click on floating bubble | Toggles iframe visibility, writes to `localStorage.shirine_live2d_visible` | Recovers persisted visibility state on subsequent visits | `PLAN.md` R8, `live2d-widget-master` |
| 24 | User Experience | TopAppBar User Avatar & Menu | Circular avatar button adjacent to light/dark switch rendering 3 dynamic states (Guest / User / Admin) | Current user session state (`me` query) | Dropdown menu with checkin, change avatar, admin entry, signout | Click outside or Escape key automatically dismisses menu | `Shirone-main/src/components/organisms/TopAppBar.astro`, `ORIGINAL_REQUEST.md` |
| 25 | User Experience | 20 Preset WebP Avatar Grid | Modal grid displaying 20 anime avatar portraits allowing instantaneous profile avatar update via API | User selection in avatar picker modal | Dispatches `PUT /api/user/profile` with new avatar path | Reverts UI state on network failure; displays error toast | `ORIGINAL_REQUEST.md` R9 |
| 26 | DevOps / CI | Multi-Target GitHub Actions | Automated build, testing, and deployment to Cloudflare Workers, Cloudflare Pages, and GitHub Pages | Git push to `main` branch or tag creation | Published edge worker, published client bundle, deployed VitePress docs | Pipeline halts on TypeScript compilation error or lint failure | `Rin-main/.github/workflows/deploy.yml`, `ci.yml` |

---

## 3. Edge Cases

| # | Feature | Input / Condition | Observed Behavior | Handling Requirement in Shirine |
|---|---------|-------------------|-------------------|----------------------------------|
| 1 | HCT Color Resolver | Resolver for specific color role returns `undefined` in `@material/material-color-utilities` | `resolveScheme` outputs `null` for that key, and `applyCurrentScheme` calls `root.style.removeProperty(cssVar)` | Maintain defensive `null` checks; allow CSS variable fallback to `oklch(...)` rules in `variables.styl`. |
| 2 | Code Block Collapsing | Code block located inside `.m3-code-tree` container | `CodeBlockCollapser` exits early on `codeBlock.closest(".m3-code-tree")` | Do NOT inject collapse toggle into code tree items; code trees maintain their own fixed scroll viewport. |
| 3 | Swup Page Transitions | User clicks an internal anchor containing `#` (e.g. `<a href="#section">`) | Swup `skipPopStateHandling` ignores hash navigation; default browser anchor scroll executes | Ensure in-page anchor links and TOC links are excluded from full container replacement. |
| 4 | Swup Optional Stylesheets | Navigating from post with math equations to post without math | `<link rel="stylesheet" data-swup-optional="math">` is unmounted by Swup `persistTags` filter | Mark KaTeX and syntax-heavy stylesheets with `data-swup-optional` to prevent unbounded memory leaks. |
| 5 | Mermaid Dynamic ID | Consecutive Mermaid diagrams rendered across Swup page visits | Counter sequence increments `shirine-mermaid-${++renderSequence}`; prevents ID collision | Ensure ID prefix is strictly `shirine-mermaid-` (never `shirone-mermaid-`). |
| 6 | Texture Canvas 'None' | User switches background texture preset to `none` | Selector `html[data-texture-preset="none"] #m3e-texture-canvas` applies `display: none !important; opacity: 0 !important;` | Completely detaches from render tree to eliminate GPU composition and paint cycles. |
| 7 | First User Registration | Concurrent registration requests when user table count is 0 | Race condition could promote multiple users to `superadmin` | Execute first-user count check and insertion within an atomic D1 database transaction. |
| 8 | Turnstile Verification | Server environment variable `CF_TURNSTILE_SECRET` is missing | Falls back to D1 system configuration secret with console warning; if neither exists, throws 500 | Priority order: `c.env.CF_TURNSTILE_SECRET` > `system_configs.turnstile.secretKey`. |
| 9 | R2 Blob Direct Access | Non-existent or deleted R2 storage key requested at `/api/blob/:key` | R2 returns null object; service returns 404 Not Found with clean plain text error | Return standard 404 response without leaking bucket metadata or internal worker paths. |
| 10 | Protected Post Image Access | Unauthenticated visitor requests private image linked to locked post | R2 proxy verifies user authorization in `post_unlocks` table before streaming blob | Return 403 Forbidden fail-closed; refuse direct pre-signed URL issuance without authorization check. |
| 11 | Live2D Mobile Viewport | Viewport width ≤ 768px (`PIO_MOBILE_BREAKPOINT`) | Iframe sets `display: none;` and suppresses `l2d-init` message to avoid CPU/battery drain | Respect `hiddenOnMobile: true` default; restore display on resize above 768px. |
| 12 | Live2D Height Measurement | Speech bubble text causes message box to exceed base height (500px) | `MutationObserver` inside iframe measures bounding rect of painted elements and notifies parent | Host page listens to `l2d-loaded` event and updates iframe `height` style up to measured height + 12px padding. |
| 13 | Live2D Swup Navigation | Visitor clicks navigation link during active Live2D animation | `swup.hooks.on("link:click")` sets `isTransitioning = true`, pauses init; `visit:end` resumes | Avoids iframe reload flash or WebGL context recreation during route transitions. |
| 14 | Daily Check-in Timezone | User attempts check-in near midnight (e.g. 23:59:59 vs 00:00:01) | Date computed using configured timezone (default `Asia/Shanghai`) formatted as `YYYY-MM-DD` | Unique database constraint on `UNIQUE(user_id, checkin_date)` guarantees idempotent protection against double-claim. |
| 15 | HTML Injection in JSON-LD | Post title or description contains `<script>` tags or HTML entities | Raw JSON stringification can allow `</script>` tag to break out of script block | Escape `<`, `>`, `&` in JSON-LD output using Unicode escape sequences (`\u003c`, `\u003e`, `\u0026`). |

---

## 4. In-Depth Reference Analyses

### 4.1 Shirone-main Reference Analysis

#### Architecture & Integrations
Located at `D:\MiMo Desktop\项目\1\Shirone-main`, this codebase provides the modern front-end foundation:
- **Framework**: Astro 5.x with Svelte 5 runes (`$state`, `$derived`, `$props`) and Tailwind CSS v4 (`@import "tailwindcss"`).
- **Core Integrations (`astro.config.mjs`)**:
  - `swup`: Seamless page transitions with container targeting `["main", "#toc"]`.
  - `expressiveCode`: Syntax highlighter with custom copy button, language badges, line numbers, and collapsible sections.
  - `icon`: Iconify integration configured for FontAwesome and Material Symbols.
  - `sitemap` and `mdx`: For content generation.
- **Unified Markdown Processor (`src/utils/markdown-processor.mjs`)**:
  - Acts as the single source of truth (SSOT) shared between Astro SSG/SSR and client-side dynamic rendering.
  - Chains Remark plugins: `remarkEscapeNumericColons`, `remarkMath`, `remarkMermaid`, `remarkCollapsePanels`, `remarkOptionGroups`, `remarkFields`, `remarkFileTree`, `remarkReadingTime`.
  - Chains Rehype plugins: `rehypeKatex`, `rehypeSlug`, `rehypeAutolinkHeadings`, `rehypeComponents` (registering directives for `acfun`, `bilibili`, `youtube`, `audio-reader`, `artplayer`, `collapse`, `tabs`, `file-tree`, `github`, `grid`, `spoiler`, and M3 admonition callouts).

#### Material 3 Expressive Tokens & Variables
Defined across `src/styles/variables.styl` and `src/styles/main.css`:
- **Color Roles**: Primary, Secondary (rose hue offset `+65°`), Tertiary (teal hue offset `-100°`), Surface containers (lowest, low, standard, high, highest), Outlines, and Error (fixed `27°` hue).
- **Elevation System**:
  - Level 0: `none`
  - Level 1: `0 1px 2px color-mix(in srgb, var(--mc-shadow, #000) 6%, transparent)`
  - Level 2: `0 1px 2px ... 8%, 0 2px 6px 1px ... 6%`
  - Level 3: `0 2px 4px ... 10%, 0 4px 12px 2px ... 8%`
  - Level 4: `0 4px 8px ... 12%, 0 8px 20px 4px ... 10%`
  - Level 5: `0 6px 12px ... 14%, 0 12px 28px 6px ... 12%`
- **Dynamic HCT Engine (`src/utils/mc-utils.ts`)**:
  - Generates full tonal palettes dynamically in browser runtime using `@material/material-color-utilities`.
  - Supported styles: `tonalSpot`, `vibrant`, `content`, `expressive`, `rainbow`, `fruitSalad`, `monochrome`, `neutral`, `fidelity`.
  - Automatically listens to theme changes and updates CSS custom properties `--mc-*` on `:root`.

#### Background Texture System (`src/styles/textures.css`)
Provides 5 procedural vector textures on `#m3e-texture-canvas`:
1. `starlight`: 140px SVG mask with 4-point stars, cross glints, and floating dots with 16s float animation.
2. `cyber-dots`: 48px SVG mask with crosshair reticles and tech grid dots.
3. `topography`: 240px SVG mask with contoured sine waves with 32s continuous flow animation.
4. `geometric`: 160px SVG mask with diamond facets, concentric circles, and crystalline origami.
5. `sakura`: 180px SVG mask with multi-angle cherry blossom petals with 28s downward drift animation.

---

### 4.2 Rin-main Reference Analysis

#### Architecture & Backend Patterns
Located at `D:\MiMo Desktop\项目\1\Rin-main`, this repository provides Cloudflare Workers patterns:
- **Hono Gateway (`server/src/core/hono-app.ts`)**:
  - Global CORS with credentials support.
  - Per-request container (`LazyInitContainer`) providing lazy database connections, cache access, and JWT token management.
  - Centralized error response serialization (`errors/`).
- **Drizzle ORM with D1 SQLite (`server/src/db/schema.ts`)**:
  - Tables declared with `sqliteTable` using `drizzle-orm/sqlite-core`.
  - Automated timestamp fields via `sql`(unixepoch())``.
  - Relational querying via `relations(...)` definitions.
- **R2 Storage Service (`server/src/services/storage.ts`)**:
  - Content addressing via SHA hash of file buffer.
  - Auto-detection between Cloudflare R2 bucket binding (`env.R2_BUCKET`) and AWS S3 fallback (`aws4fetch`).
  - `/api/blob/:key` proxy stream with `immutable` caching headers (`max-age=31536000`).
- **Authentication & Superadmin Initialization (`server/src/services/auth.ts`)**:
  - Password hashing via Web Crypto API SHA-256.
  - First-user check: inspects database count; if empty, assigns superadmin privileges (`permission: 1`).
  - Issues 7-day JWT tokens stored in HTTP-only cookies and `Authorization: Bearer` headers.

---

### 4.3 Mizuki-master & live2d-widget-master Reference Analysis

#### Architecture & Live2D Widget Implementation
- **Sandbox Isolation (`Mizuki-master/public/pio/live2d-host.html`)**:
  - Embedded inside an iframe: `<iframe id="l2d-iframe" src="/pio/live2d-host.html" allowtransparency="true">`.
  - Completely insulates the host document from Live2D global variables, Pixi.js / WebGL contexts, and third-party styling leaks.
- **Bi-directional PostMessage Protocol**:
  - `Host -> Iframe`: `{ type: 'l2d-init', config: { model, position, size, tips, menus } }`.
  - `Iframe -> Host`: `{ type: 'l2d-loaded', contentHeight: number }` (triggers host iframe expansion).
  - `Iframe -> Host`: `{ type: 'l2d-action', action: 'home' | 'scrollToTop' }`.
- **Layout Observation & Auto-Height**:
  - Employs a `MutationObserver` on `document.body` within `live2d-host.html` to measure visible elements (speech bubble `#waifu-tips`).
  - Computes `measuredHeight = viewportHeight - minTop + 12px padding` and notifies host page to expand iframe height smoothly.
- **Swup Route Transition Handshake**:
  - Listens to `swup.hooks.on("link:click")` to prevent re-initializing during transitions.
  - Re-evaluates visibility and triggers initialization after route completion (`visit:end`).
- **Widget Controls (`live2d-widget-master/src/widget.ts`)**:
  - Speech bubble tips triggered by idle timers (20s), copy events, visibility changes, and mouseover elements.
  - Toggle button (`#waifu-toggle`) allows user to minimize or expand the character, saving preference to `localStorage`.

---

## 5. Architectural Blueprint for Shirine

### 5.1 Database Entity Mapping (12 D1 Tables)

Shirine implements the unified 12-table relational schema in D1 SQLite using Drizzle ORM:

```
+-----------------------------------------------------------------------------------+
|                                 SHIRINE D1 SCHEMA                                  |
+-----------------------------------------------------------------------------------+
| 1. users            : id, username, password_hash, salt, role, avatar, nickname,  |
|                       points, status, last_checkin_date, checkin_streak, dates    |
| 2. checkin_records  : id, user_id (FK), checkin_date, points_awarded, created_at  |
| 3. posts            : id, slug, alias, permalink, title, description, content,    |
|                       image, category, tags, pinned, draft, comment_enabled,      |
|                       permission_type, required_points, encrypted, password, ...  |
| 4. post_unlocks     : id, user_id (FK), post_id (FK), points_spent, created_at   |
| 5. albums           : id, title, description, cover, permission_type, points, ... |
| 6. album_photos     : id, album_id (FK), url, title, description, sort_order, ... |
| 7. album_unlocks    : id, user_id (FK), album_id (FK), points_spent, created_at  |
| 8. moments          : id, content, location, mood, images, tags, pinned, draft... |
| 9. pages            : id, slug, title, content, draft, uid, dates                 |
| 10. friends         : id, name, desc, avatar, url, accepted, sort_order, dates    |
| 11. site_configs    : key (PK), value (JSON), updated_at                          |
| 12. system_configs  : key (PK), value (JSON), updated_at                          |
+-----------------------------------------------------------------------------------+
```

### 5.2 Brand & Workspace Boundary Enforcement

1. **Brand String Sanctity**:
   - Zero occurrences of `shirone` (case-insensitive) in customer-facing titles, configurations, meta tags, and source paths.
   - All references strictly renamed to `Shirine`.
2. **Local Workspace Constraint**:
   - All runtime code, database migrations, assets, and builds reside strictly under `d:\MiMo Desktop\项目\1\Shirine`.
   - Zero files written outside this directory.

### 5.3 Three-Tier Content Permission Specification

```mermaid
graph TD
    A[Content Item: Post / Album] --> B{Check permission_type}
    B -->|public| C[Full Content Access]
    B -->|login_required| D{User Authenticated?}
    D -->|Yes| C
    D -->|No| E[CoverLockOverlay: Frosted Glass + Lock Icon<br/>Title: [登录可见] Badge<br/>Content: Auth Gate Card]
    B -->|points_required| F{User is Superadmin?}
    F -->|Yes| C
    F -->|No| G{Already in unlocks table?}
    G -->|Yes| H[Render Content + [✓ 已解锁] Green Badge]
    G -->|No| I[CoverLockOverlay: Gold Shimmer + Diamond Icon<br/>Title: [N 积分解锁] Badge<br/>Content: Point Exchange Card]
    I --> J{User clicks Unlock}
    J -->|Points >= N| K[D1 Atomic Transaction:<br/>1. Deduct N points<br/>2. Insert unlock record<br/>3. Log point_transactions]
    K --> H
    J -->|Points < N| L[Show Insufficient Points Toast<br/>Link to Daily Check-in]
```

### 5.4 Live2D Integration Matrix for Shirine

```
+--------------------------+--------------------------------------------------------+
| Dimension                | Specification in Shirine                               |
+--------------------------+--------------------------------------------------------+
| Storage Location         | client/public/pio/                                     |
| Engine Core              | client/public/pio/l2d-widget.min.js                    |
| Host Sandbox             | client/public/pio/live2d-host.html (iframe isolated)   |
| Guest Visibility Switch  | system_configs (key: 'live2d', guest_enabled: boolean) |
| Admin Visibility Switch  | system_configs (key: 'live2d', admin_enabled: boolean) |
| User Local Toggle        | Floating action bubble (🌸/✨) at bottom corner        |
| Persistence Key          | localStorage.shirine_live2d_visible ('true' | 'false') |
| Mobile View (< 768px)    | Hidden automatically (`hiddenOnMobile = true`)         |
| Route Hook               | Pauses on Swup `link:click`, resumes on `visit:end`    |
+--------------------------+--------------------------------------------------------+
```

---

## 6. Verification and Acceptance Matrix

To verify that the implementation adheres to these extracted specifications:
1. **Brand Verification**:
   ```powershell
   git grep -i "shirone"
   # Must return 0 results
   ```
2. **Type Check & Build**:
   ```powershell
   cd server && bun run tsc --noEmit
   cd ../client && bun run build
   # Both must exit with code 0
   ```
3. **Database Integrity**:
   - Verify `schema.sql` and `schema.ts` match the 12-table specification.
   - Verify check-in and unlock operations write to `point_transactions`.
4. **Live2D Sandboxing**:
   - Inspect network tab: Live2D assets load strictly from `/pio/live2d-host.html`.
   - Toggle guest/admin switches in backend; verify front-end reflects status dynamically.
5. **Theme & Styling**:
   - Inspect `:root` styles in dev tools: verify 42 `--mc-*` custom properties change dynamically when hue slider is dragged.
   - Inspect `#m3e-texture-canvas`: verify all 5 background texture presets render and switch seamlessly.
