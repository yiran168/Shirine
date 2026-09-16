import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Adversarial: Boundary & Injection (Points & Roles)", () => {
  it("B4.1: Negative points and integer overflow clamping in point adjustments", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("point_bound_admin", "adminpass123");
    const user = await env.createUser("point_bound_user", "pass123456", 50);

    // 1. Admin sets exactPoints to negative (-100): must be clamped to 0
    const resNegativeExact = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: -100 }),
    });
    expect(resNegativeExact.status).toBe(200);
    expect(resNegativeExact.data.currentPoints).toBe(0);

    const checkUser1 = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser1.points).toBe(0);

    // 2. Add points back to 30
    await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: 30 }),
    });

    // 3. Admin applies excessive negative delta (-999999): must be clamped to 0, not negative
    const resNegativeDelta = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: -999999 }),
    });
    expect(resNegativeDelta.status).toBe(200);
    expect(resNegativeDelta.data.currentPoints).toBe(0);

    const checkUser2 = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser2.points).toBe(0);

    // 4. Verify SQLite schema CHECK constraint prevents points < 0 at the engine level
    expect(() => {
      env.d1.sqlite.query("UPDATE users SET points = -1 WHERE id = ?").run(user.id);
    }).toThrow();

    env.close();
  });

  it("B4.2: NaN, float, and non-integer inputs are sanitized safely without crashing", async () => {
    const env = createTestEnv();
    const admin = await env.createSuperadmin("nan_admin", "adminpass123");
    const user = await env.createUser("nan_user", "pass123456", 20);

    // 1. "NaN" string in exactPoints falls back to 0
    const resNaN = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: "NaN" }),
    });
    expect(resNaN.status).toBe(200);
    expect(resNaN.data.currentPoints).toBe(0);

    // 2. Float input in exactPoints: 42.87 is truncated/parsed as integer 42
    const resFloat = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: 42.87 }),
    });
    expect(resFloat.status).toBe(200);
    expect(resFloat.data.currentPoints).toBe(42);

    const checkUser = env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id) as any;
    expect(checkUser.points).toBe(42);
    expect(Number.isInteger(checkUser.points)).toBe(true);

    // 3. Garbage text in delta: points remain unchanged
    const resGarbage = await env.requestJson(`/api/admin/users/${user.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: "invalid_text_123" }),
    });
    expect(resGarbage.status).toBe(200);
    expect(resGarbage.data.currentPoints).toBe(42);

    env.close();
  });

  it("B4.3: Privilege elevation: Regular user cannot elevate role or forge points", async () => {
    const env = createTestEnv();
    const attacker = await env.createUser("attacker_user", "hacker123", 0);

    // Attack 1: Attempt to call admin role route
    const resRoleAdmin = await env.requestJson(`/api/admin/users/${attacker.id}/role`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${attacker.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "superadmin" }),
    });
    expect(resRoleAdmin.status).toBe(403);

    // Attack 2: Attempt to call admin points route
    const resPointsAdmin = await env.requestJson(`/api/admin/users/${attacker.id}/points`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${attacker.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exactPoints: 999999 }),
    });
    expect(resPointsAdmin.status).toBe(403);

    // Attack 3: Attempt to inject role & points in PUT /api/user/profile
    const resProfile = await env.requestJson("/api/user/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${attacker.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: "Renamed User",
        role: "superadmin",
        points: 999999,
      }),
    });
    expect(resProfile.status).toBe(200);
    expect(resProfile.data.user.role).toBe("user");
    expect(resProfile.data.user.points).toBe(0);

    // Forensic verification from DB
    const dbAttacker = env.d1.sqlite.query("SELECT role, points FROM users WHERE id = ?").get(attacker.id) as any;
    expect(dbAttacker.role).toBe("user");
    expect(dbAttacker.points).toBe(0);

    // Attack 4: Attempt to register with role: 'superadmin' and points: 10000
    const resRegister = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "fake_admin_reg",
        password: "securepassword123",
        role: "superadmin",
        points: 10000,
      }),
    });
    expect(resRegister.status).toBe(201);
    expect(resRegister.data.user.role).toBe("user");
    expect(resRegister.data.user.points).toBe(0);

    const dbReg = env.d1.sqlite.query("SELECT role, points FROM users WHERE username = 'fake_admin_reg'").get() as any;
    expect(dbReg.role).toBe("user");
    expect(dbReg.points).toBe(0);

    env.close();
  });

  it("B4.4: Role hierarchy: Admin cannot promote to superadmin or modify superadmin points", async () => {
    const env = createTestEnv();
    const superadmin = await env.createSuperadmin("real_superadmin", "superpass123");

    // Create a regular admin
    const adminUser = await env.createUser("regular_admin", "adminpass123", 100);
    env.d1.sqlite.query("UPDATE users SET role = 'admin' WHERE id = ?").run(adminUser.id);
    const regularAdmin = {
      ...adminUser,
      role: "admin" as const,
    };

    const targetUser = await env.createUser("target_user", "targetpass123", 0);

    // 1. Regular admin tries to promote user to superadmin: rejected with 403
    const resPromote = await env.requestJson(`/api/admin/users/${targetUser.id}/role`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${regularAdmin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "superadmin" }),
    });
    expect(resPromote.status).toBe(403);
    expect(resPromote.data.error).toMatch(/Only superadmin can change user roles/i);

    // 2. Regular admin tries to adjust superadmin's points: rejected with 403
    const resAdjustSuper = await env.requestJson(`/api/admin/users/${superadmin.id}/points`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${regularAdmin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta: 500 }),
    });
    expect(resAdjustSuper.status).toBe(403);
    expect(resAdjustSuper.data.error).toMatch(/Only superadmin can adjust superadmin points/i);

    // 3. Superadmin attempts to change their own role: rejected with 400
    const resSelfRole = await env.requestJson(`/api/admin/users/${superadmin.id}/role`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${superadmin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(resSelfRole.status).toBe(400);
    expect(resSelfRole.data.error).toMatch(/Cannot change your own role/i);

    // 4. Invalid role injection (e.g. 'root', SQL injection, XSS)
    const invalidRoles = [
      "root",
      "admin' OR 1=1--",
      "<script>alert(1)</script>",
      "",
      "moderator",
    ];

    for (const badRole of invalidRoles) {
      const resBad = await env.requestJson(`/api/admin/users/${targetUser.id}/role`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${superadmin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: badRole }),
      });
      expect(resBad.status).toBe(400);
      expect(resBad.data.error).toMatch(/Invalid role/i);
    }

    // 5. Schema CHECK constraint ensures role IN ('superadmin', 'admin', 'user')
    expect(() => {
      env.d1.sqlite.query("UPDATE users SET role = 'hacker' WHERE id = ?").run(targetUser.id);
    }).toThrow();

    env.close();
  });
});
