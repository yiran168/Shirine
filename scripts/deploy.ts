#!/usr/bin/env bun
/**
 * Shirine Cloudflare Full-Stack Deployment Runner
 *
 * Implements deterministic deployment parity with Rin:
 * 1. Resolves Cloudflare API credentials and target environment variables.
 * 2. Ensures D1 database exists (creates on Cloudflare if missing).
 * 3. Dynamically fetches the real Cloudflare D1 database UUID via `wrangler d1 list --json`.
 * 4. Ensures R2 storage bucket exists (creates on Cloudflare if missing).
 * 5. Injects the actual D1 UUID into server configuration (`server/wrangler.jsonc` & `server/wrangler.json`).
 * 6. Executes D1 database schema migration (`./src/db/schema.sql`) non-interactively with `-y`.
 * 7. Deploys the backend Cloudflare Worker (`shirine-server`).
 * 8. Synchronizes production secrets (e.g. JWT_SECRET) if provided.
 * 9. Builds and deploys the frontend Astro application to Cloudflare Pages.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const serverDir = path.join(rootDir, "server");
const clientDir = path.join(rootDir, "client");
const bunExec = process.execPath;

// Helper to extract and format env variables
const getEnv = (name: string, fallback = ""): string => {
  return (process.env[name] || fallback).trim();
};

const DB_NAME = getEnv("DB_NAME", "shirine-db");
const WORKER_NAME = getEnv("WORKER_NAME", "shirine-server");
const R2_BUCKET_NAME = getEnv("R2_BUCKET_NAME", "shirine-storage");
const PAGES_NAME = getEnv("PAGES_NAME", "shirine");
const PUBLIC_API_URL = getEnv("PUBLIC_API_URL", "");
const JWT_SECRET = getEnv("JWT_SECRET", "");
const PUBLIC_R2_URL = getEnv("PUBLIC_R2_URL", "");
const D1_DATABASE_ID = getEnv("D1_DATABASE_ID", "");
const CF_API_TOKEN = getEnv("CLOUDFLARE_API_TOKEN", getEnv("CF_API_TOKEN", ""));
const CF_ACCOUNT_ID = getEnv("CLOUDFLARE_ACCOUNT_ID", getEnv("CF_ACCOUNT_ID", ""));

// Check credentials before network calls
function checkCredentials(isPrepareOnly = false) {
  if (!CF_API_TOKEN) {
    if (process.env.CI) {
      console.error("\n❌ [Deploy Error] CLOUDFLARE_API_TOKEN environment variable is missing!");
      console.error("Please add CLOUDFLARE_API_TOKEN to your GitHub repository secrets:");
      console.error("Settings -> Secrets and variables -> Actions -> Repository secrets\n");
      process.exit(1);
    } else {
      console.warn("⚠️ [Deploy Warning] CLOUDFLARE_API_TOKEN is not set in environment. Wrangler will attempt to use cached local login.");
    }
  }
}

// Run wrangler with Bun runner
function runWrangler(args: string[], cwd: string = serverDir): { exitCode: number; stdout: string; stderr: string } {
  const envVars = {
    ...process.env,
    ...(CF_API_TOKEN ? { CLOUDFLARE_API_TOKEN: CF_API_TOKEN } : {}),
    ...(CF_ACCOUNT_ID ? { CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID } : {}),
  };

  const proc = Bun.spawnSync([bunExec, "run", "--cwd", cwd, "wrangler", ...args], {
    env: envVars,
    cwd,
  });

  return {
    exitCode: proc.exitCode ?? 1,
    stdout: proc.stdout ? proc.stdout.toString() : "",
    stderr: proc.stderr ? proc.stderr.toString() : "",
  };
}

// Strip comments for clean JSON parsing
function stripJsonComments(jsonc: string): string {
  return jsonc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// 1. Prepare Backend Configuration (D1 creation, UUID discovery, R2 creation, config patch)
export async function prepareBackendConfig(): Promise<string> {
  console.log(`\n🔍 [1/4] Preparing Cloudflare Backend Configuration...`);
  console.log(`   • Worker Name: ${WORKER_NAME}`);
  console.log(`   • D1 Database: ${DB_NAME}`);
  console.log(`   • R2 Bucket:   ${R2_BUCKET_NAME}`);

  checkCredentials(true);

  let resolvedUuid = D1_DATABASE_ID;

  if (!resolvedUuid) {
    // Attempt to create D1 database if not exists
    console.log(`📦 Checking D1 Database "${DB_NAME}"...`);
    const createResult = runWrangler(["d1", "create", DB_NAME]);

    if (createResult.exitCode === 0) {
      console.log(`✅ Created D1 database "${DB_NAME}"`);
      // Try to parse database_id from output
      const match = createResult.stdout.match(/database_id\s*=\s*"([0-9a-fA-F-]+)"/) ||
                    createResult.stdout.match(/"database_id":\s*"([0-9a-fA-F-]+)"/);
      if (match) {
        resolvedUuid = match[1];
      }
    } else {
      if (
        createResult.stderr.includes("already exists") ||
        createResult.stdout.includes("already exists") ||
        createResult.stderr.includes("already taken") ||
        createResult.stderr.includes("10021")
      ) {
        console.log(`ℹ️ D1 database "${DB_NAME}" already exists on Cloudflare.`);
      } else {
        console.warn(`⚠️ Note from D1 create: ${createResult.stderr.trim() || createResult.stdout.trim()}`);
      }
    }

    // Query D1 list to resolve real UUID
    if (!resolvedUuid) {
      console.log(`🔎 Resolving D1 UUID via "wrangler d1 list --json"...`);
      const listResult = runWrangler(["d1", "list", "--json"]);
      if (listResult.exitCode === 0 && listResult.stdout) {
        try {
          const list = JSON.parse(listResult.stdout) as Array<{ name: string; uuid: string }>;
          const match = list.find((item) => item.name === DB_NAME);
          if (match && match.uuid) {
            resolvedUuid = match.uuid;
          }
        } catch (err) {
          console.warn(`⚠️ Failed to parse wrangler d1 list JSON: ${(err as Error).message}`);
        }
      }
    }
  }

  // Ensure R2 bucket exists
  if (R2_BUCKET_NAME) {
    console.log(`🪣 Checking R2 Bucket "${R2_BUCKET_NAME}"...`);
    const r2Result = runWrangler(["r2", "bucket", "create", R2_BUCKET_NAME]);
    if (r2Result.exitCode === 0) {
      console.log(`✅ Created R2 bucket "${R2_BUCKET_NAME}"`);
    } else if (
      r2Result.stderr.includes("already exists") ||
      r2Result.stdout.includes("already exists")
    ) {
      console.log(`ℹ️ R2 bucket "${R2_BUCKET_NAME}" already exists.`);
    } else {
      console.warn(`⚠️ Note from R2 bucket create: ${r2Result.stderr.trim() || r2Result.stdout.trim()}`);
    }
  }

  // Update server/wrangler.jsonc and server/wrangler.json
  const wranglerJsoncPath = path.join(serverDir, "wrangler.jsonc");
  const wranglerJsonPath = path.join(serverDir, "wrangler.json");

  if (existsSync(wranglerJsoncPath)) {
    let content = readFileSync(wranglerJsoncPath, "utf-8");

    if (resolvedUuid) {
      console.log(`🆔 Injecting resolved D1 UUID: ${resolvedUuid}`);
      content = content.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${resolvedUuid}"`);
    } else {
      console.warn(`⚠️ Warning: Could not resolve Cloudflare D1 UUID. Retaining existing config value.`);
    }

    if (DB_NAME) {
      content = content.replace(/"database_name":\s*"[^"]*"/, `"database_name": "${DB_NAME}"`);
    }
    if (WORKER_NAME) {
      content = content.replace(/"name":\s*"[^"]*"/, `"name": "${WORKER_NAME}"`);
    }
    if (R2_BUCKET_NAME) {
      content = content.replace(/"bucket_name":\s*"[^"]*"/, `"bucket_name": "${R2_BUCKET_NAME}"`);
    }
    if (PUBLIC_R2_URL) {
      content = content.replace(/"PUBLIC_R2_URL":\s*"[^"]*"/, `"PUBLIC_R2_URL": "${PUBLIC_R2_URL}"`);
    }

    writeFileSync(wranglerJsoncPath, content, "utf-8");
    console.log(`📝 Updated server/wrangler.jsonc successfully.`);

    // Also write a sanitized server/wrangler.json for maximum tool compatibility
    try {
      const cleanJson = JSON.parse(stripJsonComments(content));
      writeFileSync(wranglerJsonPath, JSON.stringify(cleanJson, null, 2), "utf-8");
      console.log(`📝 Generated server/wrangler.json successfully.`);
    } catch {
      // Ignored if comment stripping is incomplete
    }
  }

  return resolvedUuid;
}

// 2. Run D1 Database Migration
export async function migrateDatabase(): Promise<void> {
  console.log(`\n🚀 [2/4] Executing D1 Database Schema Migration...`);
  const schemaFile = "./src/db/schema.sql";
  const absSchemaFile = path.join(serverDir, "src", "db", "schema.sql");

  if (!existsSync(absSchemaFile)) {
    throw new Error(`Schema file not found at: ${absSchemaFile}`);
  }

  console.log(`   • Target Database: ${DB_NAME}`);
  console.log(`   • SQL File:        ${schemaFile}`);
  console.log(`   • Command:         wrangler d1 execute ${DB_NAME} --remote --file=${schemaFile} -y`);

  const res = runWrangler(["d1", "execute", DB_NAME, "--remote", `--file=${schemaFile}`, "-y"], serverDir);

  if (res.exitCode === 0) {
    console.log(`✅ Database migration completed successfully!`);
    if (res.stdout) console.log(res.stdout.trim());
  } else {
    console.error(`❌ Migration failed with exit code ${res.exitCode}:`);
    if (res.stdout) console.error(res.stdout.trim());
    if (res.stderr) console.error(res.stderr.trim());
    // If in CI, do not swallow migration errors unless explicitly specified
    if (process.env.STRICT_MIGRATION === "true") {
      process.exit(1);
    } else {
      console.warn(`⚠️ Continuing deployment (schema may already be up to date or partly initialized).`);
    }
  }
}

// 3. Deploy Backend Worker
export async function deployServer(): Promise<void> {
  console.log(`\n⚡ [3/4] Deploying Backend Worker to Cloudflare Workers...`);

  await prepareBackendConfig();
  await migrateDatabase();

  console.log(`🚀 Running "wrangler deploy" in ./server ...`);
  const deployRes = runWrangler(["deploy"], serverDir);

  if (deployRes.exitCode !== 0) {
    console.error(`❌ Worker deployment failed:`);
    if (deployRes.stdout) console.error(deployRes.stdout.trim());
    if (deployRes.stderr) console.error(deployRes.stderr.trim());
    process.exit(deployRes.exitCode);
  }

  console.log(`✅ Backend Worker deployed successfully!`);
  if (deployRes.stdout) {
    console.log(deployRes.stdout.trim());
  }

  // Sync secrets if JWT_SECRET was supplied
  if (JWT_SECRET && JWT_SECRET !== "dev_fallback_jwt_secret_please_set_in_wrangler_secrets") {
    console.log(`🔐 Synchronizing JWT_SECRET secret...`);
    const secretProc = Bun.spawnSync([bunExec, "run", "--cwd", serverDir, "wrangler", "secret", "put", "JWT_SECRET", "--name", WORKER_NAME], {
      stdin: Buffer.from(JWT_SECRET),
      env: {
        ...process.env,
        ...(CF_API_TOKEN ? { CLOUDFLARE_API_TOKEN: CF_API_TOKEN } : {}),
        ...(CF_ACCOUNT_ID ? { CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID } : {}),
      },
    });
    if (secretProc.exitCode === 0) {
      console.log(`✅ JWT_SECRET synchronized.`);
    } else {
      console.warn(`⚠️ Could not sync JWT_SECRET: ${secretProc.stderr?.toString().trim()}`);
    }
  }
}

// 4. Deploy Frontend Client (Cloudflare Pages)
export async function deployClient(): Promise<void> {
  console.log(`\n🌐 [4/4] Building and Deploying Frontend to Cloudflare Pages...`);
  console.log(`   • Project Name:   ${PAGES_NAME}`);
  console.log(`   • PUBLIC_API_URL: ${PUBLIC_API_URL || "(relative /api fallback)"}`);

  // Build client with Bun
  console.log(`🔨 Building client Astro project...`);
  const buildProc = Bun.spawnSync([bunExec, "run", "build"], {
    cwd: clientDir,
    env: {
      ...process.env,
      PUBLIC_API_URL: PUBLIC_API_URL,
    },
    stdout: "inherit",
    stderr: "inherit",
  });

  if (buildProc.exitCode !== 0) {
    console.error(`❌ Client build failed with exit code ${buildProc.exitCode}`);
    process.exit(buildProc.exitCode ?? 1);
  }
  console.log(`✅ Client built successfully into ./client/dist`);

  // Deploy to Cloudflare Pages
  console.log(`🚀 Deploying ./client/dist to Cloudflare Pages project "${PAGES_NAME}"...`);
  const pagesRes = runWrangler(["pages", "deploy", "dist", `--project-name=${PAGES_NAME}`], clientDir);

  if (pagesRes.exitCode !== 0) {
    console.error(`❌ Cloudflare Pages deployment failed:`);
    if (pagesRes.stdout) console.error(pagesRes.stdout.trim());
    if (pagesRes.stderr) console.error(pagesRes.stderr.trim());
    process.exit(pagesRes.exitCode);
  }

  console.log(`✅ Frontend deployed successfully to Cloudflare Pages!`);
  if (pagesRes.stdout) {
    console.log(pagesRes.stdout.trim());
  }
}

// Main CLI dispatch
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--prepare")) {
    await prepareBackendConfig();
    return;
  }

  if (args.includes("--migrate")) {
    await migrateDatabase();
    return;
  }

  if (args.includes("--server")) {
    await deployServer();
    return;
  }

  if (args.includes("--client")) {
    await deployClient();
    return;
  }

  // Default: Deploy both server and client
  console.log(`====================================================`);
  console.log(`🌸 Starting Shirine Full-Stack Cloudflare Deployment`);
  console.log(`====================================================`);
  await deployServer();
  await deployClient();
  console.log(`\n🎉 Shirine full-stack deployment completed successfully!`);
}

main().catch((err) => {
  console.error(`\n❌ Deployment encountered fatal error:`, err);
  process.exit(1);
});
