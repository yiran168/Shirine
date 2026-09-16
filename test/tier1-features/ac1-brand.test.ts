import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createTestEnv } from "../helpers/test-env";

const PROJECT_ROOT = resolve(__dirname, "../..");

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git" || file === ".agents" || file === "dist" || file === ".wrangler") {
      continue;
    }
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Tier 1 - AC 1: Brand Exclusivity & Workspace Boundary", () => {
  it("AC 1.1: Zero occurrences of 'shirone' in client/src and server/src source files", () => {
    const srcDirs = [
      resolve(PROJECT_ROOT, "client/src"),
      resolve(PROJECT_ROOT, "server/src"),
    ];

    const violations: { file: string; line: number; text: string }[] = [];

    for (const dir of srcDirs) {
      const files = getAllFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (/shirone/i.test(line)) {
            violations.push({ file, line: idx + 1, text: line.trim() });
          }
        });
      }
    }

    expect(violations).toHaveLength(0);
  });

  it("AC 1.2: Zero occurrences of 'shirone' in project configuration files", () => {
    const configFiles = [
      resolve(PROJECT_ROOT, "package.json"),
      resolve(PROJECT_ROOT, "client/package.json"),
      resolve(PROJECT_ROOT, "server/package.json"),
      resolve(PROJECT_ROOT, "client/astro.config.mjs"),
      resolve(PROJECT_ROOT, "server/wrangler.jsonc"),
      resolve(PROJECT_ROOT, "server/tsconfig.json"),
      resolve(PROJECT_ROOT, "client/tsconfig.json"),
    ];

    const violations: { file: string; text: string }[] = [];

    for (const file of configFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        if (/shirone/i.test(content)) {
          violations.push({ file, text: "Contains 'shirone'" });
        }
      } catch (err) {
        // File may be optional, but if present must be clean
      }
    }

    expect(violations).toHaveLength(0);
  });

  it("AC 1.3: Zero occurrences of 'shirone' in static asset filenames", () => {
    const assetDirs = [
      resolve(PROJECT_ROOT, "client/public/assets"),
    ];

    const violations: string[] = [];

    for (const dir of assetDirs) {
      const files = getAllFiles(dir);
      for (const file of files) {
        if (/shirone/i.test(file)) {
          violations.push(file);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  it("AC 1.4: Workspace boundary check - no hardcoded C: drive paths in source or configs", () => {
    const checkDirs = [
      resolve(PROJECT_ROOT, "client/src"),
      resolve(PROJECT_ROOT, "server/src"),
    ];

    const violations: { file: string; line: number; text: string }[] = [];

    for (const dir of checkDirs) {
      const files = getAllFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (/C:\\Users/i.test(line) || /C:\/Users/i.test(line)) {
            violations.push({ file, line: idx + 1, text: line.trim() });
          }
        });
      }
    }

    expect(violations).toHaveLength(0);
  });

  it("AC 1.5: Brand identity consistency across API health check and default configs", async () => {
    const env = createTestEnv();
    const res = await env.requestJson("/api/health");
    expect(res.status).toBe(200);
    expect(res.data.service).toBe("Shirine API");

    const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
    expect(packageJson.name).toBe("shirine");

    const serverPackageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "server/package.json"), "utf-8"));
    expect(serverPackageJson.name).toBe("shirine-server");

    env.close();
  });
});
