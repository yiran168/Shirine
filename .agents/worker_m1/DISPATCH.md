# Dispatch to worker_m1 (Milestone 1)

You are worker_m1.
Your working directory is: d:\MiMo Desktop\项目\1\Shirine\.agents\worker_m1
Your original request path is: d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md
Your scope document is: d:\MiMo Desktop\项目\1\Shirine\.agents\orchestrator_1\PROJECT.md

You MUST read d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusively Owned Files:
1. `client/public/assets/projects/`:
   - Rename `client/public/assets/projects/shirone.webp` to `client/public/assets/projects/shirine.webp`.
   - Also check `client/dist/` or other places to remove any stale `shirone.webp` artifacts.
   - Run a global search across all files to ensure strictly 0 occurrences of 'shirone' or 'Shirone'.
2. `client/src/components/organisms/CoverLockOverlay.svelte` and `client/src/components/atoms/PermissionBadge.svelte`:
   - Replace hardcoded Chinese strings with 4-language i18n support (zh_CN, zh_TW, en, ja) referencing existing i18n dictionaries or adding needed permission keys in `client/src/i18n/`.
3. `server/src/routes/user.ts`:
   - Add direct `GET /api/user/profile` alias returning the authenticated user's profile to align with `PLAN.md` and frontend expectation.
4. Validation & Verification:
   - Run `cd server && bun run tsc --noEmit` -> MUST exit with 0.
   - Run `cd client && bun run build` -> MUST exit with 0.
   - Document commands executed and exact outputs in your `handoff.md`.
