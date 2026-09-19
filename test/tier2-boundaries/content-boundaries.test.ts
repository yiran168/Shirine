import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 2 - Boundary: Content Access & Routing Edge Cases", () => {
  it("B2.1: Non-existent post ID returns 404 Not Found", async () => {
    const env = createTestEnv();
    const res = await env.requestJson("/api/posts/999999");
    expect(res.status).toBe(404);
    expect(res.data.success).toBe(false);
    env.close();
  });

  it("B2.2: Non-existent post slug returns 404 Not Found", async () => {
    const env = createTestEnv();
    const res = await env.requestJson("/api/posts/slug/does-not-exist-at-all");
    expect(res.status).toBe(404);
    expect(res.data.success).toBe(false);
    env.close();
  });

  it("B2.3: Non-existent album returns 404 Not Found", async () => {
    const env = createTestEnv();
    const res = await env.requestJson("/api/albums/999999");
    expect(res.status).toBe(404);
    expect(res.data.success).toBe(false);
    env.close();
  });

  it("B2.4: Draft post is inaccessible to unauthenticated visitors and regular users", async () => {
    const env = createTestEnv();
    const draftPost = await env.createPost({
      slug: "secret-draft-post",
      title: "Unpublished Draft",
      content: "Draft content",
      draft: 1,
    });

    // 1. Anonymous visitor gets 404
    const anonRes = await env.requestJson(`/api/posts/${draftPost.id}`);
    expect(anonRes.status).toBe(404);
    expect(anonRes.data.success).toBe(false);

    // 2. Regular user gets 404
    const user = await env.createUser("regular_visitor", "pass123456");
    const userRes = await env.requestJson(`/api/posts/${draftPost.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(userRes.status).toBe(404);
    expect(userRes.data.success).toBe(false);

    // 3. Admin CAN view draft post
    const admin = await env.createSuperadmin("draft_admin", "adminpass123");
    const adminRes = await env.requestJson(`/api/posts/${draftPost.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.data.success).toBe(true);
    expect(adminRes.data.data.content).toBe("Draft content");

    env.close();
  });

  it("B2.5: Password verify with overlong password (>128 chars) or missing payload returns 400", async () => {
    const env = createTestEnv();
    const post = await env.createPost({
      slug: "password-test",
      encrypted: 1,
      password: "validpass",
    });

    // Overlong password
    const overlong = "a".repeat(129);
    const resOverlong = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: overlong }),
    });
    expect(resOverlong.status).toBe(400);

    // Missing password
    const resMissing = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resMissing.status).toBe(400);

    env.close();
  });

  it("B2.6: Unlocking a post that does not require points returns 400", async () => {
    const env = createTestEnv();
    const user = await env.createUser("unlock_tester", "pass123456", 100);

    const publicPost = await env.createPost({
      slug: "public-unlock-test",
      permissionType: "public",
      content: "Already public",
    });

    const res = await env.requestJson(`/api/posts/${publicPost.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.error).toContain("does not require points");

    env.close();
  });

  it("B2.7: normalizeApiUrl correctly appends /api and trims slashes", async () => {
    const { normalizeApiUrl } = await import("../../client/src/services/api");

    expect(normalizeApiUrl("")).toBe("");
    expect(normalizeApiUrl("http://localhost:11498")).toBe("http://localhost:11498/api");
    expect(normalizeApiUrl("http://localhost:11498/")).toBe("http://localhost:11498/api");
    expect(normalizeApiUrl("http://localhost:11498/api")).toBe("http://localhost:11498/api");
    expect(normalizeApiUrl("http://localhost:11498/api/")).toBe("http://localhost:11498/api");
    expect(normalizeApiUrl("https://shirine-server.my.workers.dev")).toBe("https://shirine-server.my.workers.dev/api");
    expect(normalizeApiUrl("https://shirine-server.my.workers.dev/api/")).toBe("https://shirine-server.my.workers.dev/api");
  });

  it("B2.8: getAuthKey isolates auth tokens from arbitrary tracking/language cookies", async () => {
    const { getAuthKey } = await import("../../client/src/services/api");

    // Anonymous without cookies
    expect(getAuthKey()).toBe("anon");

    // Anonymous with arbitrary analytics and language cookies
    const reqWithMiscCookies = new Request("https://shirine.pages.dev/", {
      headers: { cookie: "shirine_lang=zh_CN; _ga=GA1.2.123; __cf_bm=456" },
    });
    expect(getAuthKey(reqWithMiscCookies)).toBe("anon");

    // Authenticated with cookie
    const reqWithTokenCookie = new Request("https://shirine.pages.dev/", {
      headers: { cookie: "shirine_lang=zh_CN; shirine_token=jwt_secret_token_123; _ga=GA1.2.123" },
    });
    expect(getAuthKey(reqWithTokenCookie)).toBe("token:jwt_secret_token_123");

    // Authenticated with Authorization header
    const reqWithAuthHeader = new Request("https://shirine.pages.dev/", {
      headers: { authorization: "Bearer bearer_token_xyz" },
    });
    expect(getAuthKey(reqWithAuthHeader)).toBe("Bearer bearer_token_xyz");
  });
});
