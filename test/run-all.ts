/**
 * Shirine Automated E2E Test Suite Runner
 * Executes all 4 tiers of test suites and prints a structured scorecard.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "..");

console.log("==================================================================");
console.log("          SHIRINE BLOG SYSTEM - 4-TIER E2E TEST SUITE            ");
console.log("==================================================================");
console.log(`Starting test execution at: ${new Date().toISOString()}`);
console.log(`Working directory: ${PROJECT_ROOT}\n`);

const testFiles = [
  // Tier 1: Feature Coverage
  { tier: "Tier 1", ac: "AC 1", file: "test/tier1-features/ac1-brand.test.ts", desc: "Brand Exclusivity & Workspace Boundary" },
  { tier: "Tier 1", ac: "AC 2", file: "test/tier1-features/ac2-build.test.ts", desc: "Build Validation & SSR Architecture" },
  { tier: "Tier 1", ac: "AC 3", file: "test/tier1-features/ac3-database.test.ts", desc: "Database Schema (17 Tables) & Ledger" },
  { tier: "Tier 1", ac: "AC 4", file: "test/tier1-features/ac4-security.test.ts", desc: "Security Standards (Turnstile/Password/Blob/EXIF)" },
  { tier: "Tier 1", ac: "AC 5", file: "test/tier1-features/ac5-avatar-i18n.test.ts", desc: "Avatar Grid & 4-Language i18n" },

  // Tier 2: Boundary & Corner Cases
  { tier: "Tier 2", ac: "Auth", file: "test/tier2-boundaries/auth-boundaries.test.ts", desc: "Authentication & Session Boundaries" },
  { tier: "Tier 2", ac: "Points", file: "test/tier2-boundaries/points-boundaries.test.ts", desc: "Points & Checkin Duplicate Boundaries" },
  { tier: "Tier 2", ac: "Content", file: "test/tier2-boundaries/content-boundaries.test.ts", desc: "Content Access & Permission Boundaries" },
  { tier: "Tier 2", ac: "Blob", file: "test/tier2-boundaries/blob-boundaries.test.ts", desc: "Blob Handler & 503 Fail-Closed" },
  { tier: "Tier 2", ac: "EXIF", file: "test/tier2-boundaries/exif-boundaries.test.ts", desc: "EXIF/XMP Stripper Robustness" },

  // Tier 3: Cross-Feature Combinations
  { tier: "Tier 3", ac: "Lifecycle", file: "test/tier3-combinations/user-lifecycle.test.ts", desc: "Complete User Lifecycle" },
  { tier: "Tier 3", ac: "Admin", file: "test/tier3-combinations/admin-governance.test.ts", desc: "Admin Governance & Dynamic Rules" },
  { tier: "Tier 3", ac: "Turnstile", file: "test/tier3-combinations/turnstile-lifecycle.test.ts", desc: "Turnstile Dual-Layer Toggle Lifecycle" },
  { tier: "Tier 3", ac: "Blob ACL", file: "test/tier3-combinations/blob-acl-cascade.test.ts", desc: "Blob ACL Cascade & Password Rotation" },

  // Tier 4: Real-World Scenarios
  { tier: "Tier 4", ac: "Visitor", file: "test/tier4-scenarios/visitor-to-member-journey.test.ts", desc: "Visitor to Active Member Journey" },
  { tier: "Tier 4", ac: "Editorial", file: "test/tier4-scenarios/admin-editorial-workflow.test.ts", desc: "Admin Editorial & Site Management" },
  { tier: "Tier 4", ac: "i18n", file: "test/tier4-scenarios/i18n-language-switch-workflow.test.ts", desc: "4-Language Switch & Translation Parity" },

  // Tier 5: Adversarial Concurrency & Ledger Integrity
  { tier: "Tier 5", ac: "Adv-Checkin", file: "test/adversarial/concurrency-checkin.test.ts", desc: "Adversarial Concurrency: Daily Check-in" },
  { tier: "Tier 5", ac: "Adv-Unlock", file: "test/adversarial/concurrency-unlock.test.ts", desc: "Adversarial Concurrency: Point Unlock & Overdraft" },
  { tier: "Tier 5", ac: "Adv-Ledger", file: "test/adversarial/ledger-consistency.test.ts", desc: "Adversarial Ledger: Consistency & Invariants" },
  { tier: "Tier 5", ac: "Adv-Boundaries", file: "test/adversarial/boundaries-injection.test.ts", desc: "Adversarial Boundaries: Points & Roles Injection" },
  { tier: "Tier 5", ac: "Adv-Revocation", file: "test/adversarial/session-revocation.test.ts", desc: "Adversarial Auth: Session Revocation & Invalidation" },
  { tier: "Tier 5", ac: "Adv-Security", file: "test/adversarial/security-vectors.test.ts", desc: "Adversarial Security: 6 Core Threat Vectors" },
];

let totalPassed = 0;
let totalFailed = 0;
const results: { tier: string; ac: string; desc: string; status: string; duration: string }[] = [];

for (const suite of testFiles) {
  process.stdout.write(`Running [${suite.tier} | ${suite.ac}] ${suite.desc}... `);
  const start = performance.now();
  const proc = spawnSync("bun", ["test", suite.file], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    env: process.env,
  });
  const duration = ((performance.now() - start) / 1000).toFixed(2);

  if (proc.status === 0) {
    console.log(`✓ PASS (${duration}s)`);
    totalPassed++;
    results.push({ ...suite, status: "PASS", duration: `${duration}s` });
  } else {
    console.log(`✗ FAIL (${duration}s)`);
    console.error(proc.stdout);
    console.error(proc.stderr);
    totalFailed++;
    results.push({ ...suite, status: "FAIL", duration: `${duration}s` });
  }
}

console.log("\n==================================================================");
console.log("                      TEST EXECUTION SUMMARY                      ");
console.log("==================================================================");
console.table(results);

console.log(`Total Suites: ${testFiles.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
if (totalFailed > 0) {
  console.log("\n❌ SOME TESTS FAILED.");
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY (100% PASS RATE).");
  process.exit(0);
}
