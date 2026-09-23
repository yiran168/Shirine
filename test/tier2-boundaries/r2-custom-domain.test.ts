import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 2 - Boundary: Cloudflare R2 Public Domain / Custom Domain Persistence", () => {
  it("uses env.PUBLIC_R2_URL fallback when no custom domain is configured in D1", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin1", "adminpass123");

    // Put a test object into storage
    await env.storage.put("uploads/test-image.png", new Uint8Array([1, 2, 3]));

    // List via GET /api/upload
    const res = await env.requestJson("/api/upload", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.objects).toHaveLength(1);
    // env.PUBLIC_R2_URL is "http://localhost/api/blob" in test-env
    expect(res.data.objects[0].url).toBe("http://localhost/api/blob/uploads/test-image.png");

    // Initial GET /api/config/system/admin should have empty publicR2Url and reflect fallback
    const sysAdminRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(sysAdminRes.status).toBe(200);
    expect(sysAdminRes.data.data.publicR2Url).toBe("");
    expect(sysAdminRes.data.data.fallbackR2Url).toBe("http://localhost/api/blob");
    expect(sysAdminRes.data.data.effectivePublicR2Url).toBe("http://localhost/api/blob");

    env.close();
  });

  it("persists publicR2Url via PUT /api/config/site and reflects in GET /api/config/site and GET /api/config/system/admin", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin2", "adminpass123");

    // 1. Initial GET
    const initSite = await env.requestJson("/api/config/site");
    expect(initSite.status).toBe(200);

    // 2. PUT /api/config/site with publicR2Url
    const putRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "https://assets.shirine.moe",
      }),
    });
    expect(putRes.status).toBe(200);
    expect(putRes.data.success).toBe(true);

    // 3. GET /api/config/site reflects publicR2Url
    const siteRes = await env.requestJson("/api/config/site");
    expect(siteRes.status).toBe(200);
    expect(siteRes.data.data.publicR2Url).toBe("https://assets.shirine.moe");
    expect(siteRes.data.data.effectivePublicR2Url).toBe("https://assets.shirine.moe");

    // 4. GET /api/config/system/admin reflects publicR2Url
    const sysAdminRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(sysAdminRes.status).toBe(200);
    expect(sysAdminRes.data.data.publicR2Url).toBe("https://assets.shirine.moe");

    env.close();
  });

  it("persists publicR2Url via PUT /api/config/system and normalizes trailing slashes", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin3", "adminpass123");

    // PUT /api/config/system with trailing slash
    const putRes = await env.requestJson("/api/config/system", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "https://cdn.shirine.moe/",
      }),
    });
    expect(putRes.status).toBe(200);
    expect(putRes.data.success).toBe(true);

    // Both endpoints return normalized URL without trailing slash
    const siteRes = await env.requestJson("/api/config/site");
    expect(siteRes.data.data.publicR2Url).toBe("https://cdn.shirine.moe");

    const sysAdminRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(sysAdminRes.data.data.publicR2Url).toBe("https://cdn.shirine.moe");

    env.close();
  });

  it("applies custom R2 domain immediately to media library listing and upload outputs", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin4", "adminpass123");

    // Configure custom domain
    await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "https://media.shirine.moe",
      }),
    });

    // 1. Put an existing object in storage and list media
    await env.storage.put("uploads/cover-test.webp", new Uint8Array([1, 2, 3]));
    const listRes = await env.requestJson("/api/upload", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(listRes.status).toBe(200);
    expect(listRes.data.objects).toHaveLength(1);
    expect(listRes.data.objects[0].url).toBe("https://media.shirine.moe/uploads/cover-test.webp");

    // 2. Perform a real file upload with valid PNG signature
    // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const formData = new FormData();
    const file = new File([pngBytes], "test-avatar.png", { type: "image/png" });
    formData.append("file", file);

    const uploadRes = await env.request("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
      body: formData,
    });
    expect(uploadRes.status).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.url.startsWith("https://media.shirine.moe/uploads/")).toBe(true);
    expect(uploadData.url.endsWith(".png")).toBe(true);

    env.close();
  });

  it("allows clearing publicR2Url back to empty string, cleanly reverting settings and upload URLs to fallback", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin5", "adminpass123");

    // 1. Set a custom domain
    await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        title: "My Blog",
        publicR2Url: "https://custom.shirine.moe",
      }),
    });

    const configuredSite = await env.requestJson("/api/config/site");
    expect(configuredSite.data.data.publicR2Url).toBe("https://custom.shirine.moe");

    // 2. Clear custom domain via PUT /api/config/system
    const clearRes = await env.requestJson("/api/config/system", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "",
      }),
    });
    expect(clearRes.status).toBe(200);

    // 3. GET /api/config/system/admin must reflect empty string (not fallback)
    const sysAdminRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(sysAdminRes.data.data.publicR2Url).toBe("");
    expect(sysAdminRes.data.data.fallbackR2Url).toBe("http://localhost/api/blob");
    expect(sysAdminRes.data.data.effectivePublicR2Url).toBe("http://localhost/api/blob");

    // 4. GET /api/upload must fall back to env.PUBLIC_R2_URL
    await env.storage.put("uploads/reverted.png", new Uint8Array([1, 2, 3]));
    const listRes = await env.requestJson("/api/upload", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(listRes.status).toBe(200);
    const revertedObj = listRes.data.objects.find((o: any) => o.key === "uploads/reverted.png");
    expect(revertedObj).toBeDefined();
    expect(revertedObj.url).toBe("http://localhost/api/blob/uploads/reverted.png");

    env.close();
  });

  it("sanitizes dangerous schemes and auto-prefixes scheme-less domains", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("r2_admin6", "adminpass123");

    // 1. Submit scheme-less domain
    const autoPrefixRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "assets.shirine.moe/subpath/",
      }),
    });
    expect(autoPrefixRes.status).toBe(200);

    const siteRes = await env.requestJson("/api/config/site");
    expect(siteRes.data.data.publicR2Url).toBe("https://assets.shirine.moe/subpath");

    // 2. Submit dangerous scheme javascript:
    const xssRes = await env.requestJson("/api/config/system", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        publicR2Url: "javascript:alert(document.cookie)",
      }),
    });
    expect(xssRes.status).toBe(200);

    const sysAdminRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    // Dangerous scheme normalized to empty string
    expect(sysAdminRes.data.data.publicR2Url).toBe("");

    env.close();
  });
});
