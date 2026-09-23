import { Hono } from "hono";
import { eq, desc, and, sql, or, like, lt, gt, asc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth, requireAdmin } from "../core/middleware";
import { signPostGrant, verifyPostGrant } from "../core/auth";
import type { PostListDto, PostDetailDto } from "../types/dto";

export const postsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List posts (with permission state)
postsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const { page = "1", pageSize = "10", category, tag, search } = c.req.query();

    const p = Math.max(1, parseInt(page) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(pageSize) || 10));
    const offset = (p - 1) * limit;

    // Filter conditions
    const conditions = [];
    // Only admins can see drafts
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");
    if (!isAdmin) {
      conditions.push(eq(schema.posts.draft, 0));
    }
    if (category) {
      conditions.push(eq(schema.posts.category, category));
    }
    if (tag) {
      // Tags stored as JSON array string, e.g. ["Astro", "Cloudflare"]
      conditions.push(like(schema.posts.tags, `%"${tag}"%`));
    }
    if (search && search.trim()) {
      const q = search.trim();
      conditions.push(
        or(
          like(schema.posts.title, `%${q}%`),
          like(schema.posts.description, `%${q}%`)
        )
      );
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
    const postsWithPerms: PostListDto[] = allPosts.map((post) => {
      const isPurchased = Boolean(
        user &&
          (user.role === "superadmin" ||
            user.role === "admin" ||
            user.id === post.uid ||
            unlockedPostIds.has(post.id))
      );
      let isUnlocked = true;
      let lockReason: PostListDto["lockReason"] = "";
      const hasPassword = post.encrypted === 1 || Boolean(post.password && post.password.length > 0);

      if (post.permissionType === "login_required") {
        isUnlocked = !!user;
        if (!isUnlocked) lockReason = "login_required";
      } else if (post.permissionType === "points_required") {
        isUnlocked = isPurchased;
        if (!isUnlocked) lockReason = "points_required";
      }

      if (hasPassword && !user?.role?.includes("admin")) {
        isUnlocked = false;
        lockReason = "password_required";
      }

      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(post.tags || "[]");
      } catch {
        parsedTags = [];
      }

      const words = post.content ? post.content.replace(/\s+/g, "").length : 0;

      return {
        id: post.id,
        slug: post.slug,
        alias: post.alias,
        permalink: post.permalink,
        title: post.title,
        description: post.hideHomeContent === 1 && hasPassword ? "" : post.description,
        image: post.image,
        category: post.category,
        tags: parsedTags,
        pinned: post.pinned === 1,
        draft: post.draft === 1,
        permissionType: post.permissionType as any,
        requiredPoints: post.requiredPoints,
        isUnlocked,
        requiresPassword: hasPassword,
        hideHomeContent: post.hideHomeContent === 1,
        isPurchased,
        isAuthenticated: Boolean(user),
        lockReason,
        words,
        content: isUnlocked ? post.content : "",
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

interface ResolvedPostAccess {
  draftPassed: boolean;
  passwordPassed: boolean;
  authPassed: boolean;
  purchasePassed: boolean;
  allGatesSatisfied: boolean;
  lockReason: "" | "password_required" | "login_required" | "points_required";
}

async function resolvePostAccess(
  post: typeof schema.posts.$inferSelect,
  user: { id: number; role: string } | undefined,
  grant: string | undefined,
  db: ReturnType<typeof getDb>,
  jwtSecret: string
): Promise<ResolvedPostAccess> {
  const isAdmin = user && (user.role === "superadmin" || user.role === "admin");
  const isAuthor = user && post.uid && user.id === post.uid;
  const isPrivileged = Boolean(isAdmin || isAuthor);

  // 1. Draft Gate
  const draftPassed = post.draft === 0 || Boolean(isAdmin);

  // 2. Password Gate
  const hasPassword = post.encrypted === 1 || Boolean(post.password && post.password.length > 0);
  let passwordPassed = true;
  if (hasPassword && !isPrivileged) {
    if (grant) {
      passwordPassed = await verifyPostGrant(
        grant,
        post.id,
        post.passwordVersion ?? 1,
        user ? user.id : null,
        jwtSecret
      );
    } else {
      passwordPassed = false;
    }
  }

  // 3. Auth Gate
  let authPassed = true;
  if (post.permissionType === "login_required" && !isPrivileged) {
    authPassed = Boolean(user);
  }

  // 4. Purchase Gate
  let purchasePassed = true;
  if (post.permissionType === "points_required" && !isPrivileged) {
    if (!user) {
      purchasePassed = false;
    } else {
      const unlock = await db.query.postUnlocks.findFirst({
        where: and(
          eq(schema.postUnlocks.userId, user.id),
          eq(schema.postUnlocks.postId, post.id)
        ),
      });
      purchasePassed = Boolean(unlock);
    }
  }

  let lockReason: "" | "password_required" | "login_required" | "points_required" = "";
  if (!passwordPassed) {
    lockReason = "password_required";
  } else if (!purchasePassed) {
    lockReason = "points_required";
  } else if (!authPassed) {
    lockReason = "login_required";
  }

  const allGatesSatisfied = Boolean(draftPassed && passwordPassed && authPassed && purchasePassed);

  return {
    draftPassed,
    passwordPassed,
    authPassed,
    purchasePassed,
    allGatesSatisfied,
    lockReason,
  };
}

function extractPostGrant(c: any, postId: number): string | undefined {
  const headerGrant = c.req.header("X-Post-Grant");
  if (headerGrant) return headerGrant;

  const cookieHeader = c.req.header("Cookie") || "";
  // 1. Consolidated cookie map: shirine_post_grants={postId: grant} (V10-P0-10)
  const matchMap = cookieHeader.match(/shirine_post_grants=([^;]+)/);
  if (matchMap) {
    try {
      const parsed = JSON.parse(decodeURIComponent(matchMap[1]));
      if (parsed && typeof parsed === "object" && parsed[postId.toString()]) {
        return parsed[postId.toString()];
      }
    } catch {}
  }

  // 2. Legacy fallback: shirine_post_grant_<id>=<grant>
  const matchSingle = cookieHeader.match(new RegExp(`shirine_post_grant_${postId}=([^;]+)`));
  if (matchSingle) return matchSingle[1];

  return undefined;
}

// O(1) single-post query architecture helper (by slug, alias, permalink, or numeric id)
async function getPostDetailResponse(c: any, slugOrId: string) {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);

    const clean = decodeURIComponent(slugOrId).trim().replace(/^\/+|\/+$/g, "").replace(/\.(md|mdx|html)$/i, "");
    const cleanWithSlash = `/${clean}`;

    let post = null;

    // Check if numeric ID
    const isNumeric = /^\d+$/.test(clean);
    if (isNumeric) {
      const numericId = parseInt(clean, 10);
      post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, numericId),
      });
    }

    if (!post) {
      post = await db.query.posts.findFirst({
        where: or(
          eq(schema.posts.slug, clean),
          eq(schema.posts.slug, slugOrId),
          eq(schema.posts.alias, clean),
          eq(schema.posts.alias, slugOrId),
          eq(schema.posts.permalink, clean),
          eq(schema.posts.permalink, cleanWithSlash),
          eq(schema.posts.permalink, slugOrId)
        ),
      });
    }

    if (!post) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const grant = extractPostGrant(c, post.id);

    const access = await resolvePostAccess(
      post,
      user,
      grant,
      db,
      c.env.JWT_SECRET
    );

    if (!access.draftPassed) {
      return c.json({ success: false, error: "Post not published" }, 404);
    }

    const isUnlocked = access.allGatesSatisfied;
    const lockReason = access.lockReason;
    const isAdmin = Boolean(user && (user.role === "superadmin" || user.role === "admin"));

    // Previous and Next navigation (O(1) detail navigation)
    const prevPost = await db.query.posts.findFirst({
      where: and(
        isAdmin ? undefined : eq(schema.posts.draft, 0),
        lt(schema.posts.createdAt, post.createdAt)
      ),
      orderBy: [desc(schema.posts.createdAt)],
      columns: { id: true, slug: true, title: true },
    });

    const nextPost = await db.query.posts.findFirst({
      where: and(
        isAdmin ? undefined : eq(schema.posts.draft, 0),
        gt(schema.posts.createdAt, post.createdAt)
      ),
      orderBy: [asc(schema.posts.createdAt)],
      columns: { id: true, slug: true, title: true },
    });

    // Check if purchased
    let isPurchased = Boolean(
      user &&
        (isAdmin ||
          user.id === post.uid)
    );
    if (!isPurchased && user && post.permissionType === "points_required") {
      const unlock = await db.query.postUnlocks.findFirst({
        where: and(
          eq(schema.postUnlocks.userId, user.id),
          eq(schema.postUnlocks.postId, post.id)
        ),
      });
      isPurchased = Boolean(unlock);
    }

    // Get author info
    const author = post.uid
      ? await db.query.users.findFirst({
          where: eq(schema.users.id, post.uid),
          columns: { id: true, username: true, nickname: true, avatar: true },
        })
      : null;

    // Get current user points if logged in
    let userPoints = 0;
    if (user) {
      const u = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
        columns: { points: true },
      });
      userPoints = u?.points ?? 0;
    }

    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(post.tags || "[]");
    } catch {
      parsedTags = [];
    }

    const hasPassword = post.encrypted === 1 || Boolean(post.password && post.password.length > 0);

    const postDetail: PostDetailDto = {
      id: post.id,
      slug: post.slug,
      alias: post.alias,
      permalink: post.permalink,
      title: post.title,
      description: post.hideHomeContent === 1 && hasPassword && !isUnlocked ? "" : post.description,
      image: post.image,
      category: post.category,
      tags: parsedTags,
      pinned: post.pinned === 1,
      draft: post.draft === 1,
      commentEnabled: post.commentEnabled === 1,
      permissionType: post.permissionType as any,
      requiredPoints: post.requiredPoints,
      content: isUnlocked ? post.content : null,
      isUnlocked,
      isLocked: !isUnlocked,
      lockReason,
      requiresPassword: hasPassword,
      passwordHint: post.passwordHint || undefined,
      hideHomeContent: post.hideHomeContent === 1,
      isPurchased,
      isAuthenticated: Boolean(user),
      words: post.content ? post.content.replace(/\s+/g, "").length : 0,
      encrypted: post.encrypted === 1 || hasPassword,
      password: isAdmin ? (post.password || "") : undefined,
      prev: prevPost ? { id: prevPost.id, slug: prevPost.slug, title: prevPost.title } : null,
      next: nextPost ? { id: nextPost.id, slug: nextPost.slug, title: nextPost.title } : null,
      userPoints,
      author: author
        ? {
            id: author.id,
            username: author.username,
            nickname: author.nickname || author.username,
            avatar: author.avatar || "",
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    return c.json({
      success: true,
      data: postDetail,
      post: postDetail, // Backward compatibility alias
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch post" }, 500);
  }
}

// O(1) single-post query architecture via RESTful API by slug
postsRouter.get("/slug/:slug", async (c) => {
  return getPostDetailResponse(c, c.req.param("slug"));
});

// Post detail (by slug, alias, permalink, or numeric id)
postsRouter.get("/:slugOrId", async (c) => {
  return getPostDetailResponse(c, c.req.param("slugOrId"));
});

// Verify Post Password and issue short-lived password grant (V8-P0-03, V10-P0-09, V10-P0-10)
postsRouter.post("/:id/password/verify", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const idParam = c.req.param("id") || "";
    let post = null;
    const numericId = parseInt(idParam, 10);
    if (!isNaN(numericId) && numericId.toString() === idParam) {
      post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, numericId),
      });
    }
    if (!post) {
      post = await db.query.posts.findFirst({
        where: or(
          eq(schema.posts.slug, idParam),
          eq(schema.posts.alias, idParam),
          eq(schema.posts.permalink, idParam)
        ),
      });
    }
    if (!post) return c.json({ success: false, error: "Post not found" }, 404);

    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");
    if (post.draft === 1 && !isAdmin) {
      return c.json({ success: false, error: "Post not published" }, 404);
    }

    const hasPassword = post.encrypted === 1 || Boolean(post.password && post.password.length > 0);
    if (!hasPassword) {
      return c.json({
        success: true,
        message: "This post does not require a password",
        isUnlocked: true,
        content: post.content,
      });
    }

    const body = await c.req.json();
    const { password } = body;
    if (!password || typeof password !== "string" || password.length > 128) {
      return c.json({ success: false, error: "密码格式不正确" }, 400);
    }
    if (password !== post.password) {
      return c.json({ success: false, error: "密码错误，请重新输入" }, 401);
    }

    const grant = await signPostGrant(
      post.id,
      post.passwordVersion ?? 1,
      user ? user.id : null,
      c.env.JWT_SECRET
    );

    let isLoopback = false;
    try {
      const url = new URL(c.req.url);
      isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    } catch {}
    const secureFlag = isLoopback ? "" : "; Secure";

    // Store in consolidated cookie shirine_post_grants (bounded to 10 entries) (V10-P0-10)
    const cookieHeader = c.req.header("Cookie") || "";
    let grantsMap: Record<string, string> = {};
    const matchMap = cookieHeader.match(/shirine_post_grants=([^;]+)/);
    if (matchMap) {
      try {
        const parsed = JSON.parse(decodeURIComponent(matchMap[1]));
        if (parsed && typeof parsed === "object") grantsMap = parsed;
      } catch {}
    }
    grantsMap[post.id.toString()] = grant;
    const keys = Object.keys(grantsMap);
    if (keys.length > 10) {
      const toDelete = keys.slice(0, keys.length - 10);
      for (const k of toDelete) {
        delete grantsMap[k];
      }
    }
    const encodedMap = encodeURIComponent(JSON.stringify(grantsMap));
    c.header(
      "Set-Cookie",
      `shirine_post_grants=${encodedMap}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secureFlag}`
    );

    const access = await resolvePostAccess(
      post,
      user,
      grant,
      db,
      c.env.JWT_SECRET
    );

    return c.json({
      success: true,
      grant,
      isUnlocked: access.allGatesSatisfied,
      lockReason: access.lockReason,
      content: access.allGatesSatisfied ? post.content : null,
      message: "密码验证成功",
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Password verification failed" }, 500);
  }
});

