import { Hono, type Context } from "hono";
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
    const db = getDb(c.env.DB);

    // V10-P0-23: Require setup to be completed before allowing public user registration
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.role, "superadmin"),
      columns: { id: true },
    });
    if (!superadmin) {
      return c.json(
        { success: false, error: "Initial system setup is required before public registration is available", code: "SETUP_REQUIRED" },
        403
      );
    }

    const body = await c.req.json();
    const { username, password, nickname, turnstileToken } = body;

    // V10-P0-24: Strict length and charset limits
    if (!username || typeof username !== "string" || username.trim().length < 3 || username.trim().length > 32) {
      return c.json({ success: false, error: "Username must be between 3 and 32 characters" }, 400);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username.trim())) {
      return c.json({ success: false, error: "Username can only contain alphanumeric characters, underscores, hyphens, and dots" }, 400);
    }

    const reservedUsernames = [
      "admin",
      "administrator",
      "root",
      "system",
      "shirine",
      "superuser",
      "guest",
      "owner",
      "moderator",
      "mod",
    ];
    if (reservedUsernames.includes(username.trim().toLowerCase())) {
      return c.json({ success: false, error: "This username is reserved by the system" }, 400);
    }

    if (!password || typeof password !== "string" || password.length < 6 || password.length > 128) {
      return c.json({ success: false, error: "Password must be between 6 and 128 characters" }, 400);
    }
    if (nickname !== undefined && (typeof nickname !== "string" || nickname.trim().length > 64)) {
      return c.json({ success: false, error: "Nickname cannot exceed 64 characters" }, 400);
    }

    // Verify Turnstile
    const turnstileCheck = await verifyTurnstile(c, turnstileToken);
    if (!turnstileCheck.success) {
      return c.json({ success: false, error: turnstileCheck.message || "Human verification failed" }, 400);
    }

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

    const isLoopback = isLoopbackRequest(c);
    const secureFlag = isLoopback ? "" : "; Secure";

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

function isLoopbackRequest(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  try {
    const url = new URL(c.req.url);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

// Setup status check (Returns explicit state machine: completed | uninitialized | broken: V10-P0-08)
authRouter.get("/setup/status", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.role, "superadmin"),
      columns: { id: true },
    });
    const setupStateRow = await db.query.setupState.findFirst({
      where: eq(schema.setupState.id, 1),
    });

    let state: "completed" | "uninitialized" | "broken" = "uninitialized";
    let needsSetup = true;

    if (superadmin) {
      state = "completed";
      needsSetup = false;
    } else if (setupStateRow && setupStateRow.completed === 1) {
      state = "broken";
      needsSetup = true;
    } else {
      state = "uninitialized";
      needsSetup = true;
    }

    return c.json({
      success: true,
      state,
      needsSetup,
      isBroken: state === "broken",
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to check setup status" }, 500);
  }
});

