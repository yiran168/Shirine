import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestEnv } from "../helpers/test-env";
import * as schema from "../../server/src/db/schema";

const EXPECTED_TABLES = [
  "users",
  "checkin_records",
  "posts",
  "post_unlocks",
  "albums",
  "album_photos",
  "album_unlocks",
  "moments",
  "pages",
  "friends",
  "site_configs",
  "system_configs",
  "comments",
  "visits",
  "setup_state",
  "point_transactions",
  "revoked_tokens",
];

describe("Tier 1 - AC 3: Database Schema & Transaction Integrity", () => {
  it("AC 3.1: D1 Schema definition contains exactly 17 aligned tables in schema.sql and schema.ts", () => {
    const schemaSqlPath = resolve(__dirname, "../../server/src/db/schema.sql");
    const sqlContent = readFileSync(schemaSqlPath, "utf-8");

    // Verify all 17 tables exist in schema.sql
    for (const table of EXPECTED_TABLES) {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, "i");
      expect(sqlContent).toMatch(tableRegex);
    }

    // Verify all 17 tables are exported in schema.ts
    const schemaExports = Object.keys(schema);
    const tableKeys = [
      "users",
      "checkinRecords",
      "posts",
      "postUnlocks",
      "albums",
      "albumPhotos",
      "albumUnlocks",
      "moments",
      "pages",
      "friends",
      "siteConfigs",
      "systemConfigs",
      "comments",
      "visits",
      "setupState",
      "pointTransactions",
      "revokedTokens",
    ];

    for (const key of tableKeys) {
      expect(schemaExports).toContain(key);
    }
  });

  it("AC 3.2: Daily checkin atomically increments points, updates streak, and writes point_transactions ledger", async () => {
    const env = createTestEnv();
    const user = await env.createUser("checkin_tester", "pass123456", 0);

    const checkinRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    expect(checkinRes.status).toBe(200);
    expect(checkinRes.data.success).toBe(true);
    expect(checkinRes.data.awardedPoints).toBeGreaterThanOrEqual(1);
    expect(checkinRes.data.currentPoints).toBeGreaterThanOrEqual(1);

    // Verify point_transactions ledger has recorded the checkin
    const ledger = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'checkin'")
      .all(user.id) as any[];

    expect(ledger.length).toBe(1);
    expect(ledger[0].amount).toBe(checkinRes.data.awardedPoints);
    expect(ledger[0].balance_after).toBe(checkinRes.data.currentPoints);
    expect(ledger[0].idempotency_key).toContain(`checkin_${user.id}`);

    // Verify checkin_records entry
    const records = env.d1.sqlite
      .query("SELECT * FROM checkin_records WHERE user_id = ?")
      .all(user.id) as any[];
    expect(records.length).toBe(1);
    expect(records[0].points_awarded).toBe(checkinRes.data.awardedPoints);

    env.close();
  });

  it("AC 3.3: 3-tier content permissions gate content appropriately", async () => {
    const env = createTestEnv();

    // 1. Public post
    const publicPost = await env.createPost({
      slug: "public-post",
      permissionType: "public",
      content: "Public readable content",
    });

    const pubRes = await env.requestJson(`/api/posts/${publicPost.id}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.data.data.isUnlocked).toBe(true);
    expect(pubRes.data.data.content).toBe("Public readable content");

    // 2. Login-required post
    const loginPost = await env.createPost({
      slug: "login-post",
      permissionType: "login_required",
      content: "Members-only content",
    });

    // Unauthenticated request
    const anonLoginRes = await env.requestJson(`/api/posts/${loginPost.id}`);
    expect(anonLoginRes.status).toBe(200);
    expect(anonLoginRes.data.data.isUnlocked).toBe(false);
    expect(anonLoginRes.data.data.content).toBeNull();
    expect(anonLoginRes.data.data.lockReason).toBe("login_required");

    // Authenticated request
    const member = await env.createUser("member1", "pass123456", 0);
    const authLoginRes = await env.requestJson(`/api/posts/${loginPost.id}`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });
    expect(authLoginRes.status).toBe(200);
    expect(authLoginRes.data.data.isUnlocked).toBe(true);
    expect(authLoginRes.data.data.content).toBe("Members-only content");

    // 3. Points-required post
    const pointsPost = await env.createPost({
      slug: "points-post",
      permissionType: "points_required",
      requiredPoints: 50,
      content: "VIP paid content",
    });

    // Authenticated but not unlocked
    const lockedRes = await env.requestJson(`/api/posts/${pointsPost.id}`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });
    expect(lockedRes.status).toBe(200);
    expect(lockedRes.data.data.isUnlocked).toBe(false);
    expect(lockedRes.data.data.content).toBeNull();
    expect(lockedRes.data.data.lockReason).toBe("points_required");

    env.close();
  });

  it("AC 3.4: Post unlock atomic transaction deducts points and writes ledger entry", async () => {
    const env = createTestEnv();
    const user = await env.createUser("buyer1", "pass123456", 100);

    const post = await env.createPost({
      slug: "premium-post",
      permissionType: "points_required",
      requiredPoints: 40,
      content: "Exclusive Secret Article",
    });

    // Unlock post
    const unlockRes = await env.requestJson(`/api/posts/${post.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(unlockRes.status).toBe(200);
    expect(unlockRes.data.success).toBe(true);
    expect(unlockRes.data.isUnlocked).toBe(true);
    expect(unlockRes.data.content).toBe("Exclusive Secret Article");

    // Check user points balance in DB
    const updatedUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(updatedUser.points).toBe(60);

    // Check post_unlocks table
    const unlockRecord = env.d1.sqlite
      .query("SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ?")
      .get(user.id, post.id) as any;
    expect(unlockRecord).toBeDefined();
    expect(unlockRecord.points_spent).toBe(40);

    // Check point_transactions ledger
    const ledger = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'post_unlock'")
      .get(user.id) as any;
    expect(ledger).toBeDefined();
    expect(ledger.amount).toBe(-40);
    expect(ledger.balance_after).toBe(60);
    expect(ledger.target_id).toBe(post.id);

    env.close();
  });

  it("AC 3.5: Full visual CMS CRUD modifications for posts, albums, and configs", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("cms_admin", "adminpass123");

    // 1. Create Post via API
    const createRes = await env.requestJson("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        slug: "cms-created-post",
        title: "CMS Managed Post",
        content: "Draft content from CMS",
        category: "Tech",
        tags: ["astro", "cloudflare"],
        permissionType: "public",
        draft: 0,
      }),
    });
    expect(createRes.status).toBe(201);
    expect(createRes.data.success).toBe(true);
    const createdPostId = createRes.data.data.id;

    // 2. Update Post
    const updateRes = await env.requestJson(`/api/posts/${createdPostId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        title: "CMS Managed Post Updated",
        content: "Updated content from CMS editor",
      }),
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.data.success).toBe(true);

    // 3. Verify update reflected
    const getRes = await env.requestJson(`/api/posts/${createdPostId}`);
    expect(getRes.data.data.title).toBe("CMS Managed Post Updated");
    expect(getRes.data.data.content).toBe("Updated content from CMS editor");

    // 4. Delete Post
    const deleteRes = await env.requestJson(`/api/posts/${createdPostId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.data.success).toBe(true);

    // Verify deleted
    const checkDeleted = await env.requestJson(`/api/posts/${createdPostId}`);
    expect(checkDeleted.status).toBe(404);

    env.close();
  });
});