// Unlock Post with points (Zero TOCTOU Atomic batch transaction: V8-P0-01, V8-P0-02, V10-P0-21)
postsRouter.post("/:id/unlock", requireAuth, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const idParam = c.req.param("id") || "";
    let post = null;
    const numericId = parseInt(idParam, 10);
    if (!isNaN(numericId) && numericId.toString() === idParam) {
      post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, numericId),
      });
    }
    if (!post) {
      post = await db.query.posts.findFirst({
        where: or(
          eq(schema.posts.slug, idParam),
          eq(schema.posts.alias, idParam),
          eq(schema.posts.permalink, idParam)
        ),
      });
    }
    if (!post) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const isAdmin = user.role === "superadmin" || user.role === "admin";
    if (post.draft === 1 && !isAdmin) {
      return c.json({ success: false, error: "Cannot unlock unpublished draft post" }, 403);
    }

    if (post.permissionType !== "points_required") {
      return c.json({
        success: false,
        error: "This post does not require points to unlock",
      }, 400);
    }

    const grant = extractPostGrant(c, post.id);

    // 1. Privileged bypass for admin or author
    if (isAdmin || user.id === post.uid) {
      const access = await resolvePostAccess(post, user, grant, db, c.env.JWT_SECRET);
      return c.json({
        success: true,
        message: "Post unlocked (privileged access)",
        isUnlocked: access.allGatesSatisfied,
        lockReason: access.lockReason,
        content: access.allGatesSatisfied ? post.content : null,
      });
    }

    // 2. Check if already unlocked
    const existingUnlock = await db.query.postUnlocks.findFirst({
      where: and(
        eq(schema.postUnlocks.userId, user.id),
        eq(schema.postUnlocks.postId, post.id)
      ),
    });
    if (existingUnlock) {
      const access = await resolvePostAccess(post, user, grant, db, c.env.JWT_SECRET);
      return c.json({
        success: true,
        message: "Post already unlocked",
        isUnlocked: access.allGatesSatisfied,
        lockReason: access.lockReason,
        content: access.allGatesSatisfied ? post.content : null,
      });
    }

    // 3. Free post unlock
    if (post.requiredPoints <= 0) {
      await db.insert(schema.postUnlocks).values({
        userId: user.id,
        postId: post.id,
        pointsSpent: 0,
      }).onConflictDoNothing();

      const access = await resolvePostAccess(post, user, grant, db, c.env.JWT_SECRET);
      return c.json({
        success: true,
        message: "Post unlocked",
        isUnlocked: access.allGatesSatisfied,
        lockReason: access.lockReason,
        content: access.allGatesSatisfied ? post.content : null,
      });
    }

    // 4. Atomic transaction using D1 batch (V8-P0-01 fix: unlock stmt executes first, deduct stmt checks points >= ?, ledger records purchase)
    const idempotencyKey = `post_unlock_${user.id}_${post.id}`;
    const stmtUnlock = c.env.DB.prepare(
      "INSERT INTO post_unlocks (user_id, post_id, points_spent, created_at) SELECT ?, ?, ?, unixepoch() FROM users WHERE id = ? AND points >= ?"
    ).bind(user.id, post.id, post.requiredPoints, user.id, post.requiredPoints);

    const stmtDeduct = c.env.DB.prepare(
      "UPDATE users SET points = points - ?, updated_at = unixepoch() WHERE id = ? AND points >= ? AND EXISTS (SELECT 1 FROM post_unlocks WHERE user_id = ? AND post_id = ?)"
    ).bind(post.requiredPoints, user.id, post.requiredPoints, user.id, post.id);

    const stmtLedger = c.env.DB.prepare(
      "INSERT INTO point_transactions (user_id, type, amount, balance_after, target_id, idempotency_key, description, created_at) SELECT ?, 'post_unlock', -?, points, ?, ?, ?, unixepoch() FROM users WHERE id = ? AND EXISTS (SELECT 1 FROM post_unlocks WHERE user_id = ? AND post_id = ?)"
    ).bind(user.id, post.requiredPoints, post.id, idempotencyKey, `Unlock post: ${post.title}`, user.id, user.id, post.id);

    let batchResults;
    try {
      batchResults = await c.env.DB.batch([stmtUnlock, stmtDeduct, stmtLedger]);
    } catch (err: any) {
      // V10-P0-21: Re-query postUnlocks to confirm whether it was actually already unlocked
      const existingUnlockAfterError = await db.query.postUnlocks.findFirst({
        where: and(
          eq(schema.postUnlocks.userId, user.id),
          eq(schema.postUnlocks.postId, post.id)
        ),
      });
      if (existingUnlockAfterError) {
        const access = await resolvePostAccess(post, user, grant, db, c.env.JWT_SECRET);
        return c.json({
          success: true,
          message: "Post already unlocked",
          isUnlocked: access.allGatesSatisfied,
          lockReason: access.lockReason,
          content: access.allGatesSatisfied ? post.content : null,
        });
      }
      throw err;
    }

    const unlockChanges = batchResults[0]?.meta?.changes ?? 0;
    const deductChanges = batchResults[1]?.meta?.changes ?? 0;

    if (unlockChanges === 0 || deductChanges === 0) {
      if (unlockChanges > 0 && deductChanges === 0) {
        await c.env.DB.prepare("DELETE FROM post_unlocks WHERE user_id = ? AND post_id = ?").bind(user.id, post.id).run();
      }
      await c.env.DB.prepare("DELETE FROM point_transactions WHERE idempotency_key = ?").bind(idempotencyKey).run();
      const currentUser = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
      });
      const currentPoints = currentUser?.points ?? 0;
      return c.json(
        {
          success: false,
          error: `Insufficient points. You need ${post.requiredPoints} points, but have ${currentPoints}. Check in daily to earn more!`,
          requiredPoints: post.requiredPoints,
          userPoints: currentPoints,
        },
        400
      );
    }

    const updatedUser = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    });

    const access = await resolvePostAccess(post, user, grant, db, c.env.JWT_SECRET);

    return c.json({
      success: true,
      message: access.allGatesSatisfied
        ? `Successfully unlocked post! Spent ${post.requiredPoints} points.`
        : `Spent ${post.requiredPoints} points to purchase access. Additional password verification required to view content.`,
      remainingPoints: updatedUser?.points ?? 0,
      isUnlocked: access.allGatesSatisfied,
      lockReason: access.lockReason,
      content: access.allGatesSatisfied ? post.content : null,
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
      alias,
      permalink,
      description = "",
      image = "",
      category = "",
      tags = [],
      pinned = false,
      draft = false,
      commentEnabled = true,
      permissionType = "public",
      requiredPoints = 0,
      encrypted = false,
      password = "",
      passwordHint = "",
      hideHomeContent = true,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    if (!content || typeof content !== "string") {
      return c.json({ success: false, error: "Content is required" }, 400);
    }

    // Sanitize and derive slug
    let finalSlug = slug?.trim();
    if (!finalSlug) {
      finalSlug =
        title
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Date.now();
    } else {
      finalSlug = finalSlug
        .replace(/[^\w\u4e00-\u9fa5\-]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Check slug uniqueness
    const existingPost = await db.query.posts.findFirst({
      where: eq(schema.posts.slug, finalSlug),
    });
    if (existingPost) {
      return c.json({ success: false, error: `Slug "${finalSlug}" is already taken` }, 409);
    }

    const hasPassword = Boolean(password && String(password).trim().length > 0);

    const resolvedPermission =
      permissionType === "login_required" || permissionType === "points_required" || permissionType === "password"
        ? permissionType
        : hasPassword
        ? "password"
        : "public";

    const valuesToInsert = {
      slug: finalSlug,
      alias: alias?.trim() || null,
      permalink: permalink?.trim() || null,
      title: title.trim(),
      content,
      description: description?.trim() || "",
      image: image?.trim() || "",
      category: category?.trim() || "",
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      pinned: pinned ? 1 : 0,
      draft: draft ? 1 : 0,
      commentEnabled: commentEnabled ? 1 : 0,
      permissionType: resolvedPermission,
      requiredPoints: Math.max(0, parseInt(requiredPoints) || 0),
      encrypted: (encrypted || hasPassword) ? 1 : 0,
      password: hasPassword ? String(password).trim() : "",
      passwordHint: passwordHint ? String(passwordHint).trim() : "",
      hideHomeContent: hideHomeContent ? 1 : 0,
      passwordVersion: 1,
      uid: user.id,
    };

    let inserted;
    try {
      inserted = await db.insert(schema.posts).values(valuesToInsert).returning();
    } catch (insertErr: any) {
      if (insertErr.message?.includes("CHECK constraint failed") && valuesToInsert.permissionType === "password") {
        valuesToInsert.permissionType = "public";
        valuesToInsert.encrypted = 1;
        inserted = await db.insert(schema.posts).values(valuesToInsert).returning();
      } else {
        throw insertErr;
      }
    }

    return c.json({
      success: true,
      data: inserted[0],
      post: inserted[0],
    }, 201);
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return c.json({ success: false, error: "A post with this slug already exists" }, 409);
    }
    return c.json({ success: false, error: err.message || "Failed to create post" }, 500);
  }
});

