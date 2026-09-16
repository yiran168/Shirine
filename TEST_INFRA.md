# Shirine Blog System - Test Infrastructure Documentation

## 1. Overview

The Shirine testing infrastructure provides an automated, comprehensive, 4-tier End-to-End (E2E) test suite designed to validate the complete Cloudflare Workers + D1 + R2 + Astro SSR blog architecture.

The test suite runs natively on **Bun** (`bun test` / `bun test/run-all.ts`), utilizing in-memory D1 database emulation backed by `bun:sqlite` and mock R2 storage to execute real API requests directly against the production Hono application gateway without external network dependencies or flaky background processes.

---

## 2. Test Architecture & Components

```
test/
├── helpers/
│   ├── d1-mock.ts        # Cloudflare D1Database emulation via bun:sqlite with atomic batching
│   ├── r2-mock.ts        # Cloudflare R2Bucket emulation with streaming body and metadata
│   └── test-env.ts       # Test environment harness, user/post factories, in-process Hono dispatcher
├── tier1-features/       # Tier 1: Feature Coverage (AC 1 - AC 5)
│   ├── ac1-brand.test.ts
│   ├── ac2-build.test.ts
│   ├── ac3-database.test.ts
│   ├── ac4-security.test.ts
│   └── ac5-avatar-i18n.test.ts
├── tier2-boundaries/     # Tier 2: Boundary & Corner Cases
│   ├── auth-boundaries.test.ts
│   ├── points-boundaries.test.ts
│   ├── content-boundaries.test.ts
│   ├── blob-boundaries.test.ts
│   └── exif-boundaries.test.ts
├── tier3-combinations/   # Tier 3: Cross-Feature Combinations
│   ├── user-lifecycle.test.ts
│   ├── admin-governance.test.ts
│   ├── turnstile-lifecycle.test.ts
│   └── blob-acl-cascade.test.ts
├── tier4-scenarios/      # Tier 4: Real-World Scenarios
│   ├── visitor-to-member-journey.test.ts
│   ├── admin-editorial-workflow.test.ts
│   └── i18n-language-switch-workflow.test.ts
└── run-all.ts            # Orchestrated test runner with formatted scorecard
```

### 2.1 In-Memory D1 Database Engine (`test/helpers/d1-mock.ts`)
- Backed by Bun's native C-level SQLite engine (`bun:sqlite`).
- Executes the authoritative SQL DDL (`server/src/db/schema.sql`) on initialization, establishing all 17 tables, indexes, and constraints.
- Fully supports Drizzle ORM's D1 driver interface (`prepare()`, `bind()`, `run()`, `all()`, `raw()`, `first()`).
- Implements atomic `batch()` execution wrapped in `BEGIN ... COMMIT / ROLLBACK` transactions, precisely matching Cloudflare D1 transaction semantics and providing `meta: { changes, last_row_id }` telemetry for optimistic concurrency and balance checks.

### 2.2 In-Memory R2 Storage Engine (`test/helpers/r2-mock.ts`)
- Provides a high-fidelity implementation of Cloudflare R2 object storage.
- Supports `get()`, `put()`, `delete()`, `head()`.
- Generates compliant `R2ObjectBody` instances with readable streams, byte buffers, HTTP metadata headers (`Content-Type`, `Content-Disposition`, `Cache-Control`), and ETags.

### 2.3 Integrated In-Process Dispatcher (`test/helpers/test-env.ts`)
- Instantiates the production Hono application gateway (`server/src/index.ts`).
- Injects sandboxed environment bindings (`DB`, `STORAGE`, `JWT_SECRET`, `CF_TURNSTILE_SECRET`).
- Dispatches HTTP `Request` objects directly through `app.fetch(request, env)`, testing all global middlewares, CORS headers, body limits, authentication checks, route handlers, and error handlers.
- Includes factory methods for creating superadmins, regular users, posts, and albums with genuine cryptographic password hashes (`PBKDF2-HMAC-SHA256`) and JWT tokens (`HS256`).

---

## 3. 4-Tier Testing Methodology

### Tier 1: Feature Coverage (AC 1 – AC 5)
Covers all primary functional requirements and acceptance criteria:
- **AC 1 (Brand Exclusivity & Workspace Boundary)**: Verifies 0 occurrences of 'shirone' in source files, configs, and filenames. Validates that all files reside strictly inside the project root without any C: drive writes.
- **AC 2 (Build Safety & SSR Architecture)**: Verifies server TypeScript (`tsc --noEmit`) and client production builds exit with code 0. Validates Astro SSR mode with Cloudflare adapter and O(1) single-post API queries.
- **AC 3 (Database Schema & Transactions)**: Validates alignment of all 17 tables between `schema.sql` and `schema.ts`. Verifies daily checkin points, 3-tier content permissions, atomic unlock transactions, and CMS CRUD operations.
- **AC 4 (Security Standards & Protection)**: Tests toggleable Turnstile verification with dual-layer fallback, post password verification via `POST /api/posts/:id/password/verify` with short-lived JWT grant cookies, pre-R2 ACL checks with 503 fail-closed behavior, EXIF/XMP stripping for JPEG/WebP, and JSON-LD XSS escaping.
- **AC 5 (Avatar & i18n Management)**: Tests 4-language i18n text matching for 7 user menu actions across `zh_CN`, `zh_TW`, `en`, `ja`. Verifies the 3-state avatar dropdown, 20 anime WebP avatars + 20 thumbnails, `avatars.json` metadata, and `PUT /api/user/profile` updates.

