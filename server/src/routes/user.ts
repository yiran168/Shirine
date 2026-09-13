import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth } from "../core/middleware";
import { hashPassword } from "../core/auth";

export const userRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Daily Check-in
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

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Check if already checked in today
    const existingCheckin = await db.query.checkinRecords.findFirst({
      where: (record, { and, eq }) => and(eq(record.userId, user.id), eq(record.checkinDate, today)),
    });

    if (existingCheckin || user.lastCheckinDate === today) {
      return c.json({ success: false, error: "You have already checked in today! Come back tomorrow." }, 400);
    }

    // Read checkin rules from system_configs
    const ruleRow = await db.query.systemConfigs.findFirst({
      where: eq(schema.systemConfigs.key, "checkin_rule"),
    });

    let checkinRule = {
      mode: "fixed", // "fixed" | "random"
      fixedPoints: 10,
      randomMin: 5,
      randomMax: 20,
    };

    if (ruleRow) {
      try {
        checkinRule = { ...checkinRule, ...JSON.parse(ruleRow.value) };
      } catch {}
    }

    let awarded = checkinRule.fixedPoints;
    if (checkinRule.mode === "random") {
      const min = Math.max(1, Number(checkinRule.randomMin) || 1);
      const max = Math.max(min, Number(checkinRule.randomMax) || min);
      awarded = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Calculate streak
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const newStreak = user.lastCheckinDate === yesterday ? user.checkinStreak + 1 : 1;
    const newPoints = user.points + awarded;

    // Record checkin & update user
    await db.insert(schema.checkinRecords).values({
      userId: user.id,
      checkinDate: today,
      pointsAwarded: awarded,
    });

    await db
      .update(schema.users)
      .set({
        points: newPoints,
        lastCheckinDate: today,
        checkinStreak: newStreak,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    return c.json({
      success: true,
      pointsAwarded: awarded,
      currentPoints: newPoints,
      checkinStreak: newStreak,
      message: `Checked in successfully! You earned +${awarded} points.`,
    });
  } catch (err: any) {
    console.error("Check-in error:", err);
    return c.json({ success: false, error: err.message || "Check-in failed" }, 500);
  }
});

// Update Profile
userRouter.put("/profile", requireAuth, async (c) => {
  try {
    const current = c.get("user")!;
    const body = await c.req.json();
    const { nickname, avatar, newPassword, oldPassword } = body;
    const db = getDb(c.env.DB);

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, current.id),
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const updates: Partial<typeof schema.users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nickname && typeof nickname === "string") {
      updates.nickname = nickname.trim();
    }
    if (avatar && typeof avatar === "string") {
      updates.avatar = avatar.trim();
    }

    if (newPassword) {
      if (!oldPassword) {
        return c.json({ success: false, error: "Old password is required to set new password" }, 400);
      }
      const oldHash = await hashPassword(oldPassword, user.salt);
      if (oldHash !== user.passwordHash) {
        return c.json({ success: false, error: "Incorrect old password" }, 400);
      }
      if (newPassword.length < 6) {
        return c.json({ success: false, error: "New password must be at least 6 characters" }, 400);
      }
      updates.passwordHash = await hashPassword(newPassword, user.salt);
    }

    await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));

    return c.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        username: user.username,
        nickname: updates.nickname || user.nickname,
        avatar: updates.avatar || user.avatar,
        role: user.role,
        points: user.points,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update profile" }, 500);
  }
});

// Check-in history and unlocks
userRouter.get("/history", requireAuth, async (c) => {
  const current = c.get("user")!;
  const db = getDb(c.env.DB);

  const checkins = await db.query.checkinRecords.findMany({
    where: eq(schema.checkinRecords.userId, current.id),
    orderBy: [desc(schema.checkinRecords.createdAt)],
    limit: 30,
  });

  const postUnlocks = await db.query.postUnlocks.findMany({
    where: eq(schema.postUnlocks.userId, current.id),
    orderBy: [desc(schema.postUnlocks.createdAt)],
  });

  const albumUnlocks = await db.query.albumUnlocks.findMany({
    where: eq(schema.albumUnlocks.userId, current.id),
    orderBy: [desc(schema.albumUnlocks.createdAt)],
  });

  return c.json({
    success: true,
    checkins,
    postUnlocks,
    albumUnlocks,
  });
});