// Admin: Update Post
postsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id") || "0", 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid post ID" }, 400);
    }

    const body = await c.req.json();

    const existing = await db.query.posts.findFirst({
      where: eq(schema.posts.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const updates: Partial<typeof schema.posts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.slug !== undefined && body.slug.trim()) {
      updates.slug = body.slug.trim().replace(/[^\w\u4e00-\u9fa5\-]+/g, "-");
    }
    if (body.alias !== undefined) updates.alias = body.alias?.trim() || null;
    if (body.permalink !== undefined) updates.permalink = body.permalink?.trim() || null;
    // Prevent accidental content wipe (if body.content is provided, apply it)
    if (body.content !== undefined) updates.content = body.content;
    if (body.description !== undefined) updates.description = body.description;
    if (body.image !== undefined) updates.image = body.image;
    if (body.category !== undefined) updates.category = body.category;
    if (body.tags !== undefined) {
      updates.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    }
    if (body.pinned !== undefined) updates.pinned = body.pinned ? 1 : 0;
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;
    if (body.commentEnabled !== undefined) updates.commentEnabled = body.commentEnabled ? 1 : 0;
    if (body.permissionType !== undefined) {
      updates.permissionType =
        body.permissionType === "login_required" || body.permissionType === "points_required" || body.permissionType === "password"
          ? body.permissionType
          : "public";
    }
    if (body.requiredPoints !== undefined) {
      updates.requiredPoints = Math.max(0, parseInt(body.requiredPoints) || 0);
    }
    if (body.passwordHint !== undefined) updates.passwordHint = body.passwordHint?.trim() || "";
    if (body.hideHomeContent !== undefined) updates.hideHomeContent = body.hideHomeContent ? 1 : 0;

    // Password & Encrypted changes with passwordVersion invalidation (V10-P0-09, V10-P0-20)
    let passwordChanged = false;
    if (body.password !== undefined) {
      const newPwd = body.password ? String(body.password).trim() : "";
      if (newPwd !== (existing.password || "")) {
        updates.password = newPwd;
        passwordChanged = true;
      }
    }
    if (body.encrypted !== undefined) {
      const newEncrypted = body.encrypted ? 1 : 0;
      if (newEncrypted !== existing.encrypted) {
        updates.encrypted = newEncrypted;
        passwordChanged = true;
      }
    }
    if (updates.password && updates.password.length > 0) {
      updates.encrypted = 1;
    }
    if (passwordChanged) {
      updates.passwordVersion = (existing.passwordVersion || 1) + 1;
    }

    let updated;
    try {
      updated = await db
        .update(schema.posts)
        .set(updates)
        .where(eq(schema.posts.id, id))
        .returning();
    } catch (updateErr: any) {
      if (updateErr.message?.includes("CHECK constraint failed") && updates.permissionType === "password") {
        updates.permissionType = "public";
        updates.encrypted = 1;
        updated = await db
          .update(schema.posts)
          .set(updates)
          .where(eq(schema.posts.id, id))
          .returning();
      } else {
        throw updateErr;
      }
    }

    return c.json({
      success: true,
      data: updated[0],
      post: updated[0],
    });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return c.json({ success: false, error: "A post with this slug already exists" }, 409);
    }
    return c.json({ success: false, error: err.message || "Failed to update post" }, 500);
  }
});

// Admin: Delete Post
postsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id") || "0", 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid post ID" }, 400);
    }

    const existing = await db.query.posts.findFirst({
      where: eq(schema.posts.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    await db.delete(schema.posts).where(eq(schema.posts.id, id));
    return c.json({ success: true, message: "Post deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete post" }, 500);
  }
});
