import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

describe("Tier 2 - Boundary: Authentication & Session Gateways", () => {
  it("B2.1: Login with invalid password returns 401 Unauthorized", async () => {
    const env = createTestEnv();
    await env.createUser("auth_boundary_user", "correct_pass_123", 0);

    const res = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "auth_boundary_user",
        password: "wrong_password_xyz",
      }),
    });

    expect(res.status).toBe(401);
    expect(res.data.success).toBe(false);
    expect(res.data.error).toContain("Invalid username or password");
    env.close();
  });

  it("B2.2: Login with non-existent username returns 401 Unauthorized", async () => {
    const env = createTestEnv();

    const res = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "non_existent_ghost_user",
        password: "any_password_123",
      }),
    });

    expect(res.status).toBe(401);
    expect(res.data.success).toBe(false);
    env.close();
  });

  it("B2.3: Register with duplicate username is rejected with 400 Bad Request", async () => {
    const env = createTestEnv();
    await env.createUser("existing_user", "pass123456");

    const res = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "existing_user",
        password: "another_pass_123",
      }),
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.error).toContain("already taken");
    env.close();
  });

  it("B2.4: Register with short password (<6 chars) or empty username is rejected", async () => {
    const env = createTestEnv();

    // 1. Password too short (< 6 chars)
    const shortPassRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "valid_name",
        password: "123",
      }),
    });
    expect(shortPassRes.status).toBe(400);
    expect(shortPassRes.data.success).toBe(false);

    // 2. Empty username
    const emptyUserRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "   ",
        password: "validpassword123",
      }),
    });
    expect(emptyUserRes.status).toBe(400);
    expect(emptyUserRes.data.success).toBe(false);

    env.close();
  });

  it("B2.5: Malformed Authorization header or corrupted token returns 401", async () => {
    const env = createTestEnv();

    const garbageTokens = [
      "Bearer not-a-jwt",
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted.signature",
      "Bearer ",
      "Basic dXNlcjpwYXNz",
    ];

    for (const authHeader of garbageTokens) {
      const res = await env.requestJson("/api/auth/me", {
        headers: { Authorization: authHeader },
      });
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    }

    env.close();
  });

  it("B2.6: Logout session token revocation prevents subsequent protected endpoint access", async () => {
    const env = createTestEnv();
    const user = await env.createUser("revocation_test", "pass123456");

    // 1. Access before logout succeeds
    const beforeRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(beforeRes.status).toBe(200);

    // 2. Logout
    const logoutRes = await env.requestJson("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.data.success).toBe(true);

    // 3. Access after logout fails with 401
    const afterRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(afterRes.status).toBe(401);
    expect(afterRes.data.success).toBe(false);

    env.close();
  });

  it("B2.7: Login with ADMIN_USERNAME and ADMIN_PASSWORD environment secrets auto-bootstraps superadmin", async () => {
    const env = createTestEnv();
    env.env.ADMIN_USERNAME = "secret_admin";
    env.env.ADMIN_PASSWORD = "secret_password_987";

    // 1. Setup status reports completed because admin secrets are present
    const statusRes = await env.requestJson("/api/auth/setup/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.data.state).toBe("completed");
    expect(statusRes.data.needsSetup).toBe(false);

    // 2. Wrong password for env admin fails with 401
    const wrongPassRes = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "secret_admin",
        password: "incorrect_password",
      }),
    });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.data.success).toBe(false);

    // 3. Correct env credentials auto-bootstraps superadmin (case-insensitive username)
    const loginRes = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "SECRET_ADMIN",
        password: "secret_password_987",
      }),
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.data.success).toBe(true);
    expect(loginRes.data.user.role).toBe("superadmin");
    expect(typeof loginRes.data.token).toBe("string");

    // 4. Authenticated request as superadmin succeeds
    const meRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${loginRes.data.token}` },
    });
    expect(meRes.status).toBe(200);
    expect(meRes.data.user.role).toBe("superadmin");

    env.close();
  });

  it("B2.8: When only ADMIN_PASSWORD is set, ADMIN_USERNAME defaults to 'admin'", async () => {
    const env = createTestEnv();
    env.env.ADMIN_PASSWORD = "admin_only_pass_999";

    const statusRes = await env.requestJson("/api/auth/setup/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.data.needsSetup).toBe(false);

    const loginRes = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "admin_only_pass_999",
      }),
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.data.success).toBe(true);
    expect(loginRes.data.user.role).toBe("superadmin");

    env.close();
  });

  it("B2.9: Register with valid email stores email, rejects invalid email format", async () => {
    const env = createTestEnv();

    // 1. Invalid email format rejected
    const invalidEmailRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "email_tester_1",
        email: "not-an-email",
        password: "password123",
      }),
    });
    expect(invalidEmailRes.status).toBe(400);
    expect(invalidEmailRes.data.success).toBe(false);
    expect(invalidEmailRes.data.error).toContain("Invalid email address format");

    // 2. Valid email succeeds and returns email in user object
    const validRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "email_tester_1",
        email: "user1@example.com",
        password: "password123",
      }),
    });
    expect(validRes.status).toBe(201);
    expect(validRes.data.success).toBe(true);
    expect(validRes.data.user.email).toBe("user1@example.com");

    // 3. User profile (/auth/me) reflects email
    const meRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${validRes.data.token}` },
    });
    expect(meRes.status).toBe(200);
    expect(meRes.data.user.email).toBe("user1@example.com");

    env.close();
  });

  it("B2.10: Register with duplicate email is rejected with 400 Bad Request", async () => {
    const env = createTestEnv();

    const firstRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "first_user",
        email: "shared@example.com",
        password: "password123",
      }),
    });
    expect(firstRes.status).toBe(201);

    const dupRes = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "second_user",
        email: "SHARED@example.com", // case-insensitive check
        password: "password123",
      }),
    });
    expect(dupRes.status).toBe(400);
    expect(dupRes.data.success).toBe(false);
    expect(dupRes.data.error).toContain("Email is already registered");

    env.close();
  });

  it("B2.11: Login using email address instead of username succeeds (case-insensitive)", async () => {
    const env = createTestEnv();

    await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "login_email_user",
        email: "Member@Example.com",
        password: "mySecretPassword123",
      }),
    });

    // 1. Login with uppercase email
    const loginUpperRes = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "MEMBER@EXAMPLE.COM",
        password: "mySecretPassword123",
      }),
    });
    expect(loginUpperRes.status).toBe(200);
    expect(loginUpperRes.data.success).toBe(true);
    expect(loginUpperRes.data.user.username).toBe("login_email_user");
    expect(loginUpperRes.data.user.email).toBe("member@example.com");

    // 2. Login with lowercase email
    const loginLowerRes = await env.requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "member@example.com",
        password: "mySecretPassword123",
      }),
    });
    expect(loginLowerRes.status).toBe(200);
    expect(loginLowerRes.data.success).toBe(true);
    expect(loginLowerRes.data.user.username).toBe("login_email_user");

    env.close();
  });
});
