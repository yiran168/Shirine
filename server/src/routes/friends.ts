import { Hono } from "hono";
import { eq, desc, asc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const friendsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List friends
friendsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);

    const allFriends = await db.query.friends.findMany({
      where: !user || user.role !== "superadmin" ? eq(schema.friends.accepted, 1) : undefined,
      orderBy: [asc(schema.friends.sortOrder), desc(schema.friends.createdAt)],
    });

    return c.json({ success: true, data: allFriends });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch friends" }, 500);
  }
});

// Public: Apply for friend link
friendsRouter.post("/apply", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { name, desc = "", avatar, url } = body;

    if (!name || !avatar || !url) {
      return c.json({ success: false, error: "Name, avatar, and url are required" }, 400);
    }

    // Default 0: pending admin review
    const inserted = await db
      .insert(schema.friends)
      .values({
        name: name.trim(),
        desc: desc.trim(),
        avatar: avatar.trim(),
        url: url.trim(),
        accepted: 0,
        sortOrder: 0,
        uid: 1, // default admin or system uid
      })
      .returning();

    return c.json({
      success: true,
      message: "Friend link application submitted. Waiting for admin approval.",
      friend: inserted[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to apply for friend link" }, 500);
  }
});

// Admin: Add friend
friendsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { name, desc = "", avatar, url, accepted = 1, sortOrder = 0 } = body;

    if (!name || !avatar || !url) {
      return c.json({ success: false, error: "Name, avatar, and url are required" }, 400);
    }

    const inserted = await db
      .insert(schema.friends)
      .values({
        name: name.trim(),
        desc: desc.trim(),
        avatar: avatar.trim(),
        url: url.trim(),
        accepted: accepted ? 1 : 0,
        sortOrder: parseInt(sortOrder) || 0,
        uid: user.id,
      })
      .returning();

    return c.json({ success: true, friend: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to add friend" }, 500);
  }
});

// Admin: Update friend
friendsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const updates: Partial<typeof schema.friends.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.desc !== undefined) updates.desc = body.desc.trim();
    if (body.avatar !== undefined) updates.avatar = body.avatar.trim();
    if (body.url !== undefined) updates.url = body.url.trim();
    if (body.accepted !== undefined) updates.accepted = body.accepted ? 1 : 0;
    if (body.sortOrder !== undefined) updates.sortOrder = parseInt(body.sortOrder) || 0;

    const updated = await db.update(schema.friends).set(updates).where(eq(schema.friends.id, id)).returning();
    return c.json({ success: true, friend: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update friend" }, 500);
  }
});

// Admin: Delete friend
friendsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.friends).where(eq(schema.friends.id, id));
    return c.json({ success: true, message: "Friend link deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete friend link" }, 500);
  }
});
