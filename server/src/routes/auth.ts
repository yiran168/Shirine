import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { hashPassword, verifyPassword, generateSalt, signToken } from "../core/auth";
import { verifyTurnstile } from "../core/turnstile";
import { requireAuth } from "../core/middleware";

export const authRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Register
authRouter.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, nickname, turnstileToken } = body;

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return c.json({ success: false, error: "Username must be at least 3 characters" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return c.json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    // Verify Turnstile
    const turnstileCheck = await verifyTurnstile(c, turnstileToken);
    if (!turnstileCheck.success) {
      return c.json({ success: false, error: turnstileCheck.message || "Human verification failed" }, 400);
    }

    const db = getDb(c.env.DB);

    // Check if username already exists
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.username, username.trim()),
    });
    if (existing) {
      return c.json({ success: false, error: "Username is already taken" }, 400);
    }

    const role = "user";
    const points = 0;

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const inserted = await db
      .insert(schema.users)
      .values({
        username: username.trim(),
        nickname: nickname?.trim() || username.trim(),
        passwordHash,
        salt,
        role,
        points,
        status: "active",
      })
      .returning();

    const newUser = inserted[0];
    const token = await signToken(
      { id: newUser.id, username: newUser.username, role: newUser.role, sessionVersion: newUser.sessionVersion },
      c.env.JWT_SECRET
    );

    const isLocal = c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1");
    const secureFlag = isLocal ? "" : "; Secure";

    // Set cookie
    c.header(
      "Set-Cookie",
      `shirine_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secureFlag}`
    );

    return c.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        nickname: newUser.nickname,
        avatar: newUser.avatar,
        role: newUser.role,
        points: newUser.points,
        checkinStreak: newUser.checkinStreak,
      },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    return c.json({ success: false, error: err.message || "Registration failed" }, 500);
  }
});

// Setup status check (Returns whether initial setup is required)
authRouter.get("/setup/status", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.role, "superadmin"),
      columns: { id: true },
    });
    return c.json({
      success: true,
      needsSetup: !superadmin,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to check setup status" }, 500);
  }
});

// Bootstrap initial superadmin (allowed ONLY if 0 superadmins exist)
authRouter.post("/setup/admin", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.role, "superadmin"),
    });

    if (superadmin) {
      return c.json({ success: false, error: "System is already initialized with a superadmin" }, 403);
    }

    const body = await c.req.json();
    const { username, password, nickname, setupToken } = body;

    // If SETUP_TOKEN is defined in environment, require it
    if (c.env.SETUP_TOKEN && c.env.SETUP_TOKEN !== setupToken) {
      return c.json({ success: false, error: "Invalid setup authorization token" }, 403);
    }

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return c.json({ success: false, error: "Username must be at least 3 characters" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return c.json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const inserted = await db
      .insert(schema.users)
      .values({
        username: username.trim(),
        nickname: nickname?.trim() || username.trim(),
        passwordHash,
        salt,
        role: "superadmin",
        points: 100,
        status: "active",
        sessionVersion: 1,
      })
      .returning();

    const newUser = inserted[0];
    const token = await signToken(
      { id: newUser.id, username: newUser.username, role: newUser.role, sessionVersion: newUser.sessionVersion },
      c.env.JWT_SECRET
    );

    const isLocal = c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1");
    const secureFlag = isLocal ? "" : "; Secure";

    c.header(
      "Set-Cookie",
      `shirine_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secureFlag}`
    );

    return c.json({
      success: true,
      message: "SuperAdmin initialized successfully",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        nickname: newUser.nickname,
        avatar: newUser.avatar,
        role: newUser.role,
        points: newUser.points,
      },
    });
  } catch (err: any) {
    console.error("Setup admin error:", err);
    return c.json({ success: false, error: err.message || "Setup failed" }, 500);
  }
});

// Login
authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, turnstileToken } = body;

    if (!username || !password) {
      return c.json({ success: false, error: "Username and password are required" }, 400);
    }

    // Verify Turnstile
    const turnstileCheck = await verifyTurnstile(c, turnstileToken);
    if (!turnstileCheck.success) {
      return c.json({ success: false, error: turnstileCheck.message || "Human verification failed" }, 400);
    }

    const db = getDb(c.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username.trim()),
    });

    if (!user) {
      return c.json({ success: false, error: "Invalid username or password" }, 401);
    }

    if (user.status === "banned") {
      return c.json({ success: false, error: "This account has been banned" }, 403);
    }

    const isMatch = await verifyPassword(password, user.salt, user.passwordHash);
    if (!isMatch) {
      return c.json({ success: false, error: "Invalid username or password" }, 401);
    }

    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion },
      c.env.JWT_SECRET
    );

    const isLocal = c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1");
    const secureFlag = isLocal ? "" : "; Secure";

    c.header(
      "Set-Cookie",
      `shirine_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secureFlag}`
    );

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        points: user.points,
        checkinStreak: user.checkinStreak,
        lastCheckinDate: user.lastCheckinDate,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return c.json({ success: false, error: err.message || "Login failed" }, 500);
  }
});

// Current user profile
authRouter.get("/me", requireAuth, async (c) => {
  const current = c.get("user")!;
  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, current.id),
  });

  if (!user) {
    return c.json({ success: false, error: "User not found" }, 404);
  }

  // Check if today is already checked in (using Shanghai timezone)
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const checkedInToday = user.lastCheckinDate === today;

  return c.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
      points: user.points,
      status: user.status,
      checkinStreak: user.checkinStreak,
      lastCheckinDate: user.lastCheckinDate,
      checkedInToday,
      createdAt: user.createdAt,
    },
  });
});

// Logout
authRouter.post("/logout", async (c) => {
  const user = c.get("user");
  if (user && c.env.DB) {
    try {
      const db = getDb(c.env.DB);
      await db
        .update(schema.users)
        .set({
          sessionVersion: sql`${schema.users.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));
    } catch (err) {
      console.error("Logout session revocation failed:", err);
    }
  }

  const isLocal = c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1");
  const secureFlag = isLocal ? "" : "; Secure";

  c.header(
    "Set-Cookie",
    `shirine_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`
  );
  return c.json({ success: true, message: "Logged out successfully" });
});
