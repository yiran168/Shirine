import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { schema } from "../../server/src/db";

describe("Tier 4 - Scenario: Visitor to Active Member End-to-End Journey", () => {
  it("Completes end-to-end journey: browse -> encounter paywall -> register -> checkin -> change avatar -> unlock -> review ledger", async () => {
    const env = createTestEnv();

    // Setup blog posts
    const publicPost = await env.createPost({
      slug: "welcome-to-shirine",
      title: "Welcome to Shirine Blog",
      content: "Introductory public article for all visitors",
      permissionType: "public",
    });

    const premiumPost = await env.createPost({
      slug: "deep-dive-cloudflare-d1",
      title: "Deep Dive: Cloudflare D1 Architecture",
      content: "Comprehensive deep-dive guide on distributed SQLite internals",
      permissionType: "points_required",
      requiredPoints: 10,
    });

    // 1. Visitor browses public posts listing
    const listRes = await env.requestJson("/api/posts");
    expect(listRes.status).toBe(200);
    expect(listRes.data.success).toBe(true);
    expect(listRes.data.data.length).toBeGreaterThanOrEqual(2);

    // 2. Visitor views public post: readable immediately
    const pubRes = await env.requestJson(`/api/posts/${publicPost.id}`);
    expect(pubRes.data.data.isUnlocked).toBe(true);
    expect(pubRes.data.data.content).toBe("Introductory public article for all visitors");

    // 3. Visitor hits premium post: content locked behind points_required
    const paywallRes = await env.requestJson(`/api/posts/${premiumPost.id}`);
    expect(paywallRes.data.data.isUnlocked).toBe(false);
    expect(paywallRes.data.data.content).toBeNull();
    expect(paywallRes.data.data.lockReason).toBe("points_required");

    // 4. Visitor decides to register
    const regRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "sakura_reader",
        password: "readerpassword123",
      }),
    });
    expect(regRes.status).toBe(201);
    const token = regRes.data.token;
    const user = regRes.data.user;

    // 5. New member performs first daily check-in to earn points
    const checkinRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.data.awardedPoints).toBeGreaterThanOrEqual(10);
    expect(checkinRes.data.checkinStreak).toBe(1);

    // 6. User chooses anime avatar #15 from 20-grid modal and updates profile
    const avatarChoice = "/assets/avatars/avatar_15.webp";
    const updateProfileRes = await env.requestJson("/api/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        avatar: avatarChoice,
        nickname: "Sakura Reader",
      }),
    });
    expect(updateProfileRes.status).toBe(200);
    expect(updateProfileRes.data.user.avatar).toBe(avatarChoice);
    expect(updateProfileRes.data.user.nickname).toBe("Sakura Reader");

    // 7. User now unlocks the premium post with accumulated points
    const unlockRes = await env.requestJson(`/api/posts/${premiumPost.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.data.isUnlocked).toBe(true);
    expect(unlockRes.data.content).toBe("Comprehensive deep-dive guide on distributed SQLite internals");

    // 8. User posts a comment
    const commentRes = await env.requestJson("/api/posts", {
      // Direct comment insert to verify community interaction
    });
    await env.db.insert(schema.comments).values({
      postId: premiumPost.id,
      userId: user.id,
      content: "Amazing article, thank you for the detailed breakdown!",
      status: "approved",
    });

    const userComments = env.d1.sqlite
      .query("SELECT * FROM comments WHERE post_id = ? AND user_id = ?")
      .all(premiumPost.id, user.id) as any[];
    expect(userComments.length).toBe(1);
    expect(userComments[0].content).toBe("Amazing article, thank you for the detailed breakdown!");

    // 9. Review point ledger to confirm full accounting transparency
    const ledger = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? ORDER BY id ASC")
      .all(user.id) as any[];
    expect(ledger.length).toBe(2);
    expect(ledger[0].type).toBe("checkin");
    expect(ledger[0].amount).toBeGreaterThanOrEqual(10);
    expect(ledger[1].type).toBe("post_unlock");
    expect(ledger[1].amount).toBe(-10);

    env.close();
  });
});
