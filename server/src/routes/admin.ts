import { Hono } from "hono";
import { eq, desc, sql, like, or } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All admin routes require superadmin role
adminRouter.use("*", requireAdmin);

// Dashboard Overview Statistics
adminRouter.get("/stats", async (c) => {
  try {
    const db = getDb(c.env.DB);

    const postCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.posts);
    const userCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const albumCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.albums);
    const momentCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.moments);
    const pointsSumRes = await db.select({ total: sql<number>`sum(points)` }).from(schema.users);

    const today = new Date().toISOString().slice(0, 10);
    const checkinTodayRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.checkinRecords)
      .where(eq(schema.checkinRecords.checkinDate, today));

    return c.json({
      success: true,
      stats: {
        posts: postCountRes[0]?.count ?? 0,
        users: userCountRes[0]?.count ?? 0,
        albums: albumCountRes[0]?.count ?? 0,
        moments: momentCountRes[0]?.count ?? 0,
        totalPoints: pointsSumRes[0]?.total ?? 0,
        checkinToday: checkinTodayRes[0]?.count ?? 0,
      },
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

// Adjust User Points
adminRouter.put("/users/:id/points", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const { delta, exactPoints } = body;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    let newPoints = user.points;
    if (exactPoints !== undefined) {
      newPoints = Math.max(0, parseInt(exactPoints) || 0);
    } else if (delta !== undefined) {
      newPoints = Math.max(0, user.points + (parseInt(delta) || 0));
    }

    await db
      .update(schema.users)
      .set({ points: newPoints, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    return c.json({
      success: true,
      message: `Points updated to ${newPoints}`,
      currentPoints: newPoints,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update points" }, 500);
  }
});

// Change User Role
adminRouter.put("/users/:id/role", async (c) => {
  try {
    const currentUser = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const { role } = body;

    if (id === currentUser.id) {
      return c.json({ success: false, error: "Cannot change your own role" }, 400);
    }

    if (role !== "superadmin" && role !== "user") {
      return c.json({ success: false, error: "Invalid role" }, 400);
    }

    await db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
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
    const body = await c.req.json();
    const { status } = body;

    if (id === currentUser.id) {
      return c.json({ success: false, error: "Cannot ban your own account" }, 400);
    }

    if (status !== "active" && status !== "banned") {
      return c.json({ success: false, error: "Invalid status" }, 400);
    }

    await db
      .update(schema.users)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    return c.json({ success: true, message: `User account status changed to ${status}` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to change status" }, 500);
  }
});
