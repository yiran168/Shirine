# Dispatch to explorer_survey_modules_security

You are explorer_survey_modules_security.
Working directory: d:\MiMo Desktop\项目\1\Shirine\.agents\explorer_survey_modules_security
Objective: Survey requirements, security standards, database schemas, and acceptance criteria.
Read d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md and d:\MiMo Desktop\项目\1\Shirine\PLAN.md.
Detail all technical requirements for R1-R9 and Acceptance Criteria 1-5, including Turnstile, password verification, fail-closed R2 blob handling, EXIF stripping, JSON-LD escaping, i18n 4 languages, navbar avatar & 20 anime WebP avatars, atomic transactions for points, and write report.md and handoff.md.

## 2026-09-16T10:53:23Z
You are explorer_survey_modules_security.
Your working directory is: d:\MiMo Desktop\项目\1\Shirine\.agents\explorer_survey_modules_security
Your original request path is: d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md
Your master plan path is: d:\MiMo Desktop\项目\1\Shirine\PLAN.md
Your dispatch instructions path is: d:\MiMo Desktop\项目\1\Shirine\.agents\explorer_survey_modules_security\DISPATCH.md

You MUST read d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md before starting work.

Mission:
Thoroughly examine all requirements and security specifications across ORIGINAL_REQUEST.md and PLAN.md:
1. Break down R1 through R9 and Acceptance Criteria 1 through 5 into granular, verifiable requirement items.
2. Security & Forensics specifications:
   - Turnstile verification: dual-layer, admin toggleable, site key & secret key handling, non-intrusive loading, reset on failure.
   - Password-protected posts: verification via `POST /api/posts/:id/password/verify`, no plaintext password in query, cannot bypass gate.
   - Protected media: authenticate before fetching from R2, new uploads private by default, fail-closed on D1 error.
   - EXIF/XMP stripping: stripping JPEG APP1 markers and WebP EXIF/XMP chunks for uploaded images.
   - JSON-LD XSS defense: escaping `< > &` against `</script>` injection.
3. User, Points & CMS specifications:
   - D1 tables & fields in `schema.sql` and `schema.ts`: users, posts, albums, signins, unlocks, point_transactions, site_configs, permissions.
   - Atomic transactions for point unlock, daily sign-in bonus (fixed or random range), admin point adjustment.
   - 3-tier content permissions: public, login-required, point-purchase. `CoverLockOverlay` and `PermissionBadge`.
   - CMS CRUD for all content (posts, albums, moments, friends, standalone pages, site config).
4. i18n & Avatar specifications:
   - 4 languages: zh_CN, zh_TW, en, ja exact text matching for visitor and admin.
   - Navbar circular avatar dropdown: 3 states (visitor, user, admin) with exact menu labels in 4 languages.
   - 20 anime WebP avatars library (full & thumbnail), grid selector, `PUT /api/user/profile` update.
5. Write your comprehensive report to `d:\MiMo Desktop\项目\1\Shirine\.agents\explorer_survey_modules_security\report.md` and a summary handoff to `d:\MiMo Desktop\项目\1\Shirine\.agents\explorer_survey_modules_security\handoff.md`.
Communicate back with send_message to orchestrator when finished.
