import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { stripExifFromBuffer } from "../../server/src/utils/exif";
import { schema } from "../../server/src/db";
import { eq } from "drizzle-orm";
import { signPostGrant } from "../../server/src/core/auth";

describe("Adversarial: Security & API Stress Verification", () => {
  // =========================================================================
  // AREA 1: Password Gate Bypass & Tampering Attacks
  // =========================================================================
  describe("Area 1: Password Gate Bypass & Tampering Attacks", () => {
    it("Adv 1.1: Direct GET on password-protected post without grant shields content", async () => {
      const env = createTestEnv();
      const post = await env.createPost({
        slug: "classified-intel-01",
        title: "Top Secret Intel",
        content: "RESTRICTED CONTENT: The nuclear launch codes are 00000000.",
        encrypted: 1,
        password: "OperationValkyrie2026!",
        permissionType: "public",
      });

      // 1. Direct GET by ID
      const resById = await env.requestJson(`/api/posts/${post.id}`);
      expect(resById.status).toBe(200);
      expect(resById.data.data.isUnlocked).toBe(false);
      expect(resById.data.data.lockReason).toBe("password_required");
      expect(resById.data.data.content).toBeNull();

      // 2. Direct GET by Slug
      const resBySlug = await env.requestJson(`/api/posts/slug/${post.slug}`);
      expect(resBySlug.status).toBe(200);
      expect(resBySlug.data.data.isUnlocked).toBe(false);
      expect(resBySlug.data.data.lockReason).toBe("password_required");
      expect(resBySlug.data.data.content).toBeNull();

      env.close();
    });

    it("Adv 1.2: URL query parameter injection (?password=... or ?grant=...) fails to unlock", async () => {
      const env = createTestEnv();
      const post = await env.createPost({
        slug: "query-tamper-post",
        content: "Top Secret Payload via Query Attack",
        encrypted: 1,
        password: "CorrectPassword123!",
        permissionType: "public",
      });

      const attempts = [
        `/api/posts/${post.id}?password=CorrectPassword123!`,
        `/api/posts/${post.id}?pwd=CorrectPassword123!`,
        `/api/posts/${post.id}?grant=dummy`,
        `/api/posts/${post.id}?token=dummy`,
        `/api/posts/slug/${post.slug}?password=CorrectPassword123!`,
      ];

      for (const url of attempts) {
        const res = await env.requestJson(url);
        expect(res.status).toBe(200);
        expect(res.data.data.isUnlocked).toBe(false);
        expect(res.data.data.content).toBeNull();
      }

      env.close();
    });

    it("Adv 1.3: Calling /unlock on non-points password-protected post is rejected with 400", async () => {
      const env = createTestEnv();
      const user = await env.createUser("bypass_hacker", "pass123456", 100);

      const post = await env.createPost({
        slug: "free-password-post",
        content: "Super secret free post",
        encrypted: 1,
        password: "FreeSecretPassword99!",
        permissionType: "public", // Does NOT require points
        requiredPoints: 0,
      });

      const res = await env.requestJson(`/api/posts/${post.id}/unlock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // Must return 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain("does not require points");

      // Verify content is NOT revealed
      expect(res.data.content).toBeUndefined();

      env.close();
    });

    it("Adv 1.4: Dual-gate post (points + password) stays locked after points unlock without password grant", async () => {
      const env = createTestEnv();
      const user = await env.createUser("dual_gate_user", "pass123456", 50);

      const post = await env.createPost({
        slug: "dual-gate-post",
        content: "Double Encrypted Classified Intelligence",
        permissionType: "points_required",
        requiredPoints: 10,
        encrypted: 1,
        password: "VaultPassword777!",
      });

      // Step 1: User unlocks with points
      const unlockRes = await env.requestJson(`/api/posts/${post.id}/unlock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.data.success).toBe(true);
      expect(unlockRes.data.remainingPoints).toBe(40);
      // Even though points were deducted, isUnlocked MUST be false and content MUST be null!
      expect(unlockRes.data.isUnlocked).toBe(false);
      expect(unlockRes.data.lockReason).toBe("password_required");
      expect(unlockRes.data.content).toBeNull();

      // Step 2: Querying post detail before password verify also returns null content
      const detailRes = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(detailRes.status).toBe(200);
      expect(detailRes.data.data.isPurchased).toBe(true); // Purchased gate satisfied
      expect(detailRes.data.data.isUnlocked).toBe(false); // BUT password gate not satisfied
      expect(detailRes.data.data.content).toBeNull();
      expect(detailRes.data.data.lockReason).toBe("password_required");

      // Step 3: Now verify the password
      const verifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "VaultPassword777!" }),
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.data.success).toBe(true);
      expect(verifyRes.data.isUnlocked).toBe(true);
      expect(verifyRes.data.content).toBe("Double Encrypted Classified Intelligence");

      env.close();
    });

    it("Adv 1.5: Cross-post token replay (token substitution attack) is strictly rejected", async () => {
      const env = createTestEnv();

      // Post A
      const postA = await env.createPost({
        slug: "post-alpha",
        content: "Secret Alpha Content",
        encrypted: 1,
        password: "PasswordAlpha!",
        permissionType: "public",
      });

      // Post B
      const postB = await env.createPost({
        slug: "post-beta",
        content: "Secret Beta Content",
        encrypted: 1,
        password: "PasswordBeta!",
        permissionType: "public",
      });

      // Attacker verifies Post A password legitimately
      const verifyResA = await env.requestJson(`/api/posts/${postA.id}/password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "PasswordAlpha!" }),
      });
      expect(verifyResA.status).toBe(200);
      const grantA = verifyResA.data.grant;
      expect(grantA).toBeDefined();

      // Attacker attempts to use Post A's grant on Post B via X-Post-Grant header
      const attackResHeader = await env.requestJson(`/api/posts/${postB.id}`, {
        headers: { "X-Post-Grant": grantA },
      });
      expect(attackResHeader.status).toBe(200);
      expect(attackResHeader.data.data.isUnlocked).toBe(false);
      expect(attackResHeader.data.data.content).toBeNull();

      // Attacker attempts to use Post A's grant for Post B in cookie map
      const cookieMap = encodeURIComponent(JSON.stringify({ [postB.id.toString()]: grantA }));
      const attackResCookie = await env.requestJson(`/api/posts/${postB.id}`, {
        headers: { Cookie: `shirine_post_grants=${cookieMap}` },
      });
      expect(attackResCookie.status).toBe(200);
      expect(attackResCookie.data.data.isUnlocked).toBe(false);
      expect(attackResCookie.data.data.content).toBeNull();

      env.close();
    });

    it("Adv 1.6: Forged or tampered JWT grants are rejected", async () => {
      const env = createTestEnv();
      const post = await env.createPost({
        slug: "forged-jwt-post",
        content: "Protected Secret Data",
        encrypted: 1,
        password: "RealPassword42!",
      });

      // 1. JWT signed with evil secret
      const forgedToken = await signPostGrant(
        post.id,
        1,
        null,
        "evil-attacker-secret-key-32bytes!"
      );

      const resForged = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { "X-Post-Grant": forgedToken },
      });
      expect(resForged.data.data.isUnlocked).toBe(false);
      expect(resForged.data.data.content).toBeNull();

      // 2. JWT with purpose mismatch (login token used as post grant)
      const user = await env.createUser("token_user", "pass123456", 0);
      const resWrongPurpose = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { "X-Post-Grant": user.token },
      });
      expect(resWrongPurpose.data.data.isUnlocked).toBe(false);
      expect(resWrongPurpose.data.data.content).toBeNull();

      // 3. Garbage token
      const resGarbage = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { "X-Post-Grant": "malformed.jwt.token.string" },
      });
      expect(resGarbage.data.data.isUnlocked).toBe(false);
      expect(resGarbage.data.data.content).toBeNull();

      env.close();
    });

    it("Adv 1.7: Password version invalidation immediately invalidates prior grants", async () => {
      const env = createTestEnv();
      const post = await env.createPost({
        slug: "rotating-post",
        content: "Rotating Secret Content",
        encrypted: 1,
        password: "OldPassword111!",
        passwordVersion: 1,
      });

      // Verify old password and receive grant
      const verifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "OldPassword111!" }),
      });
      expect(verifyRes.status).toBe(200);
      const grant = verifyRes.data.grant;

      // Access succeeds initially
      const accessBefore = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { "X-Post-Grant": grant },
      });
      expect(accessBefore.data.data.isUnlocked).toBe(true);
      expect(accessBefore.data.data.content).toBe("Rotating Secret Content");

      // Admin updates password and increments passwordVersion to 2
      await env.db
        .update(schema.posts)
        .set({
          password: "NewRotatedPassword222!",
          passwordVersion: 2,
        })
        .where(eq(schema.posts.id, post.id));

      // Attempt access with old grant (pv: 1)
      const accessAfter = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { "X-Post-Grant": grant },
      });
      expect(accessAfter.data.data.isUnlocked).toBe(false);
      expect(accessAfter.data.data.content).toBeNull();
      expect(accessAfter.data.data.lockReason).toBe("password_required");

      env.close();
    });

    it("Adv 1.8: Cross-user grant hijacking between authenticated accounts is blocked", async () => {
      const env = createTestEnv();
      const userAlice = await env.createUser("alice_sec", "passwordAlice123!", 0);
      const userBob = await env.createUser("bob_sec", "passwordBob123!", 0);

      const post = await env.createPost({
        slug: "user-bound-post",
        content: "Alice's Verified Secret",
        encrypted: 1,
        password: "AliceVerifiedPass!",
      });

      // Alice verifies password while logged in
      const aliceVerify = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAlice.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "AliceVerifiedPass!" }),
      });
      expect(aliceVerify.status).toBe(200);
      const aliceGrant = aliceVerify.data.grant;

      // Bob tries to use Alice's grant while authenticated as Bob
      const bobAccess = await env.requestJson(`/api/posts/${post.id}`, {
        headers: {
          Authorization: `Bearer ${userBob.token}`,
          "X-Post-Grant": aliceGrant,
        },
      });
      // Verification must fail because grant userId (Alice) does not match Bob
      expect(bobAccess.data.data.isUnlocked).toBe(false);
      expect(bobAccess.data.data.content).toBeNull();

      env.close();
    });

    it("Adv 1.9: Plaintext password is never exposed in API responses to non-admin", async () => {
      const env = createTestEnv();
      const post = await env.createPost({
        slug: "confidential-pass-post",
        title: "Confidential",
        content: "Private words",
        encrypted: 1,
        password: "SuperSecretPasswordDoNotLeak!",
      });

      // 1. Anonymous visitor
      const anonRes = await env.requestJson(`/api/posts/${post.id}`);
      expect(anonRes.data.data.password).toBeUndefined();

      // 2. Regular user
      const user = await env.createUser("regular_viewer", "pass123", 0);
      const userRes = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(userRes.data.data.password).toBeUndefined();

      // 3. Admin user CAN see password for management
      const admin = await env.createSuperadmin("admin_checker", "adminpass");
      const adminRes = await env.requestJson(`/api/posts/${post.id}`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      expect(adminRes.data.data.password).toBe("SuperSecretPasswordDoNotLeak!");

      env.close();
    });
  });

  // =========================================================================
  // AREA 2: Unattached & Private Blob Retrieval from R2
  // =========================================================================
  describe("Area 2: Unattached & Private Blob Retrieval from R2", () => {
    it("Adv 2.1: Anonymous visitor cannot retrieve unattached R2 asset (403 Forbidden)", async () => {
      const env = createTestEnv();
      const key = "uploads/2026/09/isolated-private-file.png";
      await env.storage.put(key, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      const res = await env.request(`/api/blob/${key}`);
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toContain("Unattached or unpublished asset");

      env.close();
    });

    it("Adv 2.2: Regular authenticated user cannot retrieve unattached R2 asset (403 Forbidden)", async () => {
      const env = createTestEnv();
      const user = await env.createUser("regular_bob", "pass123456", 100);
      const key = "uploads/2026/09/isolated-backup.zip";
      await env.storage.put(key, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

      const res = await env.request(`/api/blob/${key}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toContain("Unattached or unpublished asset");

      env.close();
    });

    it("Adv 2.3: Path traversal attempt in blob key does not bypass ACL", async () => {
      const env = createTestEnv();
      const key = "secret-file.dat";
      await env.storage.put(key, new Uint8Array([1, 2, 3]));

      const traversalUrls = [
        "/api/blob/..%2Fsecret-file.dat",
        "/api/blob/%2e%2e%2fsecret-file.dat",
        "/api/blob/sub/../../secret-file.dat",
      ];

      for (const url of traversalUrls) {
        const res = await env.request(url);
        // Must be rejected with 400, 403, or 404, never 200 leaking data
        expect([400, 403, 404]).toContain(res.status);
      }

      env.close();
    });

    it("Adv 2.4: Media attached to draft post is blocked for anonymous and regular users", async () => {
      const env = createTestEnv();
      const mediaKey = "draft-post-graphic.png";
      await env.storage.put(mediaKey, new Uint8Array([1, 2, 3, 4]));

      await env.createPost({
        slug: "unpublished-draft-post",
        draft: 1, // DRAFT
        image: `/api/blob/${mediaKey}`,
      });

      // Anonymous -> 403
      const anonRes = await env.request(`/api/blob/${mediaKey}`);
      expect(anonRes.status).toBe(403);
      expect(await anonRes.text()).toContain("Draft post media is unpublished");

      // Regular user -> 403
      const user = await env.createUser("draft_sniffer", "pass123", 0);
      const userRes = await env.request(`/api/blob/${mediaKey}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(userRes.status).toBe(403);

      // Admin -> 200
      const admin = await env.createSuperadmin("draft_admin", "adminpass");
      const adminRes = await env.request(`/api/blob/${mediaKey}`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      expect(adminRes.status).toBe(200);

      env.close();
    });

    it("Adv 2.5: Media attached to draft album is blocked for anonymous and regular users", async () => {
      const env = createTestEnv();
      const photoKey = "album-draft-photo.webp";
      await env.storage.put(photoKey, new Uint8Array([5, 6, 7, 8]));

      const album = await env.createAlbum({
        title: "Unpublished Secret Album",
        draft: 1,
      });

      await env.db.insert(schema.albumPhotos).values({
        albumId: album.id,
        url: `/api/blob/${photoKey}`,
      });

      // 1. Anonymous visitor -> 401 (Authentication required)
      const anonRes = await env.request(`/api/blob/${photoKey}`);
      expect(anonRes.status).toBe(401);
      expect(await anonRes.text()).toContain("Authentication required");

      // 2. Regular user -> 403 (Draft album media is unpublished)
      const user = await env.createUser("album_draft_viewer", "pass123", 0);
      const userRes = await env.request(`/api/blob/${photoKey}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(userRes.status).toBe(403);
      expect(await userRes.text()).toContain("Draft album media is unpublished");

      // 3. Admin user -> 200 OK
      const admin = await env.createSuperadmin("album_draft_admin", "adminpass");
      const adminRes = await env.request(`/api/blob/${photoKey}`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      expect(adminRes.status).toBe(200);

      env.close();
    });

    it("Adv 2.6: Media in password-protected post requires valid password grant token", async () => {
      const env = createTestEnv();
      const mediaKey = "classified-chart.svg";
      await env.storage.put(mediaKey, new Uint8Array([9, 10, 11, 12]), {
        httpMetadata: { contentType: "image/svg+xml" },
      });

      const post = await env.createPost({
        slug: "classified-post-with-media",
        content: `Check this image: /api/blob/${mediaKey}`,
        encrypted: 1,
        password: "ClassifiedPassword555!",
      });

      // 1. Without grant -> 403
      const resNoGrant = await env.request(`/api/blob/${mediaKey}`);
      expect(resNoGrant.status).toBe(403);
      expect(await resNoGrant.text()).toContain("Password verification required");

      // 2. With invalid grant -> 403
      const resBadGrant = await env.request(`/api/blob/${mediaKey}`, {
        headers: { "X-Post-Grant": "invalid.jwt.grant" },
      });
      expect(resBadGrant.status).toBe(403);

      // 3. Obtain valid grant
      const verifyRes = await env.requestJson(`/api/posts/${post.id}/password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "ClassifiedPassword555!" }),
      });
      expect(verifyRes.status).toBe(200);
      const grant = verifyRes.data.grant;

      // 4. Access with valid grant -> 200 OK
      const resValidGrant = await env.request(`/api/blob/${mediaKey}`, {
        headers: { "X-Post-Grant": grant },
      });
      expect(resValidGrant.status).toBe(200);

      // Verify SVG receives security headers (nosniff, CSP, attachment)
      expect(resValidGrant.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(resValidGrant.headers.get("Content-Disposition")).toBe("attachment");

      env.close();
    });
  });

  // =========================================================================
  // AREA 3: Fail-Closed Behavior on D1 Error During Blob Stream Handling
  // =========================================================================
  describe("Area 3: Fail-Closed Behavior on D1 Database Error", () => {
    it("Adv 3.1: D1 database disconnect returns 503 and NEVER leaks R2 file content", async () => {
      const env = createTestEnv();
      const sensitiveData = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
      const assetKey = "financial-report-2026.pdf";

      await env.storage.put(assetKey, sensitiveData, {
        httpMetadata: { contentType: "application/pdf" },
      });

      // Attach to a public post initially
      await env.createPost({
        slug: "financial-report",
        image: `/api/blob/${assetKey}`,
        permissionType: "public",
      });

      // Now crash the database (close SQLite connection)
      env.d1.sqlite.close();

      // Request the asset
      const res = await env.request(`/api/blob/${assetKey}`);

      // Must fail closed with 503
      expect(res.status).toBe(503);
      const text = await res.text();
      expect(text).toContain("Media authorization backend unavailable");

      // Verify sensitive bytes are NOT present in the response
      const buffer = new TextEncoder().encode(text);
      let leaked = false;
      for (let i = 0; i < buffer.length - sensitiveData.length; i++) {
        if (buffer[i] === 0xde && buffer[i + 1] === 0xad && buffer[i + 2] === 0xbe && buffer[i + 3] === 0xef) {
          leaked = true;
          break;
        }
      }
      expect(leaked).toBe(false);

      env.close();
    });
  });

  // =========================================================================
  // AREA 4: EXIF/XMP Stripping with Dirty JPEG APP1/COM & WebP EXIF Chunks
  // =========================================================================
  describe("Area 4: EXIF/XMP Stripping with Dirty Metadata & GPS Coordinates", () => {
    it("Adv 4.1: Dirty JPEG with APP1 GPS tags and COM comment is thoroughly sanitized", () => {
      const jfifPayload = [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
      const jfifSegment = [0xff, 0xe0, 0x00, 0x10, ...jfifPayload]; // len = 16 (0x0010)

      const gpsString = "GPS Coordinates: 37.7749° N, 122.4194° W";
      const gpsBytes = Array.from(new TextEncoder().encode(gpsString));
      const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
      const app1Payload = [...exifHeader, ...gpsBytes];
      const app1Len = app1Payload.length + 2;
      const app1Segment = [0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...app1Payload];

      const commentString = "Confidential Camera Serial: SN-998822";
      const comBytes = Array.from(new TextEncoder().encode(commentString));
      const comLen = comBytes.length + 2;
      const comSegment = [0xff, 0xfe, (comLen >> 8) & 0xff, comLen & 0xff, ...comBytes];

      const dirtyJpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        ...jfifSegment,
        ...app1Segment,
        ...comSegment,
        0xff, 0xda, 0x00, 0x02, // SOS
        0x55, 0xaa, 0x77, // Image scan data
        0xff, 0xd9, // EOI
      ]);

      const strippedBuffer = stripExifFromBuffer(dirtyJpeg.buffer, "image/jpeg");
      const strippedBytes = new Uint8Array(strippedBuffer);
      const strippedText = new TextDecoder().decode(strippedBytes);

      // Verify SOI and EOI remain
      expect(strippedBytes[0]).toBe(0xff);
      expect(strippedBytes[1]).toBe(0xd8);
      expect(strippedBytes[strippedBytes.length - 2]).toBe(0xff);
      expect(strippedBytes[strippedBytes.length - 1]).toBe(0xd9);

      // Verify APP0 (JFIF) is preserved
      let hasJfif = false;
      for (let i = 0; i < strippedBytes.length - 1; i++) {
        if (strippedBytes[i] === 0xff && strippedBytes[i + 1] === 0xe0) {
          hasJfif = true;
          break;
        }
      }
      expect(hasJfif).toBe(true);

      // Verify APP1 (FF E1) is completely gone
      let hasApp1 = false;
      for (let i = 0; i < strippedBytes.length - 1; i++) {
        if (strippedBytes[i] === 0xff && strippedBytes[i + 1] === 0xe1) {
          hasApp1 = true;
          break;
        }
      }
      expect(hasApp1).toBe(false);

      // Verify COM (FF FE) is completely gone
      let hasCom = false;
      for (let i = 0; i < strippedBytes.length - 1; i++) {
        if (strippedBytes[i] === 0xff && strippedBytes[i + 1] === 0xfe) {
          hasCom = true;
          break;
        }
      }
      expect(hasCom).toBe(false);

      // Verify sensitive GPS string and serial number are not anywhere in bytes
      expect(strippedText).not.toContain("GPS Coordinates");
      expect(strippedText).not.toContain("37.7749");
      expect(strippedText).not.toContain("SN-998822");
    });

    it("Adv 4.2: Dirty WebP container with EXIF & XMP chunks has metadata stripped and VP8X flags cleared", () => {
      const gpsData = Array.from(new TextEncoder().encode("GPS: 35.6895 N, 139.6917 E Tokyo"));
      const exifChunk = [
        0x45, 0x58, 0x49, 0x46, // "EXIF"
        gpsData.length & 0xff, (gpsData.length >> 8) & 0xff, 0x00, 0x00,
        ...gpsData,
        ...(gpsData.length % 2 === 1 ? [0x00] : []), // Padding byte if odd
      ];

      const xmpData = Array.from(new TextEncoder().encode("<x:xmpmeta><rdf:Description GPSLatitude='35.6895'/></x:xmpmeta>"));
      const xmpChunk = [
        0x58, 0x4d, 0x50, 0x20, // "XMP "
        xmpData.length & 0xff, (xmpData.length >> 8) & 0xff, 0x00, 0x00,
        ...xmpData,
        ...(xmpData.length % 2 === 1 ? [0x00] : []),
      ];

      const vp8Chunk = [
        0x56, 0x50, 0x38, 0x20, // "VP8 "
        0x04, 0x00, 0x00, 0x00, // length: 4
        0x11, 0x22, 0x33, 0x44, // image bytes
      ];

      const vp8xPayload = [
        0x0c, 0x00, 0x00, 0x00, // flags: bit 3 (EXIF) + bit 2 (XMP) set -> 0x0C
        0x64, 0x00, 0x00, // width - 1
        0x64, 0x00, 0x00, // height - 1
      ];
      const vp8xChunk = [
        0x56, 0x50, 0x38, 0x58, // "VP8X"
        0x0a, 0x00, 0x00, 0x00, // length: 10
        ...vp8xPayload,
      ];

      const chunks = [...vp8xChunk, ...exifChunk, ...xmpChunk, ...vp8Chunk];
      const fileSize = 4 + chunks.length; // "WEBP" + chunks
      const dirtyWebp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        fileSize & 0xff, (fileSize >> 8) & 0xff, (fileSize >> 16) & 0xff, (fileSize >> 24) & 0xff,
        0x57, 0x45, 0x42, 0x50, // "WEBP"
        ...chunks,
      ]);

      const strippedBuffer = stripExifFromBuffer(dirtyWebp.buffer, "image/webp");
      const strippedBytes = new Uint8Array(strippedBuffer);
      const strippedText = new TextDecoder().decode(strippedBytes);

      // Verify "EXIF" and "XMP " are removed
      expect(strippedText).not.toContain("EXIF");
      expect(strippedText).not.toContain("XMP ");
      expect(strippedText).not.toContain("Tokyo");
      expect(strippedText).not.toContain("35.6895");

      // Verify VP8X chunk exists and flags byte (index 20) has cleared bits 3 and 2
      expect(strippedText).toContain("VP8X");
      const flagsByte = strippedBytes[20];
      expect(flagsByte & 0x0c).toBe(0);

      // Verify VP8 chunk is preserved
      expect(strippedText).toContain("VP8 ");

      // Verify RIFF total size matches stripped length - 8
      const calculatedRiffSize =
        strippedBytes[4] | (strippedBytes[5] << 8) | (strippedBytes[6] << 16) | (strippedBytes[7] << 24);
      expect(calculatedRiffSize).toBe(strippedBytes.length - 8);
    });

    it("Adv 4.3: Malformed JPEG segment lengths do not trigger infinite loops or crash", () => {
      const badSegmentLen = new Uint8Array([
        0xff, 0xd8,
        0xff, 0xe1, 0x00, 0x01, // len = 1 (invalid)
        0x12, 0x34,
        0xff, 0xd9,
      ]);

      const result1 = stripExifFromBuffer(badSegmentLen.buffer, "image/jpeg");
      expect(result1).toBeDefined();

      const overflowSegmentLen = new Uint8Array([
        0xff, 0xd8,
        0xff, 0xe1, 0xff, 0xff, // len = 65535 (way past buffer size)
        0x12, 0x34,
      ]);

      const result2 = stripExifFromBuffer(overflowSegmentLen.buffer, "image/jpeg");
      expect(result2).toBeDefined();
    });
  });

  // =========================================================================
  // AREA 5: JSON-LD XSS Injection Payloads
  // =========================================================================
  describe("Area 5: JSON-LD XSS Injection Payloads", () => {
    function serializeJsonLd(data: any): string {
      return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
    }

    it("Adv 5.1: Critical script tag breakout </script><script>alert(1)</script> is neutralized", () => {
      const maliciousJsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: "</script><script>alert('pwned-via-headline')</script>",
        description: "Normal post with </script><img src=x onerror=alert(1)> in summary",
        author: {
          "@type": "Person",
          name: "Attacker </script><script src='https://attacker.evil/payload.js'></script>",
        },
        keywords: [
          "security",
          "</script><svg onload=alert(document.domain)>",
        ],
      };

      const serialized = serializeJsonLd(maliciousJsonLd);

      // Verify no literal < or > exists anywhere
      expect(serialized).not.toContain("<");
      expect(serialized).not.toContain(">");
      expect(serialized).not.toContain("</script>");

      // Verify safe unicode escapes are present
      expect(serialized).toContain("\\u003c/script\\u003e");
      expect(serialized).toContain("\\u003cscript\\u003e");

      // Verify regex check for HTML script tag breakout
      const htmlBreakoutRegex = /<\/script[\s>]/i;
      expect(htmlBreakoutRegex.test(serialized)).toBe(false);
    });

    it("Adv 5.2: CDATA and XML escaping breakouts are neutralized", () => {
      const payloads = [
        "<![CDATA[</script><script>alert(1)</script>]]>",
        "<!-- <script>alert(1)</script> -->",
        "\" autofocus onfocus=\"alert(1)",
        "&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
      ];

      for (const p of payloads) {
        const serialized = serializeJsonLd({ text: p });
        expect(serialized).not.toContain("<");
        expect(serialized).not.toContain(">");
        expect(serialized).not.toContain("&");
      }
    });

    it("Adv 5.3: Round-trip parse verifies JSON validity after unicode escaping", () => {
      const original = {
        title: "5 < 10 & 10 > 5: High-Performance Guide",
        snippet: "Use <code>div & span</code> tags for <Layout />",
      };

      const serialized = serializeJsonLd(original);

      // JSON.parse in JavaScript recognizes \u003c, \u003e, \u0026 as <, >, &
      const parsed = JSON.parse(serialized);
      expect(parsed.title).toBe("5 < 10 & 10 > 5: High-Performance Guide");
      expect(parsed.snippet).toBe("Use <code>div & span</code> tags for <Layout />");
    });
  });

  // =========================================================================
  // AREA 6: Turnstile Verification Bypass & Forged Token Attacks
  // =========================================================================
  describe("Area 6: Turnstile Verification Bypass & Forged Token Attacks", () => {
    it("Adv 6.1: Missing or empty Turnstile token is rejected when enabled", async () => {
      const env = createTestEnv();

      // Enable Turnstile
      await env.db.insert(schema.systemConfigs).values({
        key: "turnstile",
        value: JSON.stringify({
          enabled: true,
          siteKey: "0x4AAAAAAtestsitekey",
          secretKey: "0x4AAAAAAtestsecret",
        }),
      });

      // 1. Missing token
      const res1 = await env.requestJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "turnstile_user_1",
          password: "password123456",
        }),
      });
      expect(res1.status).toBe(400);
      expect(res1.data.error).toContain("Turnstile verification token is required");

      // 2. Empty string token
      const res2 = await env.requestJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "turnstile_user_2",
          password: "password123456",
          turnstileToken: "",
        }),
      });
      expect(res2.status).toBe(400);
      expect(res2.data.error).toContain("Turnstile verification token is required");

      env.close();
    });

    it("Adv 6.2: Forged Turnstile token fails verification against CF API", async () => {
      const env = createTestEnv({
        turnstileSecret: "2x0000000000000000000000000000000AA",
      });

      await env.db.insert(schema.systemConfigs).values({
        key: "turnstile",
        value: JSON.stringify({
          enabled: true,
          siteKey: "0x4AAAAAAtestsitekey",
        }),
      });

      const res = await env.requestJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "forged_turnstile_user",
          password: "password123456",
          turnstileToken: "forged_dummy_token_xyz_12345",
        }),
      });

      // Must be rejected with 400
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain("Turnstile");

      env.close();
    });

    it("Adv 6.3: Missing secret key fails closed rather than allowing bypass", async () => {
      const env = createTestEnv({
        turnstileSecret: "",
      });
      delete (env.env as any).CF_TURNSTILE_SECRET;

      await env.db.insert(schema.systemConfigs).values({
        key: "turnstile",
        value: JSON.stringify({
          enabled: true,
          siteKey: "0x4AAAAAAtestsitekey",
        }),
      });

      const res = await env.requestJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "no_secret_user",
          password: "password123456",
          turnstileToken: "any_token_value",
        }),
      });

      // Must fail closed with 400
      expect(res.status).toBe(400);
      expect(res.data.error).toContain("secret key is not configured");

      env.close();
    });

    it("Adv 6.4: Arbitrary body parameter injection cannot bypass Turnstile verification", async () => {
      const env = createTestEnv();
      await env.db.insert(schema.systemConfigs).values({
        key: "turnstile",
        value: JSON.stringify({
          enabled: true,
          siteKey: "0x4AAAAAAtestsitekey",
          secretKey: "0x4AAAAAAtestsecret",
        }),
      });

      const res = await env.requestJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "injection_hacker",
          password: "password123456",
          turnstilePassed: true,
          bypassTurnstile: true,
          isHuman: true,
          verified: true,
        }),
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Turnstile");

      env.close();
    });
  });
});
