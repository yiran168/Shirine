import { Hono } from "hono";
import { eq, desc, sql, like, or } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";
import { configRouter } from "./config";
import type { AdminStatsDto, UserDto } from "../types/dto";

export const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All admin routes require admin or superadmin role
adminRouter.use("*", requireAdmin);

// Mount config router for admin/config endpoints (V10-P0-04)
adminRouter.route("/config", configRouter);

// Dashboard Overview Statistics
adminRouter.get("/stats", async (c) => {
  try {
    const db = getDb(c.env.DB);

    const postCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.posts);
    const userCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const albumCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.albums);
    const momentCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.moments);
    const pointsSumRes = await db.select({ total: sql<number>`sum(points)` }).from(schema.users);

    // Use Asia/Shanghai or local date (#103)
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });
    const today = formatter.format(new Date());

    const checkinTodayRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.checkinRecords)
      .where(eq(schema.checkinRecords.checkinDate, today));

    const postsCount = postCountRes[0]?.count ?? 0;
    const usersCount = userCountRes[0]?.count ?? 0;
    const albumsCount = albumCountRes[0]?.count ?? 0;
    const momentsCount = momentCountRes[0]?.count ?? 0;

    const stats: AdminStatsDto = {
      posts: postsCount,
      users: usersCount,
      albums: albumsCount,
      moments: momentsCount,
      totalPosts: postsCount,
      totalUsers: usersCount,
      totalAlbums: albumsCount,
      totalMoments: momentsCount,
      totalPoints: pointsSumRes[0]?.total ?? 0,
      checkinToday: checkinTodayRes[0]?.count ?? 0,
    };

    return c.json({
      success: true,
      data: stats,
      stats, // Backward compatibility alias (#21)
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch stats" }, 500);
  }
});

// List Users
adminRouter.get("/users", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const { page = "1", pageSize = "20", search = "" } = c.req.query();

    const p = Math.max(1, parseInt(page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (p - 1) * limit;

    const whereClause = search
      ? or(
          like(schema.users.username, `%${search}%`),
          like(schema.users.nickname, `%${search}%`)
        )
      : undefined;

    const usersList = await db.query.users.findMany({
      where: whereClause,
      orderBy: [desc(schema.users.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        role: true,
        points: true,
        status: true,
        lastCheckinDate: true,
        checkinStreak: true,
        createdAt: true,
      },
    });

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(whereClause);
    const total = countRes[0]?.count ?? 0;

    return c.json({
      success: true,
      data: usersList,
      pagination: {
        page: p,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to list users" }, 500);
  }
});

// Adjust User Points (Atomic update #105, supports PUT and POST)
const handleAdjustUserPoints = async (c: any) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid user ID" }, 400);
    }

    const body = await c.req.json();
    const { delta, exactPoints, amount, description } = body;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const currentUser = c.get("user")!;
    if (user.role === "superadmin" && currentUser.role !== "superadmin") {
      return c.json({ success: false, error: "Only superadmin can adjust superadmin points" }, 403);
    }

    let targetPoints = user.points;
    let deltaAmount = 0;
    if (exactPoints !== undefined) {
      targetPoints = Math.max(0, parseInt(exactPoints) || 0);
      deltaAmount = targetPoints - user.points;
    } else if (amount !== undefined) {
      const d = parseInt(amount) || 0;
      targetPoints = Math.max(0, user.points + d);
      deltaAmount = targetPoints - user.points;
    } else if (delta !== undefined) {
      const d = parseInt(delta) || 0;
      targetPoints = Math.max(0, user.points + d);
      deltaAmount = targetPoints - user.points;
    }

    if (deltaAmount !== 0) {
      const idempotencyKey = `admin_adjust_${currentUser.id}_${user.id}_${Date.now()}`;
      const stmtUser = c.env.DB.prepare(
        "UPDATE users SET points = ?, updated_at = unixepoch() WHERE id = ?"
      ).bind(targetPoints, id);

      const descText =
        description ||
        `Admin adjust points by ${currentUser.username} (${deltaAmount > 0 ? "+" : ""}${deltaAmount})`;

      const stmtLedger = c.env.DB.prepare(
        "INSERT INTO point_transactions (user_id, type, amount, balance_after, target_id, idempotency_key, description, created_at) VALUES (?, 'admin_adjust', ?, ?, ?, ?, ?, unixepoch())"
      ).bind(
        user.id,
        deltaAmount,
        targetPoints,
        currentUser.id,
        idempotencyKey,
        descText
      );

      await c.env.DB.batch([stmtUser, stmtLedger]);
    }

    const updatedUser = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
      columns: { points: true },
    });

    return c.json({
      success: true,
      message: `Points updated to ${updatedUser?.points ?? 0}`,
      currentPoints: updatedUser?.points ?? 0,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update points" }, 500);
  }
};

adminRouter.put("/users/:id/points", handleAdjustUserPoints);
adminRouter.post("/users/:id/points", handleAdjustUserPoints);

// Change User Role (supports superadmin, admin, user #67, #68)
adminRouter.put("/users/:id/role", async (c) => {
  try {
    const currentUser = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid user ID" }, 400);
    }

    const body = await c.req.json();
    const { role } = body;

    if (id === currentUser.id) {
      return c.json({ success: false, error: "Cannot change your own role" }, 400);
    }

    // Only superadmin can promote/demote
    if (currentUser.role !== "superadmin") {
      return c.json({ success: false, error: "Only superadmin can change user roles" }, 403);
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (!targetUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    if (role !== "superadmin" && role !== "admin" && role !== "user") {
      return c.json({ success: false, error: "Invalid role. Must be 'superadmin', 'admin', or 'user'" }, 400);
    }

    await db
      .update(schema.users)
      .set({
        role,
        sessionVersion: sql`${schema.users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id));

    return c.json({ success: true, message: `User role changed to ${role}` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to change role" }, 500);
  }
});

// Change User Status (Ban / Unban)
adminRouter.put("/users/:id/status", async (c) => {
  try {
    const currentUser = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid user ID" }, 400);
    }

    const body = await c.req.json();
    const { status } = body;

    if (id === currentUser.id) {
      return c.json({ success: false, error: "Cannot ban your own account" }, 400);
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (!targetUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Role hierarchy check (#P0-19, P1-58)
    if (targetUser.role === "superadmin") {
      return c.json({ success: false, error: "Cannot modify superadmin account status" }, 403);
    }
    if (targetUser.role === "admin" && currentUser.role !== "superadmin") {
      return c.json({ success: false, error: "Only superadmin can modify admin account status" }, 403);
    }

    if (status !== "active" && status !== "banned") {
      return c.json({ success: false, error: "Invalid status. Must be 'active' or 'banned'" }, 400);
    }

    await db
      .update(schema.users)
      .set({
        status,
        sessionVersion: sql`${schema.users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id));

    return c.json({ success: true, message: `User account status changed to ${status}` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to change status" }, 500);
  }
});

// Seed or Reset Preset Demo Data
adminRouter.post("/seed", async (c) => {
  try {
    const currentUser = c.get("user")!;
    if (currentUser.role !== "superadmin") {
      return c.json({ success: false, error: "Only superadmin can seed or reset demo data" }, 403);
    }

    const db = getDb(c.env.DB);
    const body = await c.req.json().catch(() => ({}));
    const overwrite = Boolean(body.overwrite);
    const { seedPresetData } = await import("../db/seed");
    const summary = await seedPresetData(db, overwrite);
    return c.json({
      success: true,
      message: "Preset demo data seeded successfully into D1 database",
      data: summary,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to seed preset data" }, 500);
  }
});

