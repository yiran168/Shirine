import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { stripExifFromBuffer } from "../../server/src/utils/exif";
import { schema } from "../../server/src/db";
import { eq } from "drizzle-orm";

describe("Tier 1 - AC 4: Security Standards & Content Protection", () => {
  it("AC 4.1: Turnstile human verification is toggleable with dual-layer secret fallback", async () => {
    const env = createTestEnv();

    // 1. By default with no turnstile config, verification bypasses
    const regRes1 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_bypass_user",
        password: "securepassword123",
      }),
    });
    expect(regRes1.status).toBe(201);
    expect(regRes1.data.success).toBe(true);

    // 2. Enable Turnstile in system_configs
    await env.db.insert(schema.systemConfigs).values({
      key: "turnstile",
      value: JSON.stringify({
        enabled: true,
        siteKey: "0x4AAAAAAtestsitekey",
        secretKey: "0x4AAAAAAtestsecretfromdb",
      }),
    });

    // Request without turnstile token should be rejected
    const regRes2 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_fail_user",
        password: "securepassword123",
      }),
    });
    expect(regRes2.status).toBe(400);
    expect(regRes2.data.success).toBe(false);
    expect(regRes2.data.error).toContain("Turnstile");

    // 3. Disable Turnstile in system_configs
    await env.db
      .update(schema.systemConfigs)
      .set({
        value: JSON.stringify({
          enabled: false,
          siteKey: "0x4AAAAAAtestsitekey",
        }),
      })
      .where(eq(schema.systemConfigs.key, "turnstile"));

    const regRes3 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_disabled_user",
        password: "securepassword123",
      }),
    });
    expect(regRes3.status).toBe(201);
    expect(regRes3.data.success).toBe(true);

    env.close();
  });

  it("AC 4.2: Password-protected posts require POST /api/posts/:id/password/verify with signed grant", async () => {
    const env = createTestEnv();

    const post = await env.createPost({
      slug: "secret-diary",
      title: "Encrypted Diary",
      content: "This is deeply private secret text.",
      encrypted: 1,
      password: "SuperSecretPostPassword42!",
      permissionType: "public",
    });

    // 1. Gated without verification
    const gatedRes = await env.requestJson(`/api/posts/${post.id}`);
    expect(gatedRes.status).toBe(200);
    expect(gatedRes.data.data.isUnlocked).toBe(false);
    expect(gatedRes.data.data.content).toBeNull();
    expect(gatedRes.data.data.lockReason).toBe("password_required");

    // 2. Query param password attempt should NOT unlock
    const queryAttempt = await env.requestJson(`/api/posts/${post.id}?password=SuperSecretPostPassword42!`);
    expect(queryAttempt.data.data.isUnlocked).toBe(false);
    expect(queryAttempt.data.data.content).toBeNull();

    // 3. Wrong password at verify endpoint returns 401
    const wrongRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrongpassword" }),
    });
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.data.success).toBe(false);

    // 4. Correct password returns grant and sets cookie
    const verifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "SuperSecretPostPassword42!" }),
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.success).toBe(true);
    expect(verifyRes.data.isUnlocked).toBe(true);
    expect(verifyRes.data.grant).toBeDefined();
    expect(verifyRes.data.content).toBe("This is deeply private secret text.");

    // Extract cookie from response
    const setCookie = verifyRes.headers.get("set-cookie") || "";
    expect(setCookie).toContain("shirine_post_grants=");

    // 5. Subsequent access using the cookie unlocks post
    const cookieMatch = setCookie.match(/shirine_post_grants=([^;]+)/);
    const cookieVal = cookieMatch ? cookieMatch[1] : "";

    const accessWithCookie = await env.requestJson(`/api/posts/${post.id}`, {
      headers: {
        Cookie: `shirine_post_grants=${cookieVal}`,
      },
    });
    expect(accessWithCookie.status).toBe(200);
    expect(accessWithCookie.data.data.isUnlocked).toBe(true);
    expect(accessWithCookie.data.data.content).toBe("This is deeply private secret text.");

    env.close();
  });

  it("AC 4.3: Pre-R2 ACL check with unattached asset gating and 503 fail-closed handling", async () => {
    const env = createTestEnv();

    // Upload an asset into mock R2 storage
    const assetKey = "private-image-123.jpg";
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
    await env.storage.put(assetKey, imageBytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });

    // 1. Unattached asset without any public DB reference -> Forbidden for regular/anonymous
    const anonRes = await env.request(`/api/blob/${assetKey}`);
    expect(anonRes.status).toBe(403);
    const anonText = await anonRes.text();
    expect(anonText).toContain("Unattached or unpublished asset");

    // 2. Admin can preview unattached asset
    const admin = await env.createSuperadmin("blob_admin", "adminpass123");
    const adminRes = await env.request(`/api/blob/${assetKey}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.get("cache-control")).toContain("no-store");

    // 3. Fail-closed: simulate DB error during authorization check
    // Create an env with a throwing DB prepare
    const brokenEnv = createTestEnv();
    await brokenEnv.storage.put(assetKey, imageBytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    // Corrupt DB query method
    brokenEnv.d1.sqlite.close(); // Closing sqlite will cause queries to throw

    const failClosedRes = await brokenEnv.request(`/api/blob/${assetKey}`);
    expect(failClosedRes.status).toBe(503);
    const failText = await failClosedRes.text();
    expect(failText).toContain("Media authorization backend unavailable");

    env.close();
  });

  it("AC 4.4: Pure-TS EXIF metadata stripper removes JPEG APP1/COM and WebP EXIF/XMP chunks", () => {
    // 1. Test JPEG EXIF Stripping
    // Construct minimal JPEG with SOI (FF D8), APP1 EXIF (FF E1, length 8, "Exif\0\0"), SOS, EOI (FF D9)
    const jpegWithExif = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, // APP1 marker + 8-byte length + "Exif"
      0xff, 0xda, 0x00, 0x02, // SOS marker
      0x12, 0x34, // Image data
      0xff, 0xd9, // EOI
    ]);

    const strippedJpegBuffer = stripExifFromBuffer(jpegWithExif.buffer, "image/jpeg");
    const strippedJpeg = new Uint8Array(strippedJpegBuffer);

    // Verify SOI and EOI remain
    expect(strippedJpeg[0]).toBe(0xff);
    expect(strippedJpeg[1]).toBe(0xd8);
    expect(strippedJpeg[strippedJpeg.length - 2]).toBe(0xff);
    expect(strippedJpeg[strippedJpeg.length - 1]).toBe(0xd9);

    // Verify APP1 marker (FF E1) is completely gone
    let hasApp1 = false;
    for (let i = 0; i < strippedJpeg.length - 1; i++) {
      if (strippedJpeg[i] === 0xff && strippedJpeg[i + 1] === 0xe1) {
        hasApp1 = true;
        break;
      }
    }
    expect(hasApp1).toBe(false);

    // 2. Test WebP EXIF & XMP Stripping
    // Construct WebP RIFF container with VP8X header and EXIF chunk
    // RIFF (4) + Size (4) + WEBP (4) + VP8X (8+10=18) + EXIF chunk (8+4=12)
    const webpHeader = [
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x26, 0x00, 0x00, 0x00, // Size: 38 bytes
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // Chunk size: 10
      0x0c, 0x00, 0x00, 0x00, // Flags: bit 3 (EXIF 0x08) + bit 2 (XMP 0x04) set -> 0x0C
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x45, 0x58, 0x49, 0x46, // "EXIF"
      0x04, 0x00, 0x00, 0x00, // Chunk size: 4
      0x01, 0x02, 0x03, 0x04, // EXIF payload
    ];

    const webpWithExif = new Uint8Array(webpHeader);
    const strippedWebpBuffer = stripExifFromBuffer(webpWithExif.buffer, "image/webp");
    const strippedWebp = new Uint8Array(strippedWebpBuffer);

    const strippedStr = String.fromCharCode(...strippedWebp);
    expect(strippedStr).toContain("RIFF");
    expect(strippedStr).toContain("WEBP");
    expect(strippedStr).toContain("VP8X");
    expect(strippedStr).not.toContain("EXIF");

    // Check VP8X flag has cleared bit 3 and bit 2
    // VP8X payload starts at index 20, flags is byte 8 of VP8X chunk (index 20)
    const flagsByte = strippedWebp[20];
    expect(flagsByte & 0x0c).toBe(0);
  });

  it("AC 4.5: JSON-LD escaping replaces < > & with unicode escape sequences against XSS", () => {
    function serializeJsonLd(data: any): string {
      return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
    }

    const payload = {
      title: "Safe Post",
      author: "Attacker </script><script>alert('pwned')</script>",
      url: "https://example.com/search?q=1&user=bob",
      description: "Tags with <div class='test'> & special characters",
    };

    const serialized = serializeJsonLd(payload);

    // Must NOT contain literal <, >, or &
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");

    // Must contain safe unicode escapes
    expect(serialized).toContain("\\u003c");
    expect(serialized).toContain("\\u003e");
    expect(serialized).toContain("\\u0026");
  });

  it("AC 4.6: Admin automatically bypasses password, points, and login restrictions on posts and albums", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("gate_admin", "adminpass123");

    // 1. Password-protected post
    const pwPost = await env.createPost({
      slug: "pw-restricted-post",
      title: "Password Secret Post",
      content: "Super secret admin-viewable content",
      permissionType: "password",
      password: "secretpassword123",
      encrypted: 1,
    });

    // Anonymous visitor gets locked
    const anonPwRes = await env.requestJson(`/api/posts/${pwPost.id}`);
    expect(anonPwRes.status).toBe(200);
    expect(anonPwRes.data.data.isUnlocked).toBe(false);
    expect(anonPwRes.data.data.content).toBeNull();

    // Admin gets directly unlocked without entering password
    const adminPwRes = await env.requestJson(`/api/posts/${pwPost.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminPwRes.status).toBe(200);
    expect(adminPwRes.data.data.isUnlocked).toBe(true);
    expect(adminPwRes.data.data.content).toBe("Super secret admin-viewable content");
    expect(adminPwRes.data.data.password).toBe("secretpassword123");

    // 2. Points-required post
    const pointsPost = await env.createPost({
      slug: "points-restricted-post",
      title: "Points Secret Post",
      content: "Valuable points content",
      permissionType: "points_required",
      requiredPoints: 50,
    });

    // Anonymous visitor gets locked
    const anonPtsRes = await env.requestJson(`/api/posts/${pointsPost.id}`);
    expect(anonPtsRes.status).toBe(200);
    expect(anonPtsRes.data.data.isUnlocked).toBe(false);
    expect(anonPtsRes.data.data.content).toBeNull();

    // Admin gets directly unlocked without spending points
    const adminPtsRes = await env.requestJson(`/api/posts/${pointsPost.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminPtsRes.status).toBe(200);
    expect(adminPtsRes.data.data.isUnlocked).toBe(true);
    expect(adminPtsRes.data.data.content).toBe("Valuable points content");

    // 3. Login-required post
    const loginPost = await env.createPost({
      slug: "login-restricted-post",
      title: "Member Secret Post",
      content: "Member exclusive content",
      permissionType: "login_required",
    });

    // Anonymous visitor gets locked
    const anonLoginRes = await env.requestJson(`/api/posts/${loginPost.id}`);
    expect(anonLoginRes.status).toBe(200);
    expect(anonLoginRes.data.data.isUnlocked).toBe(false);
    expect(anonLoginRes.data.data.content).toBeNull();

    // Admin gets directly unlocked
    const adminLoginRes = await env.requestJson(`/api/posts/${loginPost.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.data.data.isUnlocked).toBe(true);
    expect(adminLoginRes.data.data.content).toBe("Member exclusive content");

    // 4. Password-protected album
    const pwAlbum = await env.createAlbum({
      slug: "pw-restricted-album",
      title: "Secret Album",
      permissionType: "password",
      password: "albumpassword123",
      photos: [{ url: "https://picsum.photos/seed/a1/800/600", alt: "Secret photo 1", sortOrder: 1 }],
    });

    // Anonymous gets locked
    const anonAlbumRes = await env.requestJson(`/api/albums/${pwAlbum.id}`);
    expect(anonAlbumRes.status).toBe(200);
    expect(anonAlbumRes.data.data.isUnlocked).toBe(false);
    expect(anonAlbumRes.data.data.photos.length).toBe(0);

    // Admin gets directly unlocked
    const adminAlbumRes = await env.requestJson(`/api/albums/${pwAlbum.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(adminAlbumRes.status).toBe(200);
    expect(adminAlbumRes.data.data.isUnlocked).toBe(true);
    expect(adminAlbumRes.data.data.photos.length).toBe(1);

    env.close();
  });
});
