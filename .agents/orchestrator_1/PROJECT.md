# Project: Shirine Dynamic Blog System

## Architecture
- **Frontend (client/)**: Cloudflare Pages + Astro (SSR mode, `output: "server"`, Cloudflare adapter), Svelte 5 interactive islands, Tailwind CSS v4, Material 3 Expressive styling, Swup page transitions, KaTeX, Mermaid.
- **Backend (server/)**: Cloudflare Workers + Hono v4 RESTful API gateway, D1 relational database with Drizzle ORM, R2 object storage with pre-retrieval ACL & fail-closed error handling, Turnstile verification, JWT authentication.
- **Docs (docs/)**: Multilingual developer & user documentation.
- **Data Flow**:
  - Visitor/User -> Astro SSR (client) -> Server REST API (server) -> D1 / R2 / Cloudflare Turnstile.
  - User session -> HTTP-only JWT cookie (`shirine_token`).
  - Post password grants -> HTTP-only short-lived JWT cookie (`shirine_post_grants`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Brand Exclusivity | Strict 'Shirine' branding across all code, comments, filenames (rename `shirone.webp` -> `shirine.webp`), 0 matches of 'shirone'. | M1 | AC 1 & R1 |
| 2 | Workspace Boundary | All files strictly within `d:\MiMo Desktop\项目\1\Shirine`, zero C: drive writes. | M1 | AC 1 & R1 |
| 3 | SSR & Backend Decoupling | Astro SSR with Cloudflare adapter, REST API fetching from Workers, O(1) post queries, 100% native UI/M3 preservation. | M1 | AC 2 & R2 |
| 4 | Build & Type Safety | `cd server && bun run tsc --noEmit` and `cd client && bun run build` pass with exit code 0. | M1 | AC 2 & R2 |
| 5 | D1 Database Schema | 17 aligned tables in `schema.sql` and `schema.ts` (users, posts, albums, checkins, unlocks, point_transactions, configs, etc.). | M1 | AC 3 & R3 |
| 6 | User & Check-in System | User registration, superadmin setup, daily check-in with atomic point transaction ledger in `point_transactions`. | M1 | AC 3 & R3 |
| 7 | 3-Tier Content Permissions | Public, login-required, point-purchased content. `CoverLockOverlay` and `PermissionBadge`. | M1 | AC 3 & R4 |
| 8 | Content CMS Management | Visual CRUD for posts, albums, moments, friends, pages, site/system configs. All sample data editable/deletable. | M1 | AC 3 & R5 |
| 9 | Turnstile Human Verification | Turnstile verification toggleable in CMS, dual-layer validation, secret key fallback, non-invasive client reset. | M1 | AC 4 & R6 |
| 10 | Password-Protected Posts | Strict verification via `POST /api/posts/:id/password/verify` with short-lived signed grant JWT, no plaintext password in query. | M1 | AC 4 & R6 |
| 11 | Protected Media Blob Access | Pre-R2 authorization in `blob-handler.ts`, unattached asset gating (private by default), 503 fail-closed on D1 error. | M1 | AC 4 & R6 |
| 12 | Image EXIF/XMP Stripping | Pure-TS parsing and stripping of JPEG APP1/COM and WebP EXIF/XMP chunks + clearing VP8X bit 3/2. | M1 | AC 4 & R6 |
| 13 | JSON-LD XSS Escaping | Escapes `<`, `>`, and `&` to `\u003c`, `\u003e`, `\u0026` against `</script>` injection. | M1 | AC 4 & R6 |
| 14 | 4-Language i18n | Exact string matching across zh_CN, zh_TW, en, ja for client and admin; localize CoverLockOverlay/PermissionBadge. | M1 | AC 5 & R7 |
| 15 | Live2D Widget Sandbox | Sandboxed iframe integration for visitor and admin with independent toggles and user persistent memory. | M1 | AC 5 & R8 |
| 16 | Circular Avatar Dropdown | 3-state navigation bar avatar menu (guest, user, admin) with exact 4-language action labels. | M1 | AC 5 & R9 |
| 17 | 20 Anime WebP Avatars | 20 full WebP avatars + 20 thumbnails + `avatars.json`, 20-grid selector modal, `PUT /api/user/profile` update. | M1 | AC 5 & R9 |
| 18 | E2E Test Suite | Opaque-box 4-tier automated test suite covering all features, edge cases, combinations, and workflows. | M2 | AC 1-5 |
| 19 | E2E 100% Test Pass | Complete execution of E2E test suite passing with exit code 0. | M3 | AC 1-5 |
| 20 | Adversarial Hardening & Audit | Penetration edge tests (Tier 5) + Forensic Auditor integrity verification. | M4 | Forensics |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Brand Remediation & UI/i18n Fixes | Rename `shirone.webp` -> `shirine.webp`, localize `CoverLockOverlay`/`PermissionBadge`, add `GET /api/user/profile` alias, verify builds. | None | DONE |
| M2 | E2E Test Suite Development | Create comprehensive automated test suite (Tiers 1-4) covering all AC 1-5, publish `TEST_READY.md`. | Parallel with M1 | DONE |
| M3 | E2E Test Execution & Verification | Run full E2E test suite against implementation, resolve any discrepancies, 100% pass rate. | M1, M2 | DONE |
| M4 | Adversarial Hardening & Forensic Audit | Challenger security stress-testing + Forensic Auditor integrity verification. | M3 | DONE |

## Interface Contracts
### Client ↔ Server
- Base API URL: `/api`
- Auth Header: `Authorization: Bearer <token>` or HTTP-Only cookie `shirine_token`
- Post Password Grant: HTTP-Only cookie `shirine_post_grants`
- User Profile:
  - `GET /api/user/profile` -> `{ code: 200, data: { id, username, role, points, avatar, ... } }`
  - `PUT /api/user/profile` -> Body: `{ avatar?: string }` -> `{ code: 200, data: { ... } }`
- Check-in:
  - `POST /api/user/checkin` -> `{ code: 200, data: { pointsEarned, totalPoints, consecutiveDays } }`
- Post Password Verify:
  - `POST /api/posts/:id/password/verify` -> Body: `{ password: "..." }` -> Set-Cookie: `shirine_post_grants`, `{ code: 200, data: { granted: true } }`
- Post Unlock:
  - `POST /api/posts/:id/unlock` -> Body: `{}` -> Deducts points, returns post content.

## Code Layout
- `client/src/components/` - Svelte & Astro UI components (atoms, molecules, organisms).
- `client/src/data/` - Static metadata and project configurations.
- `client/src/i18n/` - Localization dictionaries (4 languages).
- `client/public/assets/avatars/` - 20 WebP avatars + 20 thumbnails + `avatars.json`.
- `client/public/assets/projects/` - Project cover images (`shirine.webp`).
- `server/src/routes/` - Hono route modules (auth, user, posts, albums, moments, config, admin).
- `server/src/core/` - Middlewares, blob-handler, Turnstile verifier.
- `server/src/db/` - Drizzle schema (`schema.ts`) and SQL DDL (`schema.sql`).
- `server/src/utils/` - EXIF stripper, password hashing, JWT helpers.
- `test/` - E2E test runner, test cases (Tiers 1-4).
