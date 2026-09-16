import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 3 - Combination: Admin Governance & Dynamic Rules", () => {
  it("Admin configures dynamic checkin rules and adjusts content permissions in real time", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("governance_admin", "adminpass123");

    // 1. Admin configures random checkin rule in system_configs via API
    const ruleRes = await env.requestJson("/api/admin/config/system", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        key: "checkin_rule",
        value: {
          mode: "random",
          randomMin: 25,
          randomMax: 45,
        },
      }),
    });
    expect(ruleRes.status).toBe(200);

    // 2. Regular user registers and checks in
    const user = await env.createUser("lucky_user", "pass123456", 0);
    const checkinRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.data.awardedPoints).toBeGreaterThanOrEqual(25);
    expect(checkinRes.data.awardedPoints).toBeLessThanOrEqual(45);

    // 3. Admin creates post with points_required = 100
    const post = await env.createPost({
      slug: "governed-post",
      permissionType: "points_required",
      requiredPoints: 100,
      content: "Exclusive research report",
    });

    // User cannot access content yet
    const viewBefore = await env.requestJson(`/api/posts/${post.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(viewBefore.data.data.isUnlocked).toBe(false);
    expect(viewBefore.data.data.content).toBeNull();

    // 4. Admin updates post permission directly to 'public'
    const updatePostRes = await env.requestJson(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        permissionType: "public",
      }),
    });
    expect(updatePostRes.status).toBe(200);

    // 5. User can now view content without purchasing
    const viewAfter = await env.requestJson(`/api/posts/${post.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(viewAfter.data.data.isUnlocked).toBe(true);
    expect(viewAfter.data.data.content).toBe("Exclusive research report");

    // User's points remain intact
    const checkUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser.points).toBe(checkinRes.data.awardedPoints);

    env.close();
  });
});
