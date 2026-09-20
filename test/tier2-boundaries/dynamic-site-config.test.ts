import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { deepMerge } from "../../server/src/routes/config";
import { isEncryptedPost } from "../../client/src/utils/post-encryption";

describe("Tier 2 - Boundary: Dynamic Site Config & Post Encryption", () => {
  it("deepMerge: preserves arrays and does not convert them into dictionary objects", () => {
    const base = {
      title: "Shirine",
      list: [{ id: 1, name: "item1" }, { id: 2, name: "item2" }],
      nested: { a: 1, b: 2 },
    };
    const incoming = {
      list: [{ id: 3, name: "item3" }],
      nested: { b: 20, c: 30 },
    };
    const merged = deepMerge(base, incoming);
    expect(Array.isArray(merged.list)).toBe(true);
    expect(merged.list).toHaveLength(1);
    expect(merged.list[0].id).toBe(3);
    expect(merged.nested.a).toBe(1);
    expect(merged.nested.b).toBe(20);
    expect(merged.nested.c).toBe(30);
  });

  it("isEncryptedPost: resolves encryption status safely across edge cases without throwing", () => {
    // 1. null / undefined / empty
    expect(isEncryptedPost(null)).toBe(false);
    expect(isEncryptedPost(undefined)).toBe(false);
    expect(isEncryptedPost({})).toBe(false);

    // 2. encrypted flag without password (public SSR post list)
    expect(isEncryptedPost({ encrypted: true })).toBe(true);
    expect(isEncryptedPost({ encrypted: false })).toBe(false);

    // 3. requiresPassword / permissionType
    expect(isEncryptedPost({ requiresPassword: true })).toBe(true);
    expect(isEncryptedPost({ permissionType: "password" })).toBe(true);
    expect(isEncryptedPost({ permissionType: "public" })).toBe(false);

    // 4. password variations
    expect(isEncryptedPost({ password: "my-secret-password" })).toBe(true);
    expect(isEncryptedPost({ password: 123456 })).toBe(true);
    expect(isEncryptedPost({ password: "" })).toBe(false);
    expect(isEncryptedPost({ password: "   " })).toBe(false);
  });

  it("API: PUT & GET /api/config/site persists anime, compass, projects, devices, skills, and friendApplyInfo", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("site_admin", "adminpass123");

    // 1. Initial GET should return defaults
    const initialGet = await env.requestJson("/api/config/site");
    expect(initialGet.status).toBe(200);
    expect(initialGet.data.success).toBe(true);
    expect(Array.isArray(initialGet.data.data.projects)).toBe(true);
    expect(Array.isArray(initialGet.data.data.devices)).toBe(true);
    expect(Array.isArray(initialGet.data.data.skills)).toBe(true);
    expect(Array.isArray(initialGet.data.data.anime)).toBe(true);
    expect(Array.isArray(initialGet.data.data.compass)).toBe(true);
    expect(initialGet.data.data.friendApplyInfo).toBeDefined();

    // 2. Admin updates projects, devices, skills, compass, anime, and friendApplyInfo
    const updatePayload = {
      projects: [
        {
          key: "custom_proj_1",
          title: "Custom Project 1",
          summary: "A test project",
          category: "theme",
          phase: "shipped",
          technologies: ["TypeScript", "Svelte"],
          icon: "material-symbols:code",
          cover: "/assets/test.webp",
          featured: true,
          website: "https://shirine.pages.dev",
          repository: "https://github.com/yiran168/Shirine",
          year: "2026",
          enable: true,
        },
      ],
      devices: [
        {
          id: "custom_dev_1",
          name: "Workstation PC",
          brand: "Custom",
          category: "desk",
          status: "active",
          specs: "Ryzen 9 / 64GB",
          description: "Primary dev machine",
          icon: "material-symbols:desktop-windows-rounded",
          image: "/assets/pc.webp",
          featured: true,
          year: "2025",
          link: "https://example.com",
          enable: true,
        },
      ],
      skills: [
        {
          name: "Svelte 5",
          description: "Runes and signals",
          icon: "simple-icons:svelte",
          category: "frontend",
          level: "expert",
          enable: true,
        },
      ],
      compass: [
        {
          name: "Dev Tools",
          key: "dev",
          blurb: "Development tools",
          entries: [
            {
              label: "GitHub",
              href: "https://github.com",
              note: "Code host",
              icon: "fa6-brands:github",
            },
          ],
        },
      ],
      anime: [
        {
          id: 9999,
          title: "Frieren: Beyond Journey's End",
          cover: "/assets/anime/frieren.webp",
          status: "completed",
          rating: 10,
          progress: { watched: 28, total: 28 },
          year: "2024",
          season: "Fall",
        },
      ],
      friendApplyInfo: {
        name: "Shirine Author",
        url: "https://example.com",
        avatar: "https://example.com/avatar.webp",
        desc: "Custom friend link description",
      },
    };

    const putRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify(updatePayload),
    });
    expect(putRes.status).toBe(200);
    expect(putRes.data.success).toBe(true);

    // 3. GET /api/config/site reflects updated fields
    const getRes = await env.requestJson("/api/config/site");
    expect(getRes.status).toBe(200);
    expect(getRes.data.success).toBe(true);

    const data = getRes.data.data;
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].key).toBe("custom_proj_1");
    expect(data.projects[0].website).toBe("https://shirine.pages.dev");
    expect(data.projects[0].technologies).toEqual(["TypeScript", "Svelte"]);

    expect(data.devices).toHaveLength(1);
    expect(data.devices[0].id).toBe("custom_dev_1");
    expect(data.devices[0].image).toBe("/assets/pc.webp");

    expect(data.skills).toHaveLength(1);
    expect(data.skills[0].name).toBe("Svelte 5");

    expect(data.compass).toHaveLength(1);
    expect(data.compass[0].name).toBe("Dev Tools");
    expect(data.compass[0].entries[0].label).toBe("GitHub");

    expect(data.anime).toHaveLength(1);
    expect(data.anime[0].title).toBe("Frieren: Beyond Journey's End");

    expect(data.friendApplyInfo.name).toBe("Shirine Author");
    expect(data.friendApplyInfo.desc).toBe("Custom friend link description");

    // 4. Updating with empty arrays persists properly and does not resurrect defaults
    const clearRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        projects: [],
        anime: [],
      }),
    });
    expect(clearRes.status).toBe(200);
    expect(clearRes.data.success).toBe(true);

    const clearedGet = await env.requestJson("/api/config/site");
    expect(clearedGet.data.data.projects).toHaveLength(0);
    expect(clearedGet.data.data.anime).toHaveLength(0);
    // Other fields remained intact
    expect(clearedGet.data.data.devices).toHaveLength(1);

    env.close();
  });
});
