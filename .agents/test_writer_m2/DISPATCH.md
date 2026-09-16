## 2026-09-16T11:01:19Z

# Dispatch to test_writer_m2 (Milestone 2: E2E Test Suite)

You are test_writer_m2.
Your working directory is: d:\MiMo Desktop\项目\1\Shirine\.agents\test_writer_m2
Your original request path is: d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md
Your scope document is: d:\MiMo Desktop\项目\1\Shirine\.agents\orchestrator_1\PROJECT.md

You MUST read d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusively Owned Files:
- You exclusively own `test/` directory, `d:\MiMo Desktop\项目\1\Shirine\TEST_INFRA.md`, and `d:\MiMo Desktop\项目\1\Shirine\TEST_READY.md`.
- You MUST NOT modify source code files under `client/src/` or `server/src/`.

Objectives:
1. Design and write a comprehensive, automated, standalone E2E test suite in `test/` (e.g., using Bun test or custom TypeScript runner with Bun) that tests the complete Shirine blog system against the 5 Acceptance Criteria and 9 Requirements:
   - AC 1: Zero occurrences of 'shirone' in all code/comments/configs/filenames, and workspace boundary check.
   - AC 2: Build validation (`server` tsc code 0, `client` build code 0) and dynamic SSR / O(1) post fetching check.
   - AC 3: Database schema integrity (17 tables), atomic transactions (`point_transactions` ledger), 3-tier content permissions, and CMS data modification.
   - AC 4: Security standards (Turnstile toggle & verification, post password verification via `POST /api/posts/:id/password/verify`, protected media pre-R2 ACL & fail-closed 503, EXIF/XMP stripping, JSON-LD escaping `< > &`).
   - AC 5: 4-language i18n exact text matching, 3-state navbar avatar dropdown, 20 anime WebP avatars (+ thumbnails & `avatars.json`), and `PUT /api/user/profile` update.
2. Structure the test cases across 4 Tiers:
   - Tier 1: Feature Coverage (>=5 test cases per feature area)
   - Tier 2: Boundary & Corner Cases (>=5 test cases per feature area: invalid input, duplicate checkin, negative balance, etc.)
   - Tier 3: Cross-Feature Combinations (auth + points + unlock + blob ACL + transaction log)
   - Tier 4: Real-World Scenarios (end-to-end user journeys & admin workflows)
3. Provide a single unified command to run the suite, e.g. `bun test` in project root or `bun run test:e2e`.
4. Create `TEST_INFRA.md` and `TEST_READY.md` at project root `d:\MiMo Desktop\项目\1\Shirine\`.
5. Run the test suite to verify the tests run properly, document test results in `handoff.md`, and report back.
