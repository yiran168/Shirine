# Adversarial Verification Handoff Report — challenger_1

**Date**: 2026-09-16  
**Agent**: challenger_1 (EMPIRICAL CHALLENGER / critic, specialist)  
**Milestone**: M4 (Security & API Adversarial Verification)  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct empirical verification was conducted across all six threat vectors specified in the dispatch mission, alongside full project build and test validation.

### O1. Build & Type Safety Verification
- **Server Typecheck**: Command `bun run tsc --noEmit` in `d:\MiMo Desktop\项目\1\Shirine\server` executed with exit code 0 and zero type errors.
- **Client Production Build**: Command `bun run build` in `d:\MiMo Desktop\项目\1\Shirine\client` completed in 11.28s with exit code 0 (`[build] Complete!`, Cloudflare adapter server entrypoint built).

### O2. Full Test Suite & Scorecard Execution
- Command `bun test/run-all.ts` executed **23 test suites** across all 5 tiers (Feature Coverage, Boundaries, Cross-Feature Combinations, Real-World Scenarios, and Adversarial Hardening).
- **Result**: `Total Suites: 23 | Passed: 23 | Failed: 0` (100% Pass Rate).
- Command `bun test` executed **108 test cases** across 25 files with **1,433 assertions**.
- **Result**: `108 pass, 0 fail, 1433 expect() calls. [3.43s]`.

### O3. Password Gate & Token Security Observations
- `server/src/routes/posts.ts`:
  - Lines 168–183: `resolvePostAccess` evaluates password gate. If post has password (`encrypted === 1` or `post.password.length > 0`) and user is not admin/author, access is denied unless `verifyPostGrant(grant, post.id, post.passwordVersion, user ? user.id : null, jwtSecret)` passes.
  - Lines 366, 375, 383: In `getPostDetailResponse`, `content` is strictly conditioned on `isUnlocked ? post.content : null`. Plaintext `password` is returned only if `isAdmin` (`post.password || ""`), otherwise `undefined`.
  - Lines 540–545: `POST /api/posts/:id/unlock` verifies `post.permissionType === "points_required"`. If not, returns 400 Bad Request (`"This post does not require points to unlock"`).
  - Lines 666–673: In `POST /api/posts/:id/unlock`, when points are deducted for a dual-gated post (points + password), `content` remains `null`, `isUnlocked` remains `false`, and `lockReason` is `"password_required"`.
- `server/src/core/auth.ts`:
  - Lines 103–160: `signPostGrant` and `verifyPostGrant` bind `postId`, `pv` (passwordVersion), and `userId`. Tokens with mismatched `postId`, stale `pv`, or mismatched `userId` return `false`.

### O4. Blob Storage ACL & Fail-Closed Observations
- `server/src/core/blob-handler.ts`:
  - Lines 38–76: Pre-R2 ACL iterates through `albumPhotos` and validates parent album status (`draft`, `permissionType`). Unauthorized anonymous requests return 401; unpurchased/draft user requests return 403.
  - Lines 79–154: Iterates through `posts` referencing the asset key in `image` or `content`. Checks `draft`, `permissionType`, and password grant. Missing/invalid grants return 403.
  - Lines 213–222: Unattached/unpublished asset gating: If asset has no published public reference and user is not admin, returns 403 Forbidden (`"Forbidden: Unattached or unpublished asset"`).
  - Lines 223–227: Catch block around database operations immediately returns 503 Service Unavailable (`"Media authorization backend unavailable"`), preventing R2 fetch on D1 error.
  - Line 231: `c.env.STORAGE.get(decodedKey)` is invoked **only after** all ACL checks pass.
  - Lines 242–245: Sensitive MIME types (SVG, HTML, XML) receive `Content-Security-Policy: default-src 'none'` and `Content-Disposition: attachment`.

