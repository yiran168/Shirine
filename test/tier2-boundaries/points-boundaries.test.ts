import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 2 - Boundary: Points System & Atomic Ledger", () => {
  it("B2.1: Duplicate daily check-in on the same day is rejected with 400", async () => {
    const env = createTestEnv();
    const user = await env.createUser("dup_checkin_user", "pass123456", 0);

    // First checkin succeeds
    const res1 = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res1.status).toBe(200);
    expect(res1.data.success).toBe(true);

    // Second checkin on the same day must be rejected
    const res2 = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res2.status).toBe(400);
    expect(res2.data.success).toBe(false);
    expect(res2.data.error).toContain("already checked in today");

    env.close();
  });

  it("B2.2: Post unlock with insufficient points is rejected with 400", async () => {
    const env = createTestEnv();
    // User has only 10 points
    const user = await env.createUser("poor_user", "pass123456", 10);

    // Post requires 50 points
    const post = await env.createPost({
      slug: "expensive-post",
      permissionType: "points_required",
      requiredPoints: 50,
      content: "Expensive content",
    });

    const unlockRes = await env.requestJson(`/api/posts/${post.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(unlockRes.status).toBe(400);
    expect(unlockRes.data.success).toBe(false);
    expect(unlockRes.data.error).toContain("Insufficient points");

    // Ensure user points were NOT deducted
    const checkUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser.points).toBe(10);

    // Ensure no ledger entry was created
    const ledgerEntries = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ?")
      .all(user.id) as any[];
    expect(ledgerEntries.length).toBe(0);

    env.close();
  });

  it("B2.3: Re-unlocking an already unlocked post is idempotent and does not deduct points", async () => {
    const env = createTestEnv();
    const user = await env.createUser("double_unlocker", "pass123456", 100);

    const post = await env.createPost({
      slug: "idempotent-post",
      permissionType: "points_required",
      requiredPoints: 30,
      content: "Gold content",
    });

    // 1. First unlock: costs 30 points
    const res1 = await env.requestJson(`/api/posts/${post.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res1.status).toBe(200);
    expect(res1.data.success).toBe(true);

    const afterFirst = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(afterFirst.points).toBe(70);

    // 2. Second unlock: should succeed idempotently with message "already unlocked" and 0 points deducted
    const res2 = await env.requestJson(`/api/posts/${post.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res2.status).toBe(200);
    expect(res2.data.success).toBe(true);
    expect(res2.data.message).toContain("already unlocked");

    const afterSecond = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(afterSecond.points).toBe(70); // Still 70!

    env.close();
  });

  it("B2.4: Free points-required post (requiredPoints = 0) unlocks without spending points", async () => {
    const env = createTestEnv();
    const user = await env.createUser("freebie_user", "pass123456", 0);

    const freePost = await env.createPost({
      slug: "free-post",
      permissionType: "points_required",
      requiredPoints: 0,
      content: "Free post content",
    });

    const res = await env.requestJson(`/api/posts/${freePost.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.isUnlocked).toBe(true);
    expect(res.data.content).toBe("Free post content");

    const checkUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser.points).toBe(0);

    env.close();
  });

  it("B2.5: Schema CHECK constraint prevents negative user points in D1 database", async () => {
    const env = createTestEnv();
    const user = await env.createUser("check_constraint_user", "pass123456", 10);

    // Attempting to set negative points directly in SQLite should trigger CHECK constraint
    expect(() => {
      env.d1.sqlite.query("UPDATE users SET points = -5 WHERE id = ?").run(user.id);
    }).toThrow();

    env.close();
  });
});
