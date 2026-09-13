import { Hono } from "hono";
import { eq, desc, and, sql, or } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth, requireAdmin } from "../core/middleware";

export const postsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List posts (with permission state)
postsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const { page = "1", pageSize = "10", category, tag, search } = c.req.query();

    const p = Math.max(1, parseInt(page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(pageSize) || 10));
    const offset = (p - 1) * limit;

    // Filter conditions
    const conditions = [];
    // Only admins can see drafts
    if (!user || user.role !== "superadmin") {
      conditions.push(eq(schema.posts.draft, 0));
    }
    if (category) {
      conditions.push(eq(schema.posts.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allPosts = await db.query.posts.findMany({
      where: whereClause,
      orderBy: [desc(schema.posts.pinned), desc(schema.posts.createdAt)],
      limit,
      offset,
    });

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(whereClause);
    const total = countRes[0]?.count ?? 0;

    // Get unlocked post IDs for current user if logged in
    let unlockedPostIds = new Set<number>();
    if (user) {
      const userUnlocks = await db.query.postUnlocks.findMany({
        where: eq(schema.postUnlocks.userId, user.id),
      });
      unlockedPostIds = new Set(userUnlocks.map((u) => u.postId));
    }

    // Map posts with permission flags
    const postsWithPerms = allPosts.map((post) => {
      let isUnlocked = true;
      if (post.permissionType === "login_required") {
        isUnlocked = !!user;
      } else if (post.permissionType === "points_required") {
        isUnlocked = !!(
          user &&
          (user.role === "superadmin" || user.id === post.uid || unlockedPostIds.has(post.id))
        );
      }

      return {
        id: post.id,
        slug: post.slug,
        alias: post.alias,
        permalink: post.permalink,
        title: post.title,
        description: post.description,
        image: post.image,
        category: post.category,
        tags: JSON.parse(post.tags || "[]"),
        pinned: post.pinned === 1,
        draft: post.draft === 1,
        permissionType: post.permissionType,
        requiredPoints: post.requiredPoints,
        isUnlocked,
        commentEnabled: post.commentEnabled === 1,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      };
    });

    return c.json({
      success: true,
      data: postsWithPerms,
      pagination: {
        page: p,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("List posts error:", err);
    return c.json({ success: false, error: err.message || "Failed to fetch posts" }, 500);
  }
});

// Post detail
postsRouter.get("/:slugOrId", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const slugOrId = c.req.param("slugOrId");

    const isNumericId = /^\d+$/.test(slugOrId);
    let post = null;

    if (isNumericId) {
      post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, parseInt(slugOrId)),
      });
    }

    if (!post) {
      post = await db.query.posts.findFirst({
        where: or(eq(schema.posts.slug, slugOrId), eq(schema.posts.alias, slugOrId)),
      });
    }

    if (!post) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    // Check draft
    if (post.draft === 1 && (!user || user.role !== "superadmin")) {
      return c.json({ success: false, error: "Post not published" }, 404);
    }

    // Check permissions
    let isUnlocked = true;
    let lockReason = "";

    if (post.permissionType === "login_required") {
      if (!user) {
        isUnlocked = false;
        lockReason = "login_required";
      }
    } else if (post.permissionType === "points_required") {
      if (!user) {
        isUnlocked = false;
        lockReason = "login_required";
      } else if (user.role !== "superadmin" && user.id !== post.uid) {
        const unlock = await db.query.postUnlocks.findFirst({
          where: and(
            eq(schema.postUnlocks.userId, user.id),
            eq(schema.postUnlocks.postId, post.id)
          ),
        });
        if (!unlock) {
          isUnlocked = false;
          lockReason = "points_required";
        }
      }
    }

    // Get author info
    const author = await db.query.users.findFirst({
      where: eq(schema.users.id, post.uid),
      columns: { id: true, username: true, nickname: true, avatar: true },
    });

    // Get current user points if logged in
    let userPoints = 0;
    if (user) {
      const u = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
        columns: { points: true },
      });
      userPoints = u?.points ?? 0;
    }

    return c.json({
      success: true,
      post: {
        id: post.id,
        slug: post.slug,
        alias: post.alias,
        permalink: post.permalink,
        title: post.title,
        description: post.description,
        image: post.image,
        category: post.category,
        tags: JSON.parse(post.tags || "[]"),
        pinned: post.pinned === 1,
        draft: post.draft === 1,
        commentEnabled: post.commentEnabled === 1,
        permissionType: post.permissionType,
        requiredPoints: post.requiredPoints,
        content: isUnlocked ? post.content : null,
        isUnlocked,
        lockReason,
        userPoints,
        author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch post" }, 500);
  }
});

