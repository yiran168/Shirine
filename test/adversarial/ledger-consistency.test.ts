import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Adversarial: Ledger Consistency & Invariants", () => {
  it("L3.1: Complete lifecycle point transaction chain strictly preserves balance_after invariant", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("ledger_superadmin", "superpass123");
    const initialPoints = 50;
    const user = await env.createUser("ledger_audit_user", "pass123456", initialPoints);

    // Step 1: Daily check-in (+awarded)
    const checkinRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(checkinRes.status).toBe(200);
    const checkinPoints = checkinRes.data.awardedPoints;

    // Step 2: Admin point adjustment (+100 via delta)
    const grantRes = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: 100, description: "Milestone achievement bonus" }),
    });
    expect(grantRes.status).toBe(200);

    // Step 3: Post unlock (-45)
    const postA = await env.createPost({
      slug: "post-unlock-45",
      permissionType: "points_required",
      requiredPoints: 45,
      content: "Content 45",
    });
    const unlockPostRes = await env.requestJson(`/api/posts/${postA.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(unlockPostRes.status).toBe(200);

    // Step 4: Album unlock (-35)
    const albumA = await env.createAlbum({
      title: "Album Unlock 35",
      permissionType: "points_required",
      requiredPoints: 35,
    });
    const unlockAlbumRes = await env.requestJson(`/api/albums/${albumA.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(unlockAlbumRes.status).toBe(200);

    // Step 5: Admin adjustment (-30 via negative delta)
    const deductRes = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: -30, description: "Administrative correction" }),
    });
    expect(deductRes.status).toBe(200);

    // Step 6: Admin exact points adjustment (exactPoints: 120)
    const exactRes1 = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: 120, description: "Reset balance to 120" }),
    });
    expect(exactRes1.status).toBe(200);

    // Step 7: Post unlock (-50)
    const postB = await env.createPost({
      slug: "post-unlock-50",
      permissionType: "points_required",
      requiredPoints: 50,
      content: "Content 50",
    });
    const unlockPostBRes = await env.requestJson(`/api/posts/${postB.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(unlockPostBRes.status).toBe(200);

    // Step 8: Admin adjustment via amount parameter (-20)
    const amountDeductRes = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: -20, description: "Amount adjustment -20" }),
    });
    expect(amountDeductRes.status).toBe(200);

    // Step 9: Admin exact adjustment to 0
    const zeroRes = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: 0, description: "Drain balance to zero" }),
    });
    expect(zeroRes.status).toBe(200);

    // Step 10: Admin adjustment (+25)
    const finalAddRes = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: 25, description: "Final grant" }),
    });
    expect(finalAddRes.status).toBe(200);

    // Forensic Database Audit
    const finalDbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(finalDbUser.points).toBe(25);

    // Fetch all transaction records in exact chronological order
    const transactions = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? ORDER BY id ASC")
      .all(user.id) as Array<{
        id: number;
        type: string;
        amount: number;
        balance_after: number;
        target_id: number | null;
        idempotency_key: string | null;
        description: string;
        created_at: number;
      }>;

    expect(transactions.length).toBe(10);

    // Audit each transaction against strict ledger invariants:
    // Invariant 1: For each transaction i, balance_after[i] === balance_before[i] + amount[i]
    // Invariant 2: balance_after[i] >= 0
    // Invariant 3: amount and balance_after are strictly integers
    // Invariant 4: Last balance_after === users.points
    let rollingBalance = initialPoints;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Invariant: integer amounts
      expect(Number.isInteger(tx.amount)).toBe(true);
      expect(Number.isInteger(tx.balance_after)).toBe(true);
      expect(tx.balance_after).toBeGreaterThanOrEqual(0);

      // Invariant: balance equation
      expect(rollingBalance + tx.amount).toBe(tx.balance_after);

      // Verify idempotency keys exist and are non-empty
      expect(tx.idempotency_key).toBeTruthy();

      // Advance rolling balance
      rollingBalance = tx.balance_after;
    }

    // Strict alignment with user table
    expect(rollingBalance).toBe(finalDbUser.points);

    env.close();
  });

  it("L3.2: Ledger immutability: UNIQUE idempotency_key prevents duplicate entries", async () => {
    const env = createTestEnv();
    const user = await env.createUser("idempotency_user", "pass123456", 100);

    // Manually insert an initial transaction
    env.d1.sqlite
      .query(
        "INSERT INTO point_transactions (user_id, type, amount, balance_after, idempotency_key, description, created_at) VALUES (?, 'admin_adjust', 50, 150, 'unique_key_123', 'First', unixepoch())"
      )
      .run(user.id);

    // Attempting to insert another transaction with the exact same idempotency_key MUST fail
    expect(() => {
      env.d1.sqlite
        .query(
          "INSERT INTO point_transactions (user_id, type, amount, balance_after, idempotency_key, description, created_at) VALUES (?, 'admin_adjust', 20, 170, 'unique_key_123', 'Duplicate', unixepoch())"
        )
        .run(user.id);
    }).toThrow();

    // Verify only 1 record exists
    const rows = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE idempotency_key = 'unique_key_123'")
      .all() as any[];
    expect(rows.length).toBe(1);

    env.close();
  });

  it("L3.3: Zero orphaned ledger entries on failed operations", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("orphan_admin", "superpass123");
    const user = await env.createUser("orphan_user", "pass123456", 10);

    // Count initial transactions (should be 0)
    const initialTxCount = (
      env.d1.sqlite.query("SELECT COUNT(*) as cnt FROM point_transactions").get() as any
    ).cnt;

    // 1. Failed unlock (insufficient points)
    const post = await env.createPost({
      slug: "too-expensive-post",
      permissionType: "points_required",
      requiredPoints: 500,
    });
    const failedUnlock = await env.requestJson(`/api/posts/${post.id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(failedUnlock.status).toBe(400);

    // 2. Failed duplicate check-in
    await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const failedCheckin = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(failedCheckin.status).toBe(400);

    // 3. Failed admin adjust on non-existent user
    const failedAdmin = await env.requestJson("/api/admin/users/999999/points", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: 50 }),
    });
    expect(failedAdmin.status).toBe(404);

    // Verify point_transactions only has the 1 successful check-in, ZERO orphaned records from failed operations
    const txRecords = env.d1.sqlite
      .query("SELECT * FROM point_transactions")
      .all() as any[];

    // Exactly 1 checkin row, 0 post_unlock rows, 0 admin_adjust rows for non-existent user
    expect(txRecords.length).toBe(initialTxCount + 1);
    expect(txRecords[txRecords.length - 1].type).toBe("checkin");

    env.close();
  });
});
