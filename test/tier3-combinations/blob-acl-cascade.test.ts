import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { schema } from "../../server/src/db";
import { eq } from "drizzle-orm";

describe("Tier 3 - Combination: Blob Pre-R2 ACL Cascade & Password Grant Invalidation", () => {
  it("Media access cascade: password verification -> grant cookie -> media access -> password rotation -> grant invalidation", async () => {
    const env = createTestEnv();
    const mediaKey = "classified-photo.jpg";
    await env.storage.put(mediaKey, new Uint8Array([0xff, 0xd8, 0x11, 0x22, 0xff, 0xd9]));

    // 1. Create password-protected post referencing mediaKey
    const post = await env.createPost({
      slug: "classified-dossier",
      title: "Classified Dossier",
      content: "Sensitive briefing document",
      encrypted: 1,
      password: "InitialPassword123!",
      passwordVersion: 1,
      permissionType: "public",
      image: `/api/blob/${mediaKey}`,
    });

    // 2. Unauthenticated request to media is forbidden (403)
    const blockedRes = await env.request(`/api/blob/${mediaKey}`);
    expect(blockedRes.status).toBe(403);
    const blockedText = await blockedRes.text();
    expect(blockedText).toContain("Password verification required");

    // 3. Verify password to obtain grant cookie
    const verifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "InitialPassword123!" }),
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.isUnlocked).toBe(true);

    const setCookie = verifyRes.headers.get("set-cookie") || "";
    expect(setCookie).toContain("shirine_post_grants=");
    const cookieMatch = setCookie.match(/shirine_post_grants=([^;]+)/);
    const cookieVal = cookieMatch ? cookieMatch[1] : "";

    // 4. Request media with valid grant cookie -> 200 OK
    const mediaRes = await env.request(`/api/blob/${mediaKey}`, {
      headers: {
        Cookie: `shirine_post_grants=${cookieVal}`,
      },
    });
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("cache-control")).toContain("no-store"); // Protected media has private no-store headers

    // 5. Admin rotates the post password, which increments passwordVersion to 2
    await env.db
      .update(schema.posts)
      .set({
        password: "NewRotatedPassword456!",
        passwordVersion: 2,
      })
      .where(eq(schema.posts.id, post.id));

    // 6. Old grant cookie must now fail with 403 (revoked due to passwordVersion mismatch)
    const expiredMediaRes = await env.request(`/api/blob/${mediaKey}`, {
      headers: {
        Cookie: `shirine_post_grants=${cookieVal}`,
      },
    });
    expect(expiredMediaRes.status).toBe(403);
    const expiredText = await expiredMediaRes.text();
    expect(expiredText).toContain("Invalid or expired password grant");

    // 7. Re-verify with new password
    const reVerifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "NewRotatedPassword456!" }),
    });
    expect(reVerifyRes.status).toBe(200);

    const newSetCookie = reVerifyRes.headers.get("set-cookie") || "";
    const newCookieMatch = newSetCookie.match(/shirine_post_grants=([^;]+)/);
    const newCookieVal = newCookieMatch ? newCookieMatch[1] : "";

    // 8. Access with new grant succeeds
    const reAccessRes = await env.request(`/api/blob/${mediaKey}`, {
      headers: {
        Cookie: `shirine_post_grants=${newCookieVal}`,
      },
    });
    expect(reAccessRes.status).toBe(200);

    env.close();
  });
});
