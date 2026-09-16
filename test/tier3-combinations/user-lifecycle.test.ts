import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 3 - Combination: Complete User Lifecycle", () => {
  it("Executes full lifecycle: Register -> Checkin -> Accumulate -> Unlock -> Blob ACL -> Ledger -> Logout", async () => {
    const env = createTestEnv();

    // Step 1: Register new account
    const regRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "lifecycle_hero",
        password: "heropassword123",
      }),
    });
    expect(regRes.status).toBe(201);
    expect(regRes.data.success).toBe(true);
    const token = regRes.data.token;
    const userId = regRes.data.user.id;

    // Step 2: Query initial profile via /api/auth/me
    const meRes1 = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes1.status).toBe(200);
    expect(meRes1.data.user.points).toBe(0);
    expect(meRes1.data.user.checkedInToday).toBe(false);

    // Step 3: Perform daily check-in
    const checkinRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.data.success).toBe(true);
    const earned = checkinRes.data.awardedPoints;
    expect(earned).toBeGreaterThanOrEqual(1);

    // Profile check: checkedInToday should now be true
    const meRes2 = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes2.data.user.checkedInToday).toBe(true);
    expect(meRes2.data.user.points).toBe(earned);

    // Step 4: Verify point_transactions ledger recorded check-in
    const ledgerAfterCheckin = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? ORDER BY id ASC")
      .all(userId) as any[];
    expect(ledgerAfterCheckin.length).toBe(1);
    expect(ledgerAfterCheckin[0].type).toBe("checkin");
    expect(ledgerAfterCheckin[0].amount).toBe(earned);

    // Step 5: Post requiring 100 points - attempt unlock (should fail due to insufficient points)
    const mediaKey = "secret-blueprint.png";
    await env.storage.put(mediaKey, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]));

    const lockedPost = await env.createPost({
      slug: "premium-blueprint",
      title: "Secret Blueprint",
      content: "Classified engineering diagrams",
      permissionType: "points_required",
      requiredPoints: 100,
      image: `/api/blob/${mediaKey}`,
    });

    const failedUnlock = await env.requestJson(`/api/posts/${lockedPost.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(failedUnlock.status).toBe(400);
    expect(failedUnlock.data.error).toContain("Insufficient points");

    // Media access should also be blocked (403)
    const blockedMedia = await env.request(`/api/blob/${mediaKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(blockedMedia.status).toBe(403);

    // Step 6: Admin awards 150 points to user
    const admin = await env.createSuperadmin("point_master", "adminpass123");
    const adjustRes = await env.requestJson(`/api/admin/users/${userId}/points`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        amount: 150,
        description: "Quest reward bonus",
      }),
    });
    expect(adjustRes.status).toBe(200);
    expect(adjustRes.data.success).toBe(true);

    // Step 7: Unlock post succeeds
    const successUnlock = await env.requestJson(`/api/posts/${lockedPost.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(successUnlock.status).toBe(200);
    expect(successUnlock.data.success).toBe(true);
    expect(successUnlock.data.isUnlocked).toBe(true);
    expect(successUnlock.data.content).toBe("Classified engineering diagrams");

    // Step 8: Verify point_transactions ledger
    const finalLedger = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? ORDER BY id ASC")
      .all(userId) as any[];
    // Should have: checkin (+earned), admin_adjustment (+150), post_unlock (-100)
    expect(finalLedger.length).toBe(3);
    expect(finalLedger[1].type).toBe("admin_adjust");
    expect(finalLedger[1].amount).toBe(150);
    expect(finalLedger[2].type).toBe("post_unlock");
    expect(finalLedger[2].amount).toBe(-100);

    // Step 9: Access protected blob media now succeeds (200)
    const allowedMedia = await env.request(`/api/blob/${mediaKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(allowedMedia.status).toBe(200);

    // Step 10: Logout session
    const logoutRes = await env.requestJson("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status).toBe(200);

    // Subsequent access fails with 401
    const postLogoutRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(postLogoutRes.status).toBe(401);

    env.close();
  });
});
