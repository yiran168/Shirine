import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { signedMediaUrl, verifyMediaSignature } from "../../server/src/core/media-access";

describe("Signed media and durable album access", () => {
  it("a substring or wildcard match in published text cannot expose an unattached object", async () => {
    const env = createTestEnv();
    for (const key of ["private.png", "uploads/a_b.png"]) {
      await env.storage.put(key, new Uint8Array([1]));
      await env.createPost({content: `Text mentions ${key}, image ![](/api/blob/public-${key}-extra)`});
      expect((await env.request(await signedMediaUrl(key, env.env))).status).toBe(403);
    }
    env.close();
  });
  it("rejects unsigned, modified, expired and cross-site URLs before reading R2", async () => {
    const env = createTestEnv();
    const key = "uploads/public.png";
    await env.storage.put(key, new Uint8Array([1, 2, 3]));
    await env.createPost({ image: `/api/blob/${key}` });
    const signed = await signedMediaUrl(key, env.env);
    expect((await env.request(`/api/blob/${key}`)).status).toBe(403);
    expect((await env.request(signed.replace("public.png", "other.png"))).status).toBe(403);
    const expired = new URL(signed, "http://localhost");
    expired.searchParams.set("expires", "1");
    expect(await verifyMediaSignature(key, expired, env.env)).toBe(false);
    expect((await env.request(signed, { headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
    const allowed = await env.request(signed);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("cache-control")).toContain("no-store");
    env.close();
  });

  it("hides storage domains, persists canonical keys, and authorizes photos after repeated album unlocks", async () => {
    const env = createTestEnv();
    env.env.PUBLIC_R2_URL = "https://private-assets.example.test";
    const admin = await env.createSuperadmin();
    const user = await env.createUser("album_reader", "pass123456", 100);
    const key = "uploads/paid.png";
    await env.storage.put(key, new Uint8Array([1, 2, 3]));
    const album = await env.createAlbum({ permissionType: "points_required", requiredPoints: 30, photos: [{url: `${env.env.PUBLIC_R2_URL}/${key}`}] });
    const headers = { Cookie: user.cookie, "Content-Type": "application/json" };
    const locked = await env.requestJson(`/api/albums/${album.id}`, { headers });
    expect(locked.data.data.photoCount).toBe(1);
    for (let i = 0; i < 2; i++) {
      expect((await env.requestJson(`/api/albums/${album.id}/unlock`, { method: "POST", headers, body: "{}" })).status).toBe(200);
    }
    const detail = await env.requestJson(`/api/albums/${album.id}`, { headers });
    expect(detail.data.data.isUnlocked).toBe(true);
    expect(detail.data.data.photoCount).toBe(1);
    expect(JSON.stringify(detail.data)).not.toContain(env.env.PUBLIC_R2_URL);
    const source = detail.data.data.photos[0].url;
    expect((await env.request(source, { headers })).status).toBe(200);
    expect((await env.request(source)).status).toBe(401);
    const profile = await env.requestJson("/api/user/profile", { headers });
    expect(profile.data.user.points).toBe(70);
    const config = await env.requestJson("/api/config/site");
    expect(JSON.stringify(config.data)).not.toContain(env.env.PUBLIC_R2_URL);
    const saved = await env.requestJson("/api/user/profile", {method:"PUT",headers:{Cookie:admin.cookie,"Content-Type":"application/json"},body:JSON.stringify({avatar:source})});
    expect(saved.status).toBe(200);
    const row = env.d1.sqlite.query("SELECT avatar FROM users WHERE id = ?").get(admin.id) as any;
    expect(row.avatar).toBe(`/api/blob/${key}`);
    env.close();
  });

  it("administrator check-in cannot mint points", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin();
    expect((await env.request("/api/user/checkin", {method:"POST",headers:{Cookie:admin.cookie}})).status).toBe(403);
    expect((await env.request(`/api/admin/users/${admin.id}/points`, {method:"PUT",headers:{Cookie:admin.cookie,"Content-Type":"application/json"},body:JSON.stringify({delta:100})})).status).toBe(403);
    const stats = await env.requestJson("/api/admin/stats", {headers:{Cookie:admin.cookie}});
    expect(stats.data.data.totalPoints).toBe(0);
    const count = env.d1.sqlite.query("SELECT count(*) AS n FROM point_transactions").get() as any;
    expect(count.n).toBe(0);
    env.close();
  });

  it("ordinary users cannot expose unattached R2 objects by setting an arbitrary avatar URL", async () => {
    const env = createTestEnv();
    const user = await env.createUser();
    const response = await env.requestJson("/api/user/profile", { method: "PUT", headers: { Cookie: user.cookie, "Content-Type": "application/json" }, body: JSON.stringify({avatar:"/api/blob/uploads/unpublished.png"}) });
    expect(response.status).toBe(400);
    env.close();
  });
});
