import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const momentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List moments
momentsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);

    const allMoments = await db.query.moments.findMany({
      where: !user || user.role !== "superadmin" ? eq(schema.moments.draft, 0) : undefined,
      orderBy: [desc(schema.moments.pinned), desc(schema.moments.createdAt)],
    });

    const formatted = allMoments.map((m) => ({
      id: m.id,
      content: m.content,
      location: m.location,
      mood: m.mood,
      images: JSON.parse(m.images || "[]"),
      tags: JSON.parse(m.tags || "[]"),
      pinned: m.pinned === 1,
      draft: m.draft === 1,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return c.json({ success: true, data: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch moments" }, 500);
  }
});

// Admin: Create moment
momentsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { content, location = "", mood = "", images = [], tags = [], pinned = false, draft = false } = body;

    if (!content) {
      return c.json({ success: false, error: "Content is required" }, 400);
    }

    const inserted = await db
      .insert(schema.moments)
      .values({
        content,
        location,
        mood,
        images: JSON.stringify(Array.isArray(images) ? images : []),
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        pinned: pinned ? 1 : 0,
        draft: draft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    return c.json({ success: true, moment: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create moment" }, 500);
  }
});

// Admin: Update moment
momentsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const updates: Partial<typeof schema.moments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.content !== undefined) updates.content = body.content;
    if (body.location !== undefined) updates.location = body.location;
    if (body.mood !== undefined) updates.mood = body.mood;
    if (body.images !== undefined) updates.images = JSON.stringify(Array.isArray(body.images) ? body.images : []);
    if (body.tags !== undefined) updates.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    if (body.pinned !== undefined) updates.pinned = body.pinned ? 1 : 0;
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;

    const updated = await db.update(schema.moments).set(updates).where(eq(schema.moments.id, id)).returning();
    return c.json({ success: true, moment: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update moment" }, 500);
  }
});

// Admin: Delete moment
momentsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.moments).where(eq(schema.moments.id, id));
    return c.json({ success: true, message: "Moment deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete moment" }, 500);
  }
});
