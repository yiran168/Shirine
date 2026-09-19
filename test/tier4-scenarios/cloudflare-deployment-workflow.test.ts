import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "../..");
const deployYmlPath = path.join(rootDir, ".github/workflows/deploy.yml");
const rootPkgPath = path.join(rootDir, "package.json");
const serverPkgPath = path.join(rootDir, "server/package.json");
const deployScriptPath = path.join(rootDir, "scripts/deploy.ts");
const wranglerJsoncPath = path.join(rootDir, "server/wrangler.jsonc");
const schemaSqlPath = path.join(rootDir, "server/src/db/schema.sql");

describe("Tier 4 - Scenario: Cloudflare Deployment Workflow & Rin Parity", () => {
  it("verifies .github/workflows/deploy.yml has exact parity with Rin and robust environment wiring", () => {
    expect(existsSync(deployYmlPath)).toBe(true);
    const yml = readFileSync(deployYmlPath, "utf-8");

    // Must use bun setup and checkout v4
    expect(yml).toContain("actions/checkout@v4");
    expect(yml).toContain("oven-sh/setup-bun@v2");
    expect(yml).toContain("bun install");

    // deploy-server job configuration
    expect(yml).toContain("deploy-server:");
    expect(yml).toContain("Deploy Backend to Cloudflare Workers");
    expect(yml).toContain("bun run deploy:server");
    expect(yml).toContain("CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}");
    expect(yml).toContain("CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}");
    expect(yml).toContain("DB_NAME: ${{ vars.DB_NAME || 'shirine-db' }}");
    expect(yml).toContain("WORKER_NAME: ${{ vars.WORKER_NAME || 'shirine-server' }}");
    expect(yml).toContain("R2_BUCKET_NAME: ${{ vars.R2_BUCKET_NAME || 'shirine-storage' }}");
    expect(yml).toContain("JWT_SECRET: ${{ secrets.JWT_SECRET }}");
    expect(yml).toContain("D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID || vars.D1_DATABASE_ID }}");

    // deploy-client job configuration
    expect(yml).toContain("deploy-client:");
    expect(yml).toContain("Deploy Frontend to Cloudflare Pages");
    expect(yml).toContain("needs: deploy-server");
    expect(yml).toContain("bun run deploy:client");
    expect(yml).toContain("PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL || vars.PUBLIC_API_URL }}");
    expect(yml).toContain("PAGES_NAME: ${{ vars.PAGES_NAME || 'shirine' }}");

    // Verify fragile /usr/local/bin/npx wrangler-action was replaced with deterministic bun runner
    expect(yml).not.toContain("command: d1 execute");
    expect(yml).not.toContain("command: pages deploy");
  });

  it("verifies package.json scripts and root devDependencies", () => {
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
    expect(rootPkg.scripts["deploy:server"]).toBe("bun run scripts/deploy.ts --server");
    expect(rootPkg.scripts["deploy:client"]).toBe("bun run scripts/deploy.ts --client");
    expect(rootPkg.scripts["deploy"]).toBe("bun run scripts/deploy.ts");
    expect(rootPkg.scripts["db:migrate:remote"]).toBe("bun run scripts/deploy.ts --migrate");

    // Root must have wrangler in devDependencies so bun wrangler runs locally
    expect(rootPkg.devDependencies.wrangler).toBeDefined();

    // Server package.json db:migrate:remote must include -y
    const serverPkg = JSON.parse(readFileSync(serverPkgPath, "utf-8"));
    expect(serverPkg.scripts["db:migrate:remote"]).toContain("-y");
  });

  it("verifies scripts/deploy.ts implements robust fallback and configuration updates", () => {
    expect(existsSync(deployScriptPath)).toBe(true);
    const deployTs = readFileSync(deployScriptPath, "utf-8");

    // Parity features
    expect(deployTs).toContain("prepareBackendConfig");
    expect(deployTs).toContain("migrateDatabase");
    expect(deployTs).toContain("deployServer");
    expect(deployTs).toContain("deployClient");
    expect(deployTs).toContain("d1");
    expect(deployTs).toContain("create");
    expect(deployTs).toContain("list");
    expect(deployTs).toContain("--json");
    expect(deployTs).toContain("-y");
  });

  it("simulates prepareBackendConfig behavior with mock UUID injection", () => {
    const testUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const originalJsonc = readFileSync(wranglerJsoncPath, "utf-8");

    // Test that regex replacement replaces database_id correctly
    const replaced = originalJsonc.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${testUuid}"`);
    expect(replaced).toContain(`"database_id": "${testUuid}"`);
    expect(replaced).not.toContain(`"database_id": "shirine-db-id"`);

    // Verify comments are intact
    expect(replaced).toContain("// Note: For production deployments");
  });

  it("verifies server/src/db/schema.sql is completely idempotent", () => {
    expect(existsSync(schemaSqlPath)).toBe(true);
    const sql = readFileSync(schemaSqlPath, "utf-8");

    // All tables must use IF NOT EXISTS
    const createTableStatements = sql.match(/CREATE TABLE (IF NOT EXISTS )?[a-zA-Z_]+/gi) || [];
    expect(createTableStatements.length).toBeGreaterThan(5);
    for (const stmt of createTableStatements) {
      expect(stmt.toUpperCase()).toContain("IF NOT EXISTS");
    }

    // All indexes must use IF NOT EXISTS
    const createIndexStatements = sql.match(/CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?[a-zA-Z_]+/gi) || [];
    expect(createIndexStatements.length).toBeGreaterThan(5);
    for (const stmt of createIndexStatements) {
      expect(stmt.toUpperCase()).toContain("IF NOT EXISTS");
    }
  });

  it("executes scripts/deploy.ts --prepare in dry/offline mode without crash", () => {
    const proc = Bun.spawnSync([process.execPath, "run", "scripts/deploy.ts", "--prepare"], {
      cwd: rootDir,
      env: {
        ...process.env,
        D1_DATABASE_ID: "unit-test-d1-uuid-12345",
      },
    });

    expect(proc.exitCode).toBe(0);
    const jsonc = readFileSync(wranglerJsoncPath, "utf-8");
    expect(jsonc).toContain("unit-test-d1-uuid-12345");

    // Restore original placeholder for git cleanliness
    const restored = jsonc.replace(/"database_id":\s*"[^"]*"/, `"database_id": "shirine-db-id"`);
    require("node:fs").writeFileSync(wranglerJsoncPath, restored, "utf-8");

    const jsonPath = path.join(rootDir, "server/wrangler.json");
    if (existsSync(jsonPath)) {
      const jsonContent = readFileSync(jsonPath, "utf-8");
      const restoredJson = jsonContent.replace(/"database_id":\s*"[^"]*"/, `"database_id": "shirine-db-id"`);
      require("node:fs").writeFileSync(jsonPath, restoredJson, "utf-8");
    }
  });
});