// Unlock Post with points
postsRouter.post("/:id/unlock", requireAuth, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));

    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, id),
    });

    if (!post) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    if (post.permissionType !== "points_required") {
      return c.json({ success: true, message: "This post does not require points to unlock" });
    }

    // Check if already unlocked
    const existingUnlock = await db.query.postUnlocks.findFirst({
      where: and(
        eq(schema.postUnlocks.userId, user.id),
        eq(schema.postUnlocks.postId, post.id)
      ),
    });
    if (existingUnlock || user.role === "superadmin" || user.id === post.uid) {
      return c.json({ success: true, message: "Post already unlocked" });
    }

    // Check user points balance
    const currentUser = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    });
    if (!currentUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    if (currentUser.points < post.requiredPoints) {
      return c.json(
        {
          success: false,
          error: `Insufficient points. You need ${post.requiredPoints} points, but have ${currentUser.points}. Check in daily to earn more!`,
          requiredPoints: post.requiredPoints,
          userPoints: currentUser.points,
        },
        400
      );
    }

    // Atomic transaction: deduct points & record unlock
    const newPoints = currentUser.points - post.requiredPoints;
    await db.insert(schema.postUnlocks).values({
      userId: user.id,
      postId: post.id,
      pointsSpent: post.requiredPoints,
    });

    await db
      .update(schema.users)
      .set({ points: newPoints, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return c.json({
      success: true,
      message: `Successfully unlocked post! Spent ${post.requiredPoints} points.`,
      remainingPoints: newPoints,
      content: post.content,
    });
  } catch (err: any) {
    console.error("Unlock error:", err);
    return c.json({ success: false, error: err.message || "Failed to unlock post" }, 500);
  }
});

// Admin: Create Post
postsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();

    const {
      title,
      content,
      slug,
      description = "",
      image = "",
      category = "",
      tags = [],
      pinned = false,
      draft = false,
      commentEnabled = true,
      permissionType = "public",
      requiredPoints = 0,
    } = body;

    if (!title || !content) {
      return c.json({ success: false, error: "Title and content are required" }, 400);
    }

    const finalSlug =
      slug?.trim() ||
      title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-|-$/g, "") +
        "-" +
        Date.now();

    const inserted = await db
      .insert(schema.posts)
      .values({
        slug: finalSlug,
        title: title.trim(),
        content,
        description,
        image,
        category,
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        pinned: pinned ? 1 : 0,
        draft: draft ? 1 : 0,
        commentEnabled: commentEnabled ? 1 : 0,
        permissionType,
        requiredPoints: Math.max(0, parseInt(requiredPoints) || 0),
        uid: user.id,
      })
      .returning();

    return c.json({ success: true, post: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create post" }, 500);
  }
});

// Admin: Update Post
postsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const updates: Partial<typeof schema.posts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.slug !== undefined) updates.slug = body.slug.trim();
    if (body.content !== undefined) updates.content = body.content;
    if (body.description !== undefined) updates.description = body.description;
    if (body.image !== undefined) updates.image = body.image;
    if (body.category !== undefined) updates.category = body.category;
    if (body.tags !== undefined)
      updates.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    if (body.pinned !== undefined) updates.pinned = body.pinned ? 1 : 0;
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;
    if (body.commentEnabled !== undefined) updates.commentEnabled = body.commentEnabled ? 1 : 0;
    if (body.permissionType !== undefined) updates.permissionType = body.permissionType;
    if (body.requiredPoints !== undefined)
      updates.requiredPoints = Math.max(0, parseInt(body.requiredPoints) || 0);

    const updated = await db
      .update(schema.posts)
      .set(updates)
      .where(eq(schema.posts.id, id))
      .returning();

    return c.json({ success: true, post: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update post" }, 500);
  }
});

// Admin: Delete Post
postsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));

    await db.delete(schema.posts).where(eq(schema.posts.id, id));
    return c.json({ success: true, message: "Post deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete post" }, 500);
  }
});