// Bootstrap initial superadmin (atomic claim, fail-closed production check, self-heals broken state: V10-P0-08)
authRouter.post("/setup/admin", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { username, password, nickname, setupToken } = body;

    // 1. Upfront input validation to prevent claim locking on bad input
    if (!username || typeof username !== "string" || username.trim().length < 3 || username.trim().length > 32) {
      return c.json({ success: false, error: "Username must be between 3 and 32 characters" }, 400);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username.trim())) {
      return c.json({ success: false, error: "Username can only contain alphanumeric characters, underscores, hyphens, and dots" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6 || password.length > 128) {
      return c.json({ success: false, error: "Password must be between 6 and 128 characters" }, 400);
    }
    if (nickname !== undefined && (typeof nickname !== "string" || nickname.trim().length > 64)) {
      return c.json({ success: false, error: "Nickname cannot exceed 64 characters" }, 400);
    }

    const isLoopback = isLoopbackRequest(c);
    const isProduction = c.env.ENVIRONMENT === "production";
    if (isProduction || !isLoopback) {
      if (!c.env.SETUP_TOKEN) {
        return c.json(
          { success: false, error: "Setup is disabled: SETUP_TOKEN secret must be configured in production environment" },
          403
        );
      }
      if (c.env.SETUP_TOKEN !== setupToken) {
        return c.json({ success: false, error: "Invalid setup authorization token" }, 403);
      }
    } else if (c.env.SETUP_TOKEN && c.env.SETUP_TOKEN !== setupToken) {
      return c.json({ success: false, error: "Invalid setup authorization token" }, 403);
    }

    // 2. Check existing superadmin
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.role, "superadmin"),
    });
    if (superadmin) {
      return c.json({ success: false, error: "System is already initialized with a superadmin" }, 403);
    }

    // 3. Atomic claim of setup initialization with self-healing (V10-P0-08)
    const existingState = await db.query.setupState.findFirst({
      where: eq(schema.setupState.id, 1),
    });
    if (!existingState) {
      try {
        await db.insert(schema.setupState).values({ id: 1, completed: 0 });
      } catch {
        return c.json({ success: false, error: "Concurrent setup initialization detected. Please retry." }, 409);
      }
    } else if (existingState.completed === 1) {
      // Self-heal broken state where completed=1 but no superadmin exists (V10-P0-08)
      if (c.env.SETUP_TOKEN && c.env.SETUP_TOKEN !== setupToken) {
        return c.json({ success: false, error: "Repairing broken setup requires a valid SETUP_TOKEN" }, 403);
      }
      console.warn("[Setup] Recovering from broken setup state: resetting setup_state.completed to 0");
      await db.update(schema.setupState).set({ completed: 0 }).where(eq(schema.setupState.id, 1));
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    let newUser;
    try {
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

      newUser = inserted[0];

      // Mark setup state completed
      await db.update(schema.setupState).set({ completed: 1 }).where(eq(schema.setupState.id, 1));
    } catch (createErr) {
      // Roll back uncompleted setup state claim if user creation failed
      try {
        const stillNoSuperAdmin = !(await db.query.users.findFirst({ where: eq(schema.users.role, "superadmin") }));
        if (stillNoSuperAdmin) {
          await db.delete(schema.setupState).where(eq(schema.setupState.id, 1));
        }
      } catch {}
      throw createErr;
    }

    // Claim ownership of seeded orphan records where uid is NULL (V8-P0-23)
    await db.update(schema.posts).set({ uid: newUser.id }).where(sql`${schema.posts.uid} IS NULL`);
    await db.update(schema.albums).set({ uid: newUser.id }).where(sql`${schema.albums.uid} IS NULL`);
    await db.update(schema.moments).set({ uid: newUser.id }).where(sql`${schema.moments.uid} IS NULL`);
    await db.update(schema.friends).set({ uid: newUser.id }).where(sql`${schema.friends.uid} IS NULL`);

    const token = await signToken(
      { id: newUser.id, username: newUser.username, role: newUser.role, sessionVersion: newUser.sessionVersion },
      c.env.JWT_SECRET
    );

    const secureFlag = isProduction || !isLoopback ? "; Secure" : "";

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

    if (!username || typeof username !== "string" || username.trim().length > 64) {
      return c.json({ success: false, error: "Username is required and cannot exceed 64 characters" }, 400);
    }
    if (!password || typeof password !== "string" || password.length > 128) {
      return c.json({ success: false, error: "Password is required and cannot exceed 128 characters" }, 400);
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

    const isLoopback = isLoopbackRequest(c);
    const isProduction = c.env.ENVIRONMENT === "production";
    const secureFlag = isProduction || !isLoopback ? "; Secure" : "";

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

// Logout current session (Per-session revocation: V8-P0-09, V8-P0-10)
authRouter.post("/logout", async (c) => {
  const user = c.get("user");
  if (user && c.env.DB) {
    try {
      const db = getDb(c.env.DB);
      if (user.jti) {
        await db
          .insert(schema.revokedTokens)
          .values({
            jti: user.jti,
            userId: user.id,
            expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
          })
          .onConflictDoNothing();
      } else {
        await db
          .update(schema.users)
          .set({
            sessionVersion: sql`${schema.users.sessionVersion} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id));
      }
    } catch (err) {
      console.error("Logout session revocation failed:", err);
    }
  }

  const isLoopback = isLoopbackRequest(c);
  const isProduction = c.env.ENVIRONMENT === "production";
  const secureFlag = isProduction || !isLoopback ? "; Secure" : "";

  c.header(
    "Set-Cookie",
    `shirine_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`
  );
  return c.json({ success: true, message: "Logged out successfully" });
});

// Logout all devices / sessions
authRouter.post("/logout-all", requireAuth, async (c) => {
  const user = c.get("user")!;
  if (c.env.DB) {
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
      console.error("Logout-all session revocation failed:", err);
    }
  }

  const isLoopback = isLoopbackRequest(c);
  const isProduction = c.env.ENVIRONMENT === "production";
  const secureFlag = isProduction || !isLoopback ? "; Secure" : "";

  c.header(
    "Set-Cookie",
    `shirine_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`
  );
  return c.json({ success: true, message: "Logged out from all devices" });
});