### O5. EXIF/XMP Stripper Observations
- `server/src/utils/exif.ts`:
  - Lines 11–80: For `image/jpeg`, parses marker segments. Strips `0xFF 0xE1` (APP1 EXIF) and `0xFF 0xFE` (COM comments) while preserving `0xFF 0xE0` (APP0 JFIF), `0xFF 0xDA` (SOS), and compressed scan data.
  - Lines 138–198: For `image/webp`, parses RIFF FourCC chunks. Strips `EXIF` and `XMP ` chunks, clears bits 3 (0x08) and 2 (0x04) in the VP8X flags byte (`vp8xChunk[8] &= ~0x0c`), updates the RIFF 4-byte little-endian size, and preserves VP8 image data.
  - Lines 13–15, 46–58, 201–203: Malformed, truncated, or out-of-bounds segments are caught and safely returned without infinite loops or worker crashes.

### O6. JSON-LD XSS Escaping Observations
- `client/src/pages/posts/[...slug].astro` (lines 306–311) & `[...permalink].astro` (lines 316–321):
  ```typescript
  function serializeJsonLd(data: any): string {
    return JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  }
  ```
  All `<`, `>`, and `&` characters are replaced by unicode escape sequences `\u003c`, `\u003e`, and `\u0026`.

### O7. Turnstile Verification Observations
- `server/src/core/turnstile.ts`:
  - Lines 17–26: Turnstile is dynamically toggleable via `systemConfigs` table. When enabled, requires token (`if (!token) return { success: false, message: "Turnstile verification token is required" }`).
  - Lines 33–43: Authoritative secret key is prioritized from `c.env.CF_TURNSTILE_SECRET`, with fallback to DB `config.secretKey`. If neither is configured while enabled, returns fail-closed 400 (`"Turnstile is enabled but secret key is not configured"`).
  - Lines 54–67: Verifies token with `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Unverified/forged tokens return `{ success: false }`. Catch block fails closed with `{ success: false }`.

---

## 2. Logic Chain

1. **Password Gate Integrity**:
   - Observations O3 demonstrate that access to post content is strictly governed by `resolvePostAccess`.
   - In Adv 1.1–1.3, attempts to bypass the gate via direct GET, query strings (`?password=...`), or improper unlock requests (`POST /api/posts/:id/unlock` on free posts) yielded `content: null` and 400 Bad Request.
   - In Adv 1.4, points-deduction on dual-gated content properly satisfied the points requirement while leaving the password gate intact (`isUnlocked: false`, `content: null`).
   - In Adv 1.5–1.8, token replay across posts (Post A grant on Post B), forged signatures, old password versions (version revocation), and cross-user token reuse (Alice grant used by Bob) were all rejected because `verifyPostGrant` strictly validates `postId`, `pv`, and `userId`.
   - In Adv 1.9, post passwords are never exposed in JSON responses to unauthenticated visitors or regular users.
   - Therefore, the password protection mechanism cannot be bypassed by URL tampering, token replay, credential reuse, or points unlock.

2. **R2 Blob Pre-Authorization & Unattached Gating**:
   - Observation O4 confirms that `handleBlobStream` executes database ACL checks *before* calling `STORAGE.get()`.
   - In Adv 2.1–2.2, unattached files (not referenced by any published post, album, moment, page, or site config) return 403 Forbidden to anonymous visitors and regular users.
   - In Adv 2.3, path traversal payloads (`..%2F`, `/api/blob/sub/../../`) do not bypass gating.
   - In Adv 2.4–2.6, media attached to draft posts, draft albums, or password-protected posts are blocked unless the caller possesses adequate permissions (e.g., admin role or valid signed post grant).
   - In Adv 2.6, SVG files are forced to download via `Content-Disposition: attachment` and `nosniff`, preventing stored XSS.
   - Therefore, private and unattached blobs in R2 are fully protected against unauthorized retrieval.

3. **Fail-Closed Resiliency on Database Outage**:
   - Observation O4 (lines 223–227) shows that any database query exception during the ACL check triggers an immediate 503 response.
   - In Adv 3.1, closing the SQLite connection before requesting an asset resulted in HTTP 503 (`"Media authorization backend unavailable"`), with zero binary leakage from R2.
   - Therefore, failure of the D1 database layer fails closed and does not default to open storage access.

4. **Sanitization of EXIF/XMP Metadata**:
   - Observation O5 details the pure TypeScript byte parsing implementation.
   - In Adv 4.1, a dirty JPEG containing APP1 EXIF (TIFF structure with GPS IFD coordinates `37.7749° N, 122.4194° W`) and COM comment (`SN-998822`) had both segments stripped, while preserving APP0 JFIF, SOS, and compressed image data.
   - In Adv 4.2, a dirty WebP container containing EXIF and XMP chunks had both chunks removed, VP8X flags bits 3 and 2 cleared, RIFF size recalculated, and VP8 image frame preserved.
   - In Adv 4.3, malformed segment lengths (underflow and overflow) were caught and handled safely.
   - Therefore, uploaded media is sanitized against device privacy and GPS coordinate leakage.

5. **Neutralization of JSON-LD Script Breakouts**:
   - Observation O6 highlights unicode escaping in `serializeJsonLd`.
   - In Adv 5.1–5.3, injection payloads such as `</script><script>alert(1)</script>` and `<![CDATA[</script>]]>` were converted to safe unicode sequences (`\u003c/script\u003e`).
   - Browser tokenization simulation confirmed regex `/<\/script[\s>]/i` does not match, preventing script breakout XSS while preserving valid JSON-LD structure on `JSON.parse`.
   - Therefore, JSON-LD metadata rendering is immune to script breakout XSS.

6. **Turnstile Enforcement & Tampering Resistance**:
   - Observation O7 confirms dual-layer configuration and fail-closed secret fallback.
   - In Adv 6.1–6.4, missing tokens, empty tokens, forged dummy tokens, missing secret configurations, and parameter injection attempts (`turnstilePassed: true`) were all rejected with 400 Bad Request.
   - Therefore, the human verification gate cannot be bypassed by client-side forging or parameter tampering.

---

## 3. Caveats

- **Network Dependency for Live Turnstile Siteverify**: In local unit/mock environments, Turnstile verification relies on Cloudflare's test secrets or mock responses; live deployment requires Cloudflare network reachability to `challenges.cloudflare.com`.
- **R2 Storage Boundaries**: Pre-R2 ACL checks query D1 string patterns (`like %key%`). Object keys containing SQL wildcards (`%`, `_`) are handled by parameterized queries, but asset keys should follow standard slug/UUID conventions.
- No other caveats.

---

## 4. Conclusion

All six security threat vectors specified in the mission have been rigorously challenged and empirically verified using 26 automated adversarial test vectors in `test/adversarial/security-vectors.test.ts`.

- Password protection cannot be bypassed via queries, unlock endpoints, token replay, or forged credentials.
- Unattached and draft R2 media cannot be retrieved by unauthorized actors.
- D1 database failures fail closed with 503 without leaking R2 assets.
- EXIF/XMP GPS metadata and comments are stripped from JPEG and WebP images.
- JSON-LD script breakouts are escaped and neutralized.
- Turnstile verification fails closed against forged or missing tokens.
- Server type safety (`tsc --noEmit`) and client production build (`bun run build`) pass with exit code 0.
- Entire test suite (23 suites, 108 tests) achieves a 100% pass rate.

**Explicit Final Verdict**: **APPROVE**

---

## 5. Verification Method

To independently reproduce and verify all adversarial findings, execute the following commands from the project root (`d:\MiMo Desktop\项目\1\Shirine`):

```bash
# 1. Run the comprehensive scorecard test runner (includes Tier 1-5 & Adversarial Security)
bun test/run-all.ts

# 2. Run the native Bun test suite across all 25 files
bun test

# 3. Verify server TypeScript type-checking
cd server && bun run tsc --noEmit

# 4. Verify client Astro production build
cd client && bun run build
```

### Key Files for Inspection
- `test/adversarial/security-vectors.test.ts` — 26 adversarial penetration tests
- `server/src/routes/posts.ts` — Password verification & unlock gate logic
- `server/src/core/blob-handler.ts` — Pre-R2 ACL & 503 fail-closed logic
- `server/src/utils/exif.ts` — Pure-TS JPEG/WebP EXIF/XMP metadata stripper
- `server/src/core/turnstile.ts` — Turnstile verification with dual-layer fallback
- `client/src/pages/posts/[...slug].astro` — `serializeJsonLd` XSS escaping implementation
