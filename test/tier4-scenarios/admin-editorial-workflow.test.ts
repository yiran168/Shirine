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

    // 10. Admin Moments Lifecycle: create -> update (edit) -> verify -> delete
    const createMomentRes = await env.requestJson("/api/moments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        content: "Working on Shirine blog engine today! ✨",
        mood: "💻",
        location: "Tokyo, Japan",
        photos: ["/assets/images/moment1.webp"],
        pinned: false,
      }),
    });
    expect(createMomentRes.status).toBe(200);
    expect(createMomentRes.data.success).toBe(true);
    const momentId = createMomentRes.data.data.id;

    // Admin edits/updates the moment content and pins it
    const updateMomentRes = await env.requestJson(`/api/moments/${momentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        content: "Shirine blog engine dynamic moments updated! 🌸",
        mood: "🎉",
        location: "Kyoto, Japan",
        photos: ["/assets/images/moment1.webp", "/assets/images/moment2.webp"],
        pinned: true,
      }),
    });
    expect(updateMomentRes.status).toBe(200);
    expect(updateMomentRes.data.success).toBe(true);
    expect(updateMomentRes.data.data.content).toBe("Shirine blog engine dynamic moments updated! 🌸");
    expect(updateMomentRes.data.data.mood).toBe("🎉");
    expect(updateMomentRes.data.data.location).toBe("Kyoto, Japan");
    expect(updateMomentRes.data.data.pinned).toBe(1);

    // Verify in public moments list
    const momentsListRes = await env.requestJson("/api/moments");
    expect(momentsListRes.status).toBe(200);
    const updatedMoment = momentsListRes.data.data.find((m: any) => m.id === momentId);
    expect(updatedMoment).toBeDefined();
    expect(updatedMoment.content).toBe("Shirine blog engine dynamic moments updated! 🌸");
    expect(updatedMoment.pinned).toBe(true);

    // Admin deletes the moment
    const deleteMomentRes = await env.requestJson(`/api/moments/${momentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
    });
    expect(deleteMomentRes.status).toBe(200);
    expect(deleteMomentRes.data.success).toBe(true);

    // Confirm deleted from moments list
    const afterDeleteRes = await env.requestJson("/api/moments");
    const foundDeleted = afterDeleteRes.data.data.find((m: any) => m.id === momentId);
    expect(foundDeleted).toBeUndefined();

    // 11. Admin Banner & Music Configuration Persistence in D1
    const bannerMusicUpdateRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        bannerDesktop: ["/assets/images/banner/custom-desktop.webp"],
        bannerMobile: ["/assets/images/banner/custom-mobile.webp"],
        bannerSubtitles: ["Shirine dynamic subtitle line 1", "Shirine dynamic subtitle line 2"],
        musicEnable: true,
        musicProvider: "mixed",
        musicVolume: 0.85,
        musicTracks: [
          {
            id: "track-test-1",
            title: "Shirine Theme Song",
            artist: "Shirine Ensemble",
            cover: "/assets/images/music/shirine.webp",
            source: "/assets/music/shirine.mp3",
            duration: 250,
          },
        ],
      }),
    });
    expect(bannerMusicUpdateRes.status).toBe(200);
    expect(bannerMusicUpdateRes.data.success).toBe(true);

    // Visitors see updated banners and music
    const updatedSiteRes = await env.requestJson("/api/config/site");
    expect(updatedSiteRes.status).toBe(200);
    const siteData = updatedSiteRes.data.data;
    expect(siteData.banner?.src?.desktop).toContain("/assets/images/banner/custom-desktop.webp");
    expect(siteData.banner?.src?.mobile).toContain("/assets/images/banner/custom-mobile.webp");
    expect(siteData.music?.enable).toBe(true);
    expect(siteData.music?.tracks?.[0]?.title).toBe("Shirine Theme Song");

    // 12. Admin Live2D Widget & Model Configuration Persistence & Public Propagation
    const live2dUpdateRes = await env.requestJson("/api/config/system", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        live2dGuestEnable: true,
        live2dAdminEnable: true,
        live2dModel: "/pio/models/CUSTOM/custom.model3.json",
      }),
    });
    expect(live2dUpdateRes.status).toBe(200);
    expect(live2dUpdateRes.data.success).toBe(true);

    // Public system config reflects updated Live2D model and guest enable state
    const publicSysRes = await env.requestJson("/api/config/system");
    expect(publicSysRes.status).toBe(200);
    expect(publicSysRes.data.data.live2dGuestEnabled).toBe(true);
    expect(publicSysRes.data.data.live2dModel).toBe("/pio/models/CUSTOM/custom.model3.json");

    // Admin system config reflects full Live2D settings
    const adminSysRes = await env.requestJson("/api/config/system/admin", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminSysRes.status).toBe(200);
    expect(adminSysRes.data.data.live2dGuestEnable).toBe(true);
    expect(adminSysRes.data.data.live2dAdminEnable).toBe(true);
    expect(adminSysRes.data.data.live2dModel).toBe("/pio/models/CUSTOM/custom.model3.json");

    env.close();
  });
});
