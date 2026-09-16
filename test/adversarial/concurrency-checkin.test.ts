import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Adversarial Concurrency: Daily Check-in", () => {
  it("C1.1: 20 simultaneous check-in requests for the same user on the same date result in exactly 1 success and zero duplicate bonuses", async () => {
    const env = createTestEnv();
    const user = await env.createUser("race_checkin_user", "password123", 0);

    // Concurrently fire 20 check-in requests at the exact same moment
    const concurrencyCount = 20;
    const promises = Array.from({ length: concurrencyCount }, () =>
      env.requestJson("/api/user/checkin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
      })
    );

    const responses = await Promise.all(promises);

    // Tally successes vs rejections
    const successes = responses.filter((r) => r.status === 200 && r.data.success === true);
    const rejections = responses.filter((r) => r.status === 400 && r.data.success === false);

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(concurrencyCount - 1);

    for (const rej of rejections) {
      expect(rej.data.error).toMatch(/already checked in today/i);
    }

    const awarded = successes[0].data.awardedPoints;
    expect(awarded).toBeGreaterThan(0);

    // DB Forensic Verification: check user points in users table
    const dbUser = env.d1.sqlite.query("SELECT points, checkin_streak, last_checkin_date FROM users WHERE id = ?").get(user.id) as any;
    expect(dbUser.points).toBe(awarded);
    expect(dbUser.checkin_streak).toBe(1);
    expect(dbUser.last_checkin_date).toBeTruthy();

    // DB Forensic Verification: check checkin_records table has exactly 1 row
    const checkinRows = env.d1.sqlite
      .query("SELECT * FROM checkin_records WHERE user_id = ?")
      .all(user.id) as any[];
    expect(checkinRows.length).toBe(1);
    expect(checkinRows[0].points_awarded).toBe(awarded);

    // DB Forensic Verification: check point_transactions table has exactly 1 row
    const ledgerRows = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'checkin'")
      .all(user.id) as any[];
    expect(ledgerRows.length).toBe(1);
    expect(ledgerRows[0].amount).toBe(awarded);
    expect(ledgerRows[0].balance_after).toBe(awarded);

    env.close();
  });

  it("C1.2: Multi-user high contention: 5 users concurrently sending 5 check-ins each (25 requests total)", async () => {
    const env = createTestEnv();
    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) => env.createUser(`multi_user_${i}`, "pass123456", 0))
    );

    // Each user fires 5 requests concurrently
    const allRequests = users.flatMap((u) =>
      Array.from({ length: 5 }, () =>
        env.requestJson("/api/user/checkin", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${u.token}`,
            "Content-Type": "application/json",
          },
        }).then((res) => ({ userId: u.id, res }))
      )
    );

    const results = await Promise.all(allRequests);

    for (const u of users) {
      const userResults = results.filter((r) => r.userId === u.id);
      const userSuccesses = userResults.filter((r) => r.res.status === 200 && r.res.data.success === true);
      const userRejections = userResults.filter((r) => r.res.status === 400);

      expect(userSuccesses.length).toBe(1);
      expect(userRejections.length).toBe(4);

      const dbUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(u.id) as any;
      expect(dbUser.points).toBe(userSuccesses[0].res.data.awardedPoints);
    }

    // Exactly 5 checkin_records in total
    const totalCheckins = env.d1.sqlite.query("SELECT COUNT(*) as cnt FROM checkin_records").get() as any;
    expect(totalCheckins.cnt).toBe(5);

    // Exactly 5 checkin transactions in total
    const totalTransactions = env.d1.sqlite
      .query("SELECT COUNT(*) as cnt FROM point_transactions WHERE type = 'checkin'")
      .get() as any;
    expect(totalTransactions.cnt).toBe(5);

    env.close();
  });

  it("C1.3: Subsequent check-in wave after successful check-in is strictly blocked", async () => {
    const env = createTestEnv();
    const user = await env.createUser("wave_user", "password123", 50);

    // Initial checkin
    const firstRes = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(firstRes.status).toBe(200);

    // Follow-up simultaneous wave of 10 requests
    const wave = await Promise.all(
      Array.from({ length: 10 }, () =>
        env.requestJson("/api/user/checkin", {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
        })
      )
    );

    for (const r of wave) {
      expect(r.status).toBe(400);
      expect(r.data.success).toBe(false);
    }

    // Ledger still has exactly 1 checkin row
    const ledger = env.d1.sqlite
      .query("SELECT * FROM point_transactions WHERE user_id = ? AND type = 'checkin'")
      .all(user.id) as any[];
    expect(ledger.length).toBe(1);

    env.close();
  });
});
