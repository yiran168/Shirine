import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Adversarial Concurrency: Point Unlock & Overdraft Prevention", () => {
  it("C2.1: Same-post race condition (20 concurrent unlock requests) prevents double-spend and overdraft", async () => {
    const env = createTestEnv();
    // User has exactly 50 points
    const user = await env.createUser("unlock_race_user", "pass123456", 50);

    // Post costs 50 points
    const post = await env.createPost({
      slug: "costly-post-50",
      permissionType: "points_required",
      requiredPoints: 50,
      content: "Exclusive Secret Document",
    });

    // Concurrently fire 20 unlock requests for this post
    const concurrency = 20;
    const promises = Array.from({ length: concurrency }, () =>
      env.requestJson(`/api/posts/${post.id}/unlock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
      })
    );

    const responses = await Promise.all(promises);

    // All requests must return a valid status (either 200 with unlocked / already unlocked, or 400 if contention)
    // Most importantly, the balance must NEVER become negative!
    for (const r of responses) {
      if (r.status === 200) {
        expect(r.data.success).toBe(true);
        expect(r.data.content).toBe("Exclusive Secret Document");
      } else {
        expect(r.status).toBe(400);
      }
    }

    // Forensic verification: user points must be EXACTLY 0, never negative
    const dbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(dbUser.points).toBe(0);

    // post_unlocks must have EXACTLY 1 row for this user and post
    const unlocks = env.d1.sqlite
      .query("SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ?")
      .all(user.id, post.id) as any[];
    expect(unlocks.length).toBe(1);
    expect(unlocks[0].points_spent).toBe(50);

    // point_transactions must have EXACTLY 1 transaction row for this post unlock
    const txRows = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'post_unlock'")
      .all(user.id) as any[];
    expect(txRows.length).toBe(1);
    expect(txRows[0].amount).toBe(-50);
    expect(txRows[0].balance_after).toBe(0);

    env.close();
  });

  it("C2.2: Cross-post concurrent unlock race with limited points (Overdraft Attack across 10 trials)", async () => {
    // In each trial: user has 60 points, Post A costs 40, Post B costs 40. Total = 80 > 60.
    // Both are requested concurrently. Exactly one MUST succeed, the other MUST fail.
    for (let trial = 0; trial < 10; trial++) {
      const env = createTestEnv();
      const user = await env.createUser(`cross_user_${trial}`, "pass123456", 60);

      const postA = await env.createPost({
        slug: `post-a-${trial}`,
        permissionType: "points_required",
        requiredPoints: 40,
        content: `Content A ${trial}`,
      });

      const postB = await env.createPost({
        slug: `post-b-${trial}`,
        permissionType: "points_required",
        requiredPoints: 40,
        content: `Content B ${trial}`,
      });

      const [resA, resB] = await Promise.all([
        env.requestJson(`/api/posts/${postA.id}/unlock`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        env.requestJson(`/api/posts/${postB.id}/unlock`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
        }),
      ]);

      const successCount = [resA, resB].filter((r) => r.status === 200 && r.data.success === true).length;
      const failCount = [resA, resB].filter((r) => r.status === 400 && r.data.success === false).length;

      // Exactly one succeeds, one fails with Insufficient points
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify DB integrity: points must be strictly 20 (60 - 40 = 20), NEVER -20!
      const dbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
      expect(dbUser.points).toBe(20);

      // post_unlocks must have exactly 1 record
      const dbUnlocks = env.d1.sqlite
        .query("SELECT * FROM post_unlocks WHERE user_id = ?")
        .all(user.id) as any[];
      expect(dbUnlocks.length).toBe(1);

      // point_transactions must have exactly 1 record
      const dbTx = env.d1.sqlite
        .query("SELECT * FROM point_transactions WHERE user_id = ?")
        .all(user.id) as any[];
      expect(dbTx.length).toBe(1);
      expect(dbTx[0].amount).toBe(-40);
      expect(dbTx[0].balance_after).toBe(20);

      env.close();
    }
  });

  it("C2.3: Zero-balance concurrent unlock storm (20 requests) results in zero deductions and zero orphaned rows", async () => {
    const env = createTestEnv();
    const user = await env.createUser("broke_user", "pass123456", 0);

    const post = await env.createPost({
      slug: "luxury-post-100",
      permissionType: "points_required",
      requiredPoints: 100,
      content: "Million dollar content",
    });

    const promises = Array.from({ length: 20 }, () =>
      env.requestJson(`/api/posts/${post.id}/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
      })
    );

    const responses = await Promise.all(promises);

    for (const r of responses) {
      expect(r.status).toBe(400);
      expect(r.data.success).toBe(false);
      expect(r.data.error).toMatch(/Insufficient points/i);
    }

    const dbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(dbUser.points).toBe(0);

    const dbUnlocks = env.d1.sqlite
      .query("SELECT * FROM post_unlocks WHERE user_id = ?")
      .all(user.id) as any[];
    expect(dbUnlocks.length).toBe(0);

    const dbTx = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ?")
      .all(user.id) as any[];
    expect(dbTx.length).toBe(0);

    env.close();
  });

  it("C2.4: Album unlock concurrency: 10 simultaneous requests deduct points exactly once with zero overdraft", async () => {
    const env = createTestEnv();
    const user = await env.createUser("album_race_user", "pass123456", 30);

    const album = await env.createAlbum({
      title: "Exclusive Gallery",
      permissionType: "points_required",
      requiredPoints: 30,
    });

    // Add a photo to the album
    env.d1.sqlite
      .query("INSERT INTO album_photos (album_id, url, title, sort_order) VALUES (?, ?, ?, ?)")
      .run(album.id, "http://localhost/api/blob/photo1.jpg", "Photo 1", 1);

    const concurrency = 10;
    const promises = Array.from({ length: concurrency }, () =>
      env.requestJson(`/api/albums/${album.id}/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
      })
    );

    const responses = await Promise.all(promises);

    for (const r of responses) {
      if (r.status === 200) {
        expect(r.data.success).toBe(true);
      } else {
        expect(r.status).toBe(400);
      }
    }

    // Points must be 0, never negative
    const dbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(dbUser.points).toBe(0);

    // album_unlocks has exactly 1 row
    const dbUnlocks = env.d1.sqlite
      .query("SELECT * FROM album_unlocks WHERE user_id = ? AND album_id = ?")
      .all(user.id, album.id) as any[];
    expect(dbUnlocks.length).toBe(1);
    expect(dbUnlocks[0].points_spent).toBe(30);

    // point_transactions has exactly 1 row
    const dbTx = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'album_unlock'")
      .all(user.id) as any[];
    expect(dbTx.length).toBe(1);
    expect(dbTx[0].amount).toBe(-30);
    expect(dbTx[0].balance_after).toBe(0);

    env.close();
  });
});
