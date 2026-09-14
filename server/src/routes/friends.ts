import { Hono } from "hono";
import { eq, desc, asc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";
import type { FriendDto } from "../types/dto";

export const friendsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function isValidHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// List friends (public returns accepted only, admin returns all)
friendsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    const allFriends = await db.query.friends.findMany({
      where: !isAdmin ? eq(schema.friends.accepted, 1) : undefined,
      orderBy: [asc(schema.friends.sortOrder), desc(schema.friends.createdAt)],
    });

    const formatted: FriendDto[] = allFriends.map((f) => ({
      id: f.id,
      name: f.name,
      desc: f.desc || "",
      avatar: f.avatar,
      url: f.url,
      accepted: f.accepted,
      status: f.accepted === 1 ? "approved" : "pending",
      sortOrder: f.sortOrder,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return c.json({ success: true, data: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch friends" }, 500);
  }
});

// Public: Apply for friend link (uid is nullable #27, validates URL protocol #62)
friendsRouter.post("/apply", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { name, desc = "", avatar, url } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return c.json({ success: false, error: "Friend name is required" }, 400);
    }
    if (!url || typeof url !== "string" || !isValidHttpUrl(url.trim())) {
      return c.json({ success: false, error: "A valid http:// or https:// website URL is required" }, 400);
    }
    if (!avatar || typeof avatar !== "string" || !isValidHttpUrl(avatar.trim())) {
      return c.json({ success: false, error: "A valid http:// or https:// avatar URL is required" }, 400);
    }

    // Default accepted = 0 (pending review)
    const inserted = await db
      .insert(schema.friends)
      .values({
        name: name.trim(),
        desc: desc?.trim() || "",
        avatar: avatar.trim(),
        url: url.trim(),
        accepted: 0,
        sortOrder: 0,
        uid: null, // Nullable applicant UID (#27)
      })
      .returning();

    return c.json({
      success: true,
      message: "Friend link application submitted. Waiting for admin approval.",
      data: inserted[0],
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

    if (!name || typeof name !== "string" || !name.trim()) {
      return c.json({ success: false, error: "Friend name is required" }, 400);
    }
    if (!url || typeof url !== "string" || !isValidHttpUrl(url.trim())) {
      return c.json({ success: false, error: "A valid http:// or https:// website URL is required" }, 400);
    }
    if (!avatar || typeof avatar !== "string" || !isValidHttpUrl(avatar.trim())) {
      return c.json({ success: false, error: "A valid http:// or https:// avatar URL is required" }, 400);
    }

    const isAccepted = accepted === 1 || accepted === true || body.status === "approved" ? 1 : 0;

    const inserted = await db
      .insert(schema.friends)
      .values({
        name: name.trim(),
        desc: desc?.trim() || "",
        avatar: avatar.trim(),
        url: url.trim(),
        accepted: isAccepted,
        sortOrder: parseInt(sortOrder) || 0,
        uid: user.id,
      })
      .returning();

    return c.json({
      success: true,
      data: inserted[0],
      friend: inserted[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to add friend" }, 500);
  }
});

// Admin: Update friend (supports both accepted and status: "approved" #28, #29)
friendsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid friend ID" }, 400);
    }

    const existing = await db.query.friends.findFirst({
      where: eq(schema.friends.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Friend link not found" }, 404);
    }

    const body = await c.req.json();

    const updates: Partial<typeof schema.friends.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.desc !== undefined) updates.desc = body.desc.trim();
    if (body.avatar !== undefined && isValidHttpUrl(body.avatar.trim())) {
      updates.avatar = body.avatar.trim();
    }
    if (body.url !== undefined && isValidHttpUrl(body.url.trim())) {
      updates.url = body.url.trim();
    }

    // Accept both accepted (0|1) and status ("approved"|"pending") (#28, #29)
    if (body.accepted !== undefined) {
      updates.accepted = body.accepted ? 1 : 0;
    } else if (body.status !== undefined) {
      updates.accepted = body.status === "approved" ? 1 : 0;
    }

    if (body.sortOrder !== undefined) {
      updates.sortOrder = parseInt(body.sortOrder) || 0;
    }

    const updated = await db
      .update(schema.friends)
      .set(updates)
      .where(eq(schema.friends.id, id))
      .returning();

    return c.json({
      success: true,
      data: updated[0],
      friend: updated[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update friend" }, 500);
  }
});

// Admin: Delete friend
friendsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid friend ID" }, 400);
    }

    const existing = await db.query.friends.findFirst({
      where: eq(schema.friends.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Friend link not found" }, 404);
    }

    await db.delete(schema.friends).where(eq(schema.friends.id, id));
    return c.json({ success: true, message: "Friend link deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete friend link" }, 500);
  }
});
