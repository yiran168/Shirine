import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";
import type { MomentDto, MomentImageDto } from "../types/dto";

export const momentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function normalizeMomentImages(raw: any): MomentImageDto[] {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (typeof item === "string") {
        return { src: item.trim(), alt: "" };
      }
      if (item && typeof item === "object" && typeof item.src === "string") {
        return { src: item.src.trim(), alt: String(item.alt || "") };
      }
      return null;
    })
    .filter((x): x is MomentImageDto => x !== null && x.src.length > 0);
}

// List moments
momentsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    const allMoments = await db.query.moments.findMany({
      where: !isAdmin ? eq(schema.moments.draft, 0) : undefined,
      orderBy: [desc(schema.moments.pinned), desc(schema.moments.createdAt)],
    });

    const formatted: MomentDto[] = allMoments.map((m) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(m.tags || "[]");
      } catch {
        parsedTags = [];
      }

      return {
        id: m.id,
        content: m.content,
        location: m.location || "",
        mood: m.mood || "",
        images: normalizeMomentImages(m.images),
        tags: parsedTags,
        pinned: m.pinned === 1,
        draft: m.draft === 1,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    return c.json({ success: true, data: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch moments" }, 500);
  }
});

// Admin: Create moment (accepts photos or images #25, #26, #51)
momentsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { content, location = "", mood = "", images, photos, tags = [], pinned = false, draft = false } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return c.json({ success: false, error: "Content is required" }, 400);
    }

    const rawImages = images || photos || [];
    const normalizedImages = normalizeMomentImages(rawImages);

    const inserted = await db
      .insert(schema.moments)
      .values({
        content: content.trim(),
        location: location?.trim() || "",
        mood: mood?.trim() || "",
        images: JSON.stringify(normalizedImages),
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        pinned: pinned ? 1 : 0,
        draft: draft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    return c.json({
      success: true,
      data: inserted[0],
      moment: inserted[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create moment" }, 500);
  }
});

// Admin: Update moment
momentsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid moment ID" }, 400);
    }

    const existing = await db.query.moments.findFirst({
      where: eq(schema.moments.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Moment not found" }, 404);
    }

    const body = await c.req.json();

    const updates: Partial<typeof schema.moments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.location !== undefined) updates.location = body.location.trim();
    if (body.mood !== undefined) updates.mood = body.mood.trim();
    if (body.images !== undefined || body.photos !== undefined) {
      const raw = body.images || body.photos || [];
      updates.images = JSON.stringify(normalizeMomentImages(raw));
    }
    if (body.tags !== undefined) {
      updates.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    }
    if (body.pinned !== undefined) updates.pinned = body.pinned ? 1 : 0;
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;

    const updated = await db
      .update(schema.moments)
      .set(updates)
      .where(eq(schema.moments.id, id))
      .returning();

    return c.json({
      success: true,
      data: updated[0],
      moment: updated[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update moment" }, 500);
  }
});

// Admin: Delete moment
momentsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid moment ID" }, 400);
    }

    const existing = await db.query.moments.findFirst({
      where: eq(schema.moments.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Moment not found" }, 404);
    }

    await db.delete(schema.moments).where(eq(schema.moments.id, id));
    return c.json({ success: true, message: "Moment deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete moment" }, 500);
  }
});
