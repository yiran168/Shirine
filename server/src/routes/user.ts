import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth } from "../core/middleware";
import { hashPassword, generateSalt, verifyPassword, signToken } from "../core/auth";

export const userRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function getLocalDateString(date: Date, timeZone = "Asia/Shanghai"): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // YYYY-MM-DD
}

function getYesterdayDateString(date: Date, timeZone = "Asia/Shanghai"): string {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getLocalDateString(yesterday, timeZone);
}

// Daily Check-in (Timezone-aware with Asia/Shanghai #103, atomic execution #102)
userRouter.post("/checkin", requireAuth, async (c) => {
  try {
    const current = c.get("user")!;
    const db = getDb(c.env.DB);

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, current.id),
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Read timezone from site config if configured
    let siteTimeZone = "Asia/Shanghai";
    try {
      const siteConfigRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      if (siteConfigRow) {
        const parsed = JSON.parse(siteConfigRow.value);
        if (parsed.timeZone) siteTimeZone = parsed.timeZone;
      }
    } catch {}

    const now = new Date();
    const today = getLocalDateString(now, siteTimeZone);
    const yesterday = getYesterdayDateString(now, siteTimeZone);

    // Check if already checked in today
    const existingCheckin = await db.query.checkinRecords.findFirst({
      where: and(
        eq(schema.checkinRecords.userId, user.id),
        eq(schema.checkinRecords.checkinDate, today)
      ),
    });

    if (existingCheckin || user.lastCheckinDate === today) {
      return c.json({ success: false, error: "You have already checked in today! Come back tomorrow." }, 400);
    }

    // Read checkin rules from system_configs
    const ruleRow = await db.query.systemConfigs.findFirst({
      where: eq(schema.systemConfigs.key, "checkin_rule"),
    });

    let checkinRule = {
      mode: "fixed",
      fixedPoints: 10,
      randomMin: 5,
      randomMax: 20,
    };

    if (ruleRow) {
      try {
        checkinRule = { ...checkinRule, ...JSON.parse(ruleRow.value) };
      } catch {}
    }

    let awarded = Math.max(1, Number(checkinRule.fixedPoints) || 10);
    if (checkinRule.mode === "random") {
      const min = Math.max(1, Number(checkinRule.randomMin) || 1);
      const max = Math.max(min, Number(checkinRule.randomMax) || min);
      awarded = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Calculate streak
    const newStreak = user.lastCheckinDate === yesterday ? user.checkinStreak + 1 : 1;
    const newPoints = user.points + awarded;
    const idempotencyKey = `checkin_${user.id}_${today}`;

    // Atomic execution using D1 batch (#102, P0-14, V8-P0-01)
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO checkin_records (user_id, checkin_date, points_awarded, created_at) VALUES (?, ?, ?, unixepoch())"
      ).bind(user.id, today, awarded),
      c.env.DB.prepare(
        "UPDATE users SET points = points + ?, last_checkin_date = ?, checkin_streak = ?, updated_at = unixepoch() WHERE id = ?"
      ).bind(awarded, today, newStreak, user.id),
      c.env.DB.prepare(
        "INSERT INTO point_transactions (user_id, type, amount, balance_after, target_id, idempotency_key, description, created_at) VALUES (?, 'checkin', ?, ?, NULL, ?, ?, unixepoch())"
      ).bind(user.id, awarded, newPoints, idempotencyKey, `Daily check-in streak: ${newStreak} days`),
    ]);

    return c.json({
      success: true,
      message: `Checked in successfully! You earned +${awarded} points.`,
      awardedPoints: awarded,
      pointsAwarded: awarded,
      currentPoints: newPoints,
      points: newPoints,
      checkinStreak: newStreak,
      checkinDate: today,
    });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return c.json({ success: false, error: "You have already checked in today!" }, 400);
    }
    console.error("Checkin error:", err);
    return c.json({ success: false, error: err.message || "Failed to complete daily check-in" }, 500);
  }
});

// Check-in History & Stats
userRouter.get("/history", requireAuth, async (c) => {
  try {
    const current = c.get("user")!;
    const db = getDb(c.env.DB);

    const records = await db.query.checkinRecords.findMany({
      where: eq(schema.checkinRecords.userId, current.id),
      orderBy: [desc(schema.checkinRecords.createdAt)],
      limit: 30,
    });

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, current.id),
      columns: {
        points: true,
        checkinStreak: true,
        lastCheckinDate: true,
      },
    });

    return c.json({
      success: true,
      data: {
        records,
        streak: user?.checkinStreak ?? 0,
        points: user?.points ?? 0,
        lastCheckinDate: user?.lastCheckinDate,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch history" }, 500);
  }
});

// Get Current User Profile (GET /api/user/profile)
userRouter.get("/profile", requireAuth, async (c) => {
  try {
    const current = c.get("user")!;
    const db = getDb(c.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, current.id),
    });

    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    let siteTimeZone = "Asia/Shanghai";
    try {
      const siteConfigRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      if (siteConfigRow) {
        const parsed = JSON.parse(siteConfigRow.value);
        if (parsed.timeZone) siteTimeZone = parsed.timeZone;
      }
    } catch {}

    const today = getLocalDateString(new Date(), siteTimeZone);
    const checkedInToday = user.lastCheckinDate === today;

    const userData = {
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
      updatedAt: user.updatedAt,
    };

    return c.json({
      success: true,
      code: 200,
      data: userData,
      user: userData,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch profile" }, 500);
  }
});

// Update Profile & Change Password (re-salts on change #97)
userRouter.put("/profile", requireAuth, async (c) => {
  try {
    const current = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { nickname, avatar, oldPassword, newPassword } = body;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, current.id),
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const updates: Partial<typeof schema.users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nickname !== undefined) {
      updates.nickname = String(nickname).trim().slice(0, 50);
    }
    if (avatar !== undefined) {
      updates.avatar = String(avatar).trim();
    }

    // Password change
    if (newPassword) {
      if (!oldPassword) {
        return c.json({ success: false, error: "Current password is required to set a new password" }, 400);
      }
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return c.json({ success: false, error: "New password must be at least 6 characters" }, 400);
      }

      const isOldMatch = await verifyPassword(oldPassword, user.salt, user.passwordHash);
      if (!isOldMatch) {
        return c.json({ success: false, error: "Current password is incorrect" }, 400);
      }

      // Re-salt on password update (#97) and increment sessionVersion for revocation
      const newSalt = generateSalt();
      const newPasswordHash = await hashPassword(newPassword, newSalt);
      updates.salt = newSalt;
      updates.passwordHash = newPasswordHash;
      updates.sessionVersion = (user.sessionVersion || 1) + 1;
    }

    const updated = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, user.id))
      .returning();

    const u = updated[0];

    let token: string | undefined;
    if (newPassword) {
      token = await signToken(
        { id: u.id, username: u.username, role: u.role, sessionVersion: u.sessionVersion },
        c.env.JWT_SECRET
      );
      let isLoopback = false;
      try {
        const url = new URL(c.req.url);
        isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      } catch {}
      const isProduction = c.env.ENVIRONMENT === "production";
      const secureFlag = isProduction || !isLoopback ? "; Secure" : "";
      c.header(
        "Set-Cookie",
        `shirine_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secureFlag}`
      );
    }

    return c.json({
      success: true,
      message: "Profile updated successfully",
      token,
      user: {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        role: u.role,
        points: u.points,
        checkinStreak: u.checkinStreak,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update profile" }, 500);
  }
});
