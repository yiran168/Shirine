import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { signToken } from "../../server/src/core/auth";

describe("Adversarial: Session Revocation & JWT Invalidation", () => {
  it("S5.1: Token revocation on logout blocks all protected endpoints across user, checkin, and profile routes", async () => {
    const env = createTestEnv();
    const user = await env.createUser("revoked_user_1", "pass123456", 10);

    // 1. Verify access works before logout
    const preMe = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(preMe.status).toBe(200);

    const preProfile = await env.requestJson("/api/user/profile", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(preProfile.status).toBe(200);

    // 2. Perform logout
    const logoutRes = await env.requestJson("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.data.success).toBe(true);

    // Verify revoked_tokens table has recorded the token's jti
    const revokedCount = (
      env.d1.sqlite.query("SELECT COUNT(*) as cnt FROM revoked_tokens WHERE user_id = ?").get(user.id) as any
    ).cnt;
    expect(revokedCount).toBe(1);

    // 3. Verify ALL protected endpoints reject the revoked token with 401
    const postMe = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(postMe.status).toBe(401);
    expect(postMe.data.error).toMatch(/Unauthorized/i);

    const postProfile = await env.requestJson("/api/user/profile", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(postProfile.status).toBe(401);

    const postCheckin = await env.requestJson("/api/user/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(postCheckin.status).toBe(401);

    const postUpdateProfile = await env.requestJson("/api/user/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nickname: "Hacked Nickname" }),
    });
    expect(postUpdateProfile.status).toBe(401);

    env.close();
  });

  it("S5.2: Multi-session isolation: Single session logout revokes only target session, logout-all revokes all", async () => {
    const env = createTestEnv();
    const user = await env.createUser("multi_session_user", "pass123456", 0);

    // Generate two independent tokens with distinct JTIs (e.g. Device A and Device B)
    const tokenA = await signToken(
      { id: user.id, username: user.username, role: user.role, sessionVersion: 1 },
      env.jwtSecret
    );
    const tokenB = await signToken(
      { id: user.id, username: user.username, role: user.role, sessionVersion: 1 },
      env.jwtSecret
    );

    // Both tokens valid initially
    const testA1 = await env.requestJson("/api/auth/me", { headers: { Authorization: `Bearer ${tokenA}` } });
    const testB1 = await env.requestJson("/api/auth/me", { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(testA1.status).toBe(200);
    expect(testB1.status).toBe(200);

    // User logs out from Device A
    const logoutA = await env.requestJson("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(logoutA.status).toBe(200);

    // Device A token is now 401
    const testA2 = await env.requestJson("/api/auth/me", { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(testA2.status).toBe(401);

    // Device B token is STILL VALID (200)
    const testB2 = await env.requestJson("/api/auth/me", { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(testB2.status).toBe(200);

    // User triggers logout-all from Device B
    const logoutAll = await env.requestJson("/api/auth/logout-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(logoutAll.status).toBe(200);

    // Now Device B token is ALSO invalidated (sessionVersion incremented)
    const testB3 = await env.requestJson("/api/auth/me", { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(testB3.status).toBe(401);

    env.close();
  });

  it("S5.3: Password change invalidates old sessions and grants new valid session", async () => {
    const env = createTestEnv();
    const user = await env.createUser("pwd_change_user", "oldpassword123", 0);

    // Change password via PUT /api/user/profile
    const changeRes = await env.requestJson("/api/user/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: "oldpassword123",
        newPassword: "brandnewpassword456",
      }),
    });

    expect(changeRes.status).toBe(200);
    expect(changeRes.data.success).toBe(true);
    const newToken = changeRes.data.token;
    expect(newToken).toBeTruthy();

    // Old token must be rejected with 401
    const oldRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(oldRes.status).toBe(401);

    // New token must succeed with 200
    const newRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    expect(newRes.status).toBe(200);

    env.close();
  });

  it("S5.4: Account ban immediately cuts off all active tokens", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("ban_hammer_admin", "superpass123");
    const victim = await env.createUser("banned_target_user", "targetpass123", 0);

    // Token works initially
    const initialRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${victim.token}` },
    });
    expect(initialRes.status).toBe(200);

    // Admin bans the user
    const banRes = await env.requestJson(`/api/admin/users/${victim.id}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "banned" }),
    });
    expect(banRes.status).toBe(200);

    // Immediate subsequent request with active token is rejected with 401
    const blockedRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${victim.token}` },
    });
    expect(blockedRes.status).toBe(401);
    expect(blockedRes.data.error).toMatch(/Unauthorized/i);

    env.close();
  });
});
