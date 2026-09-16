import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 4 - Scenario: Admin Editorial & Site Management Workflow", () => {
  it("Executes end-to-end admin workflow: draft creation -> media preview -> publish -> site configuration update", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("editor_in_chief", "chiefpass123");

    // 1. Admin uploads hero image to storage
    const heroImageKey = "uploads/2026/09/editorial-banner.webp";
    const fakeWebpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    await env.storage.put(heroImageKey, fakeWebpBytes, {
      httpMetadata: { contentType: "image/webp" },
    });

    // 2. Admin creates a new draft post
    const createPostRes = await env.requestJson("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        slug: "announcing-shirine-v2",
        title: "Announcing Shirine Blog System",
        content: "We are thrilled to present Shirine, built for high performance and aesthetics.",
        category: "Announcements",
        tags: ["release", "shirine"],
        image: `/api/blob/${heroImageKey}`,
        draft: 1, // Created as draft
      }),
    });
    expect(createPostRes.status).toBe(201);
    expect(createPostRes.data.success).toBe(true);
    const postId = createPostRes.data.data.id;

    // 3. Media is associated with draft post only -> Regular visitor cannot access it (403)
    const visitorMediaRes = await env.request(`/api/blob/${heroImageKey}`);
    expect(visitorMediaRes.status).toBe(403);
    const visitorText = await visitorMediaRes.text();
    expect(visitorText).toContain("Draft post media is unpublished");

    // Admin CAN preview the draft media
    const adminMediaRes = await env.request(`/api/blob/${heroImageKey}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminMediaRes.status).toBe(200);

    // 4. Draft post is hidden from visitor feed
    const visitorFeedRes = await env.requestJson("/api/posts");
    const foundInFeed = visitorFeedRes.data.data.find((p: any) => p.id === postId);
    expect(foundInFeed).toBeUndefined();

    // 5. Admin publishes the draft post (setting draft = 0)
    const publishRes = await env.requestJson(`/api/posts/${postId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        draft: 0,
      }),
    });
    expect(publishRes.status).toBe(200);

    // 6. Post is now visible in the visitor feed
    const newFeedRes = await env.requestJson("/api/posts");
    const publishedPost = newFeedRes.data.data.find((p: any) => p.id === postId);
    expect(publishedPost).toBeDefined();
    expect(publishedPost.title).toBe("Announcing Shirine Blog System");

    // 7. Hero media is now publicly accessible
    const publicMediaRes = await env.request(`/api/blob/${heroImageKey}`);
    expect(publicMediaRes.status).toBe(200);

    // 8. Admin updates site branding & configuration
    const configRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        title: "Shirine - The Dynamic Anime Blog",
        subtitle: "Fast, Elegant, and Modern",
        announcement: "Welcome to the newly launched Shirine blog!",
      }),
    });
    expect(configRes.status).toBe(200);
    expect(configRes.data.success).toBe(true);

    // 9. Visitors immediately see updated site configuration
    const siteConfigRes = await env.requestJson("/api/config/site");
    expect(siteConfigRes.status).toBe(200);
    expect(siteConfigRes.data.data.title).toBe("Shirine - The Dynamic Anime Blog");
    expect(siteConfigRes.data.data.subtitle).toBe("Fast, Elegant, and Modern");

    env.close();
  });
});
