import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 2 - Boundary: Blob Handler & R2 Storage Boundaries", () => {
  it("B2.1: Missing key in blob path returns 400 Bad Request", async () => {
    const env = createTestEnv();
    const res = await env.request("/api/blob/");
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Key is required");
    env.close();
  });

  it("B2.2: Storage bucket unbound returns 404", async () => {
    const env = createTestEnv();
    // Simulate STORAGE unbound
    delete (env.env as any).STORAGE;

    const res = await env.request("/api/blob/sample.png");
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("Storage bucket not bound");
    env.close();
  });

  it("B2.3: Protected media in login_required post returns 401 when anonymous", async () => {
    const env = createTestEnv();
    const mediaKey = "members-only-chart.png";

    // Put image in R2
    await env.storage.put(mediaKey, new Uint8Array([1, 2, 3, 4]));

    // Create post referencing this image with login_required permission
    await env.createPost({
      slug: "members-chart-post",
      permissionType: "login_required",
      image: `/api/blob/${mediaKey}`,
    });

    const res = await env.request(`/api/blob/${mediaKey}`);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Unauthorized");

    env.close();
  });

  it("B2.4: Protected media in points_required post returns 403 when not yet purchased", async () => {
    const env = createTestEnv();
    const mediaKey = "vip-art.png";
    await env.storage.put(mediaKey, new Uint8Array([5, 6, 7, 8]));

    await env.createPost({
      slug: "vip-art-post",
      permissionType: "points_required",
      requiredPoints: 50,
      image: `/api/blob/${mediaKey}`,
    });

    const user = await env.createUser("vip_watcher", "pass123456", 0);

    const res = await env.request(`/api/blob/${mediaKey}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain("must be unlocked");

    env.close();
  });

  it("B2.5: Non-existent object in R2 storage returns 404 Not Found after passing ACL", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("storage_admin", "adminpass123");

    const res = await env.request("/api/blob/does-not-exist.jpg", {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("Object not found");

    env.close();
  });

  it("B2.6: D1 database exception during ACL check triggers fail-closed 503 response", async () => {
    const env = createTestEnv();
    const mediaKey = "sensitive-doc.pdf";
    await env.storage.put(mediaKey, new Uint8Array([9, 10, 11, 12]));

    // Close SQLite database to simulate database connection loss or D1 failure
    env.d1.sqlite.close();

    const res = await env.request(`/api/blob/${mediaKey}`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("Media authorization backend unavailable");

    env.close();
  });
});
