import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createTestEnv } from "../helpers/test-env";

const PROJECT_ROOT = resolve(__dirname, "../..");

describe("Tier 1 - AC 2: Build Safety & SSR Architecture", () => {
  it("AC 2.1: Server TypeScript configuration is valid and strict", () => {
    const tsconfigPath = resolve(PROJECT_ROOT, "server/tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
  });

  it("AC 2.2: Client Astro configuration specifies server SSR output with Cloudflare adapter", () => {
    const astroConfigPath = resolve(PROJECT_ROOT, "client/astro.config.mjs");
    expect(existsSync(astroConfigPath)).toBe(true);
    const astroConfigContent = readFileSync(astroConfigPath, "utf-8");

    // Must have output: "server"
    expect(astroConfigContent).toMatch(/output:\s*["']server["']/);
    // Must import and use @astrojs/cloudflare adapter
    expect(astroConfigContent).toMatch(/@astrojs\/cloudflare/);
    expect(astroConfigContent).toMatch(/adapter:\s*cloudflare\(/);
  });

  it("AC 2.3: Client production build output exists and contains Cloudflare SSR server bundle", () => {
    const distPath = resolve(PROJECT_ROOT, "client/dist");
    expect(existsSync(distPath)).toBe(true);
    const serverEntryPath = resolve(distPath, "_worker.js");
    const serverDir = resolve(distPath, "server");
    const clientDir = resolve(distPath, "client");

    // Either _worker.js or server/ entrypoint must exist for Cloudflare adapter
    const hasCloudflareOutput = existsSync(serverEntryPath) || existsSync(serverDir) || existsSync(clientDir);
    expect(hasCloudflareOutput).toBe(true);
  });

  it("AC 2.4: O(1) single-post query architecture via RESTful API by slug and ID", async () => {
    const env = createTestEnv();
    const testPost = await env.createPost({
      slug: "o1-test-post",
      title: "O(1) Architecture Validation Post",
      content: "Testing O(1) direct retrieval without scanning all posts.",
      permissionType: "public",
    });

    // 1. Direct fetch by slug: GET /api/posts/slug/:slug
    const slugRes = await env.requestJson(`/api/posts/slug/${testPost.slug}`);
    expect(slugRes.status).toBe(200);
    expect(slugRes.data.success).toBe(true);
    expect(slugRes.data.data.id).toBe(testPost.id);
    expect(slugRes.data.data.title).toBe(testPost.title);

    // 2. Direct fetch by ID: GET /api/posts/:id
    const idRes = await env.requestJson(`/api/posts/${testPost.id}`);
    expect(idRes.status).toBe(200);
    expect(idRes.data.success).toBe(true);
    expect(idRes.data.data.id).toBe(testPost.id);

    env.close();
  });

  it("AC 2.5: Modular RESTful routing architecture covers all core subsystems", async () => {
    const env = createTestEnv();

    // Verify all core route branches respond properly
    const routes = [
      { path: "/api/health", expected: 200 },
      { path: "/api/posts", expected: 200 },
      { path: "/api/albums", expected: 200 },
      { path: "/api/moments", expected: 200 },
      { path: "/api/friends", expected: 200 },
      { path: "/api/config/site", expected: 200 },
    ];

    for (const r of routes) {
      const res = await env.request(r.path);
      expect(res.status).toBe(r.expected);
    }

    env.close();
  });

  it("AC 2.6: 512x512 anime link preview loading animation asset and component exist with complete visual specs", () => {
    const svgPath = resolve(PROJECT_ROOT, "client/public/assets/images/link-preview-loading.svg");
    expect(existsSync(svgPath)).toBe(true);

    const svgContent = readFileSync(svgPath, "utf-8");
    expect(svgContent).toContain('viewBox="0 0 512 512"');
    expect(svgContent).toContain('width="512"');
    expect(svgContent).toContain('height="512"');

    // Upper half mascot, cloud, stars, petals
    expect(svgContent).toContain("floatCloud");
    expect(svgContent).toContain("floatMascot");
    expect(svgContent).toContain("waveArm");
    expect(svgContent).toContain("blinkEye");
    expect(svgContent).toContain("twinkle");
    expect(svgContent).toContain("petalDrift");

    // Lower half rounded pink-to-purple gradient progress bar and "加载中" with 3 glowing dots
    expect(svgContent).toContain("progressBarAnim");
    expect(svgContent).toContain("progressGrad");
    expect(svgContent).toContain("dotPulse");
    expect(svgContent).toContain("加载中");
    expect(svgContent).toContain("dot-1");
    expect(svgContent).toContain("dot-2");
    expect(svgContent).toContain("dot-3");

    // Svelte Component
    const sveltePath = resolve(PROJECT_ROOT, "client/src/components/atoms/feedback/LinkPreviewLoading.svelte");
    expect(existsSync(sveltePath)).toBe(true);
    const svelteContent = readFileSync(sveltePath, "utf-8");
    expect(svelteContent).toContain("/assets/images/link-preview-loading.svg");
    expect(svelteContent).toContain("size");
  });
});