### Tier 2: Boundary & Corner Cases
Exercises edge conditions, invalid inputs, and security fault tolerance:
- **Auth Boundaries**: Rejection of invalid credentials (401), non-existent users (401), duplicate usernames (400), short passwords (400), malformed JWT tokens (401), and revoked session tokens after logout.
- **Points Boundaries**: Rejection of duplicate check-ins on the same day (400), insufficient point unlocks (400), idempotent re-unlocks (0 deduction), free post handling (0 deduction), and SQLite CHECK constraint prevention of negative points.
- **Content Boundaries**: 404 responses for non-existent post IDs, slugs, and albums. Gating draft posts from regular visitors (404/403). Rejection of overlong passwords (>128 chars). Rejection of unlock requests on non-purchasable posts.
- **Blob Boundaries**: Missing keys (400), unbound storage (404), unauthenticated access to protected post media (401), unpurchased media access (403), non-existent objects (404), and 503 fail-closed responses when the database is unavailable.
- **EXIF Boundaries**: Safe handling of empty buffers, truncated/corrupted JPEG headers, unsupported MIME types, truncated WebP headers, truncated PNG headers, and byte-for-byte preservation of clean WebP images.

### Tier 3: Cross-Feature Combinations
Validates complex multi-step workflows and state transitions across subsystems:
- **User Lifecycle**: Register -> Check-in -> Accumulate points -> Paywall block -> Admin point adjustment -> Unlock post -> Protected media access -> Ledger audit -> Session logout.
- **Admin Governance**: Superadmin initialization -> Create paywalled post -> Configure dynamic check-in rules (random range) -> User earns points within range -> Switch post to public -> Instant unblocked access.
- **Turnstile Lifecycle**: Turnstile disabled -> Registration passes -> Turnstile enabled -> Registration blocked without token -> Secret key priority validation -> Turnstile disabled -> Registration restored.
- **Blob ACL Cascade**: Gated media -> Password verification -> Grant cookie issued -> Media access granted -> Password rotated by author -> Old grant cookie immediately invalidated (403) -> Re-verification restores access.

### Tier 4: Real-World Scenarios
Simulates realistic end-to-end user journeys:
- **Visitor to Member Journey**: Visitor browses public blog -> Hits paywalled post -> Registers account -> Performs daily check-in -> Opens 20-grid modal and updates anime avatar -> Unlocks post -> Leaves comment -> Audits point transaction history.
- **Admin Editorial Workflow**: Admin logs in -> Uploads hero banner -> Creates draft post referencing media -> Previews unattached media (200 with no-store) -> Publishes post -> Post appears in public feed -> Updates site configuration -> Visitors see updated branding.
- **4-Language Switch Workflow**: Visitor sequentially navigates the platform across 4 languages (`zh_CN`, `zh_TW`, `en`, `ja`), verifying 100% dictionary completeness and translation accuracy for all user menu actions and badges.

---

## 4. How to Run the Tests

### 4.1 Run the Full Test Suite
To run all test suites via Bun's native test runner:
```bash
bun test
```

### 4.2 Run with Formatted Scorecard Runner
To run all test suites sequentially with formatted summary metrics and per-tier execution timing:
```bash
bun test/run-all.ts
```

### 4.3 Run Specific Tiers or Files
```bash
# Run Tier 1 Feature Coverage
bun test test/tier1-features/

# Run Tier 2 Boundary Cases
bun test test/tier2-boundaries/

# Run Tier 3 Combinations
bun test test/tier3-combinations/

# Run Tier 4 Scenarios
bun test test/tier4-scenarios/

# Run a single specific test file
bun test test/tier1-features/ac1-brand.test.ts
```

---

## 5. Test Integrity Guarantee

In accordance with project integrity standards:
1. **No Facade Tests**: All tests execute real logic against genuine Hono route handlers, real database queries, real cryptographic functions, and real filesystem assets.
2. **No Mock Bypasses**: Core security gates (Turnstile verification, password hashing, JWT signing/verifying, R2 pre-authorization ACL, EXIF byte stripping) are tested directly without stubbing out security checks.
3. **Deterministic State Isolation**: Each test runs within an isolated in-memory SQLite database instance, preventing state contamination and order dependence.
