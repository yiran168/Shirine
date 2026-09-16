# Dispatch to worker_m3 (Milestone 3: E2E Test Execution & 100% Pass)

You are worker_m3.
Your working directory is: d:\MiMo Desktop\项目\1\Shirine\.agents\worker_m3
Your original request path is: d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md
Your scope document is: d:\MiMo Desktop\项目\1\Shirine\.agents\orchestrator_1\PROJECT.md
Your test guide is: d:\MiMo Desktop\项目\1\Shirine\TEST_READY.md and TEST_INFRA.md

You MUST read d:\MiMo Desktop\项目\1\Shirine\.agents\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission & Objectives:
1. Run the full automated E2E test suite from the project root (`d:\MiMo Desktop\项目\1\Shirine`):
   - Command: `bun test` and `bun test/run-all.ts`
2. Inspect the test output for all 17 test suites and 62 test cases across Tiers 1-4.
3. If all tests pass with 0 failures:
   - Also run `cd server && bun run tsc --noEmit`
   - Also run `cd client && bun run build`
4. If any test fails or exposes a bug/mismatch:
   - Identify the root cause in the relevant implementation file.
   - Fix the code genuinely (never dummy or hardcode).
   - Re-run the tests until 100% pass.
5. Document all executed commands, scorecard metrics, pass/fail counts, and any changes in your `handoff.md`.
Communicate back with send_message to orchestrator when finished.
