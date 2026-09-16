import { Hono } from "hono";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth, requireAdmin } from "../core/middleware";
import type { AlbumIndexDto, AlbumDetailDto, AlbumPhotoDto } from "../types/dto";

export const albumsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List albums
albumsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    const allAlbums = await db.query.albums.findMany({
      where: !isAdmin ? eq(schema.albums.draft, 0) : undefined,
      orderBy: [desc(schema.albums.createdAt)],
    });

    if (allAlbums.length === 0) {
      return c.json({ success: true, data: [] });
    }

    // Get unlocked album IDs for current user
    let unlockedAlbumIds = new Set<number>();
    if (user) {
      const userUnlocks = await db.query.albumUnlocks.findMany({
        where: eq(schema.albumUnlocks.userId, user.id),
      });
      unlockedAlbumIds = new Set(userUnlocks.map((u) => u.albumId));
    }

    // Eliminate N+1 query: fetch photo counts in a single batch query (#46)
    const albumIds = allAlbums.map((a) => a.id);
    const photoCountRows = await db
      .select({
        albumId: schema.albumPhotos.albumId,
        count: sql<number>`count(*)`,
      })
      .from(schema.albumPhotos)
      .where(inArray(schema.albumPhotos.albumId, albumIds))
      .groupBy(schema.albumPhotos.albumId);

    const countMap = new Map<number, number>();
    for (const row of photoCountRows) {
      countMap.set(row.albumId, row.count);
    }

    const albumsWithPerms: AlbumIndexDto[] = allAlbums.map((album) => {
      let isUnlocked = true;
      if (album.permissionType === "login_required") {
        isUnlocked = !!user;
      } else if (album.permissionType === "points_required") {
        isUnlocked = !!(
          user &&
          (isAdmin || user.id === album.uid || unlockedAlbumIds.has(album.id))
        );
      }

      const photoCount = countMap.get(album.id) ?? 0;

      return {
        id: album.id,
        slug: album.slug,
        title: album.title,
        description: album.description,
        cover: album.cover,
        photoCount,
        count: photoCount, // legacy alias
        permissionType: album.permissionType as any,
        requiredPoints: album.requiredPoints,
        isUnlocked,
        protected: album.permissionType !== "public",
        draft: album.draft === 1,
        layout: (album.layout as "grid" | "masonry") || "masonry",
        columns: album.columns || 3,
        tags: [],
        date: album.createdAt ? new Date(album.createdAt).toISOString().slice(0, 10) : "",
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
      };
    });

    return c.json({ success: true, data: albumsWithPerms });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch albums" }, 500);
  }
});

// Album detail & photos
albumsRouter.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const idParam = c.req.param("id");
    const id = parseInt(idParam);
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    let album = null;
    if (!isNaN(id)) {
      album = await db.query.albums.findFirst({
        where: eq(schema.albums.id, id),
      });
    }

    if (!album) {
      album = await db.query.albums.findFirst({
        where: eq(schema.albums.slug, idParam),
      });
    }

    if (!album) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    // Check draft: non-admins cannot access draft albums (#18)
    if (album.draft === 1 && !isAdmin) {
      return c.json({ success: false, error: "Album not published" }, 404);
    }

    let isUnlocked = true;
    let lockReason = "";

    if (album.permissionType === "login_required") {
      if (!user) {
        isUnlocked = false;
        lockReason = "login_required";
      }
    } else if (album.permissionType === "points_required") {
      if (!user) {
        isUnlocked = false;
        lockReason = "login_required";
      } else if (!isAdmin && user.id !== album.uid) {
        const unlock = await db.query.albumUnlocks.findFirst({
          where: and(
            eq(schema.albumUnlocks.userId, user.id),
            eq(schema.albumUnlocks.albumId, album.id)
          ),
        });
        if (!unlock) {
          isUnlocked = false;
          lockReason = "points_required";
        }
      }
    }

    // Get current user points if logged in
    let userPoints = 0;
    if (user) {
      const u = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
        columns: { points: true },
      });
      userPoints = u?.points ?? 0;
    }

    // Get total photo count regardless of unlock status (#10)
    const countRes = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM album_photos WHERE album_id = ?"
    )
      .bind(album.id)
      .first<{ total: number }>();
    const totalPhotoCount = countRes?.total ?? 0;

    // Get photos only if unlocked
    let photos: AlbumPhotoDto[] = [];
    if (isUnlocked) {
      const dbPhotos = await db.query.albumPhotos.findMany({
        where: eq(schema.albumPhotos.albumId, album.id),
        orderBy: [schema.albumPhotos.sortOrder],
      });

      // Map to standard AlbumPhotoDto with src and alt (#14, #15)
      photos = dbPhotos.map((p) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(p.tags || "[]");
        } catch {
          tags = [];
        }
        return {
          id: p.id,
          src: p.url,
          url: p.url,
          alt: p.alt || p.title || album.title,
          title: p.title || "",
          description: p.description || "",
          tags,
          sortOrder: p.sortOrder,
        };
      });
    }

    const albumDetail: AlbumDetailDto = {
      id: album.id,
      slug: album.slug,
      title: album.title,
      description: album.description,
      cover: album.cover,
      layout: (album.layout as "grid" | "masonry") || "masonry",
      columns: album.columns || 3,
      photoCount: totalPhotoCount,
      count: totalPhotoCount,
      permissionType: album.permissionType as any,
      requiredPoints: album.requiredPoints,
      isUnlocked,
      protected: album.permissionType !== "public",
      draft: album.draft === 1,
      lockReason,
      userPoints,
      tags: [],
      photos,
      date: album.createdAt ? new Date(album.createdAt).toISOString().slice(0, 10) : "",
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };

    return c.json({
      success: true,
      data: albumDetail,
      album: albumDetail, // Backward compatibility alias (#13)
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch album" }, 500);
  }
});

// Unlock Album with points (Atomic transaction)
albumsRouter.post("/:id/unlock", requireAuth, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id") || "0", 10);

    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid album ID" }, 400);
    }

    const album = await db.query.albums.findFirst({
      where: eq(schema.albums.id, id),
    });

    if (!album) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    const isAdmin = user.role === "superadmin" || user.role === "admin";
    // Refuse unlocking draft albums (#19)
    if (album.draft === 1 && !isAdmin) {
      return c.json({ success: false, error: "Cannot unlock unpublished draft album" }, 403);
    }

    if (album.permissionType !== "points_required") {
      return c.json({ success: false, error: "This album does not require points to unlock" }, 400);
    }

    // 1. Privileged bypass
    if (isAdmin || user.id === album.uid) {
      const dbPhotos = await db.query.albumPhotos.findMany({
        where: eq(schema.albumPhotos.albumId, album.id),
        orderBy: [schema.albumPhotos.sortOrder],
      });
      return c.json({
        success: true,
        message: "Album unlocked (privileged access)",
        photos: dbPhotos.map((p) => {
          let tags: string[] = [];
          try { tags = JSON.parse(p.tags || "[]"); } catch { tags = []; }
          return {
            id: p.id,
            src: p.url,
            url: p.url,
            alt: p.alt || p.title || album.title,
            title: p.title || "",
            description: p.description || "",
            tags,
            sortOrder: p.sortOrder,
          };
        }),
      });
    }

    // 2. Check if already unlocked
    const existingUnlock = await db.query.albumUnlocks.findFirst({
      where: and(
        eq(schema.albumUnlocks.userId, user.id),
        eq(schema.albumUnlocks.albumId, album.id)
      ),
    });
    if (existingUnlock) {
      const dbPhotos = await db.query.albumPhotos.findMany({
        where: eq(schema.albumPhotos.albumId, album.id),
        orderBy: [schema.albumPhotos.sortOrder],
      });
      return c.json({
        success: true,
        message: "Album already unlocked",
        photos: dbPhotos.map((p) => {
          let tags: string[] = [];
          try { tags = JSON.parse(p.tags || "[]"); } catch { tags = []; }
          return {
            id: p.id,
            src: p.url,
            url: p.url,
            alt: p.alt || p.title || album.title,
            title: p.title || "",
            description: p.description || "",
            tags,
            sortOrder: p.sortOrder,
          };
        }),
      });
    }

    // 3. Free album unlock
    if (album.requiredPoints <= 0) {
      await db.insert(schema.albumUnlocks).values({
        userId: user.id,
        albumId: album.id,
        pointsSpent: 0,
      }).onConflictDoNothing();

      const dbPhotos = await db.query.albumPhotos.findMany({
        where: eq(schema.albumPhotos.albumId, album.id),
        orderBy: [schema.albumPhotos.sortOrder],
      });
      return c.json({
        success: true,
        message: "Album unlocked",
        photos: dbPhotos.map((p) => {
          let tags: string[] = [];
          try { tags = JSON.parse(p.tags || "[]"); } catch { tags = []; }
          return {
            id: p.id,
            src: p.url,
            url: p.url,
            alt: p.alt || p.title || album.title,
            title: p.title || "",
            description: p.description || "",
            tags,
            sortOrder: p.sortOrder,
          };
        }),
      });
    }

    // 4. Atomic transaction using D1 batch (V8-P0-01 fix: unlock stmt first, deduct stmt second, ledger records purchase)
    const idempotencyKey = `album_unlock_${user.id}_${album.id}`;
    const stmtUnlock = c.env.DB.prepare(
      "INSERT INTO album_unlocks (user_id, album_id, points_spent, created_at) SELECT ?, ?, ?, unixepoch() FROM users WHERE id = ? AND points >= ?"
    ).bind(user.id, album.id, album.requiredPoints, user.id, album.requiredPoints);

    const stmtDeduct = c.env.DB.prepare(
      "UPDATE users SET points = points - ?, updated_at = unixepoch() WHERE id = ? AND points >= ? AND EXISTS (SELECT 1 FROM album_unlocks WHERE user_id = ? AND album_id = ?)"
    ).bind(album.requiredPoints, user.id, album.requiredPoints, user.id, album.id);

    const stmtLedger = c.env.DB.prepare(
      "INSERT INTO point_transactions (user_id, type, amount, balance_after, target_id, idempotency_key, description, created_at) SELECT ?, 'album_unlock', -?, (points - ?), ?, ?, ?, unixepoch() FROM users WHERE id = ? AND points >= ?"
    ).bind(user.id, album.requiredPoints, album.requiredPoints, album.id, idempotencyKey, `Unlock album: ${album.title}`, user.id, album.requiredPoints);

    let batchResults;
    try {
      batchResults = await c.env.DB.batch([stmtUnlock, stmtDeduct, stmtLedger]);
    } catch (err: any) {
      if (err.message?.includes("UNIQUE") || err.message?.includes("constraint")) {
        const dbPhotos = await db.query.albumPhotos.findMany({
          where: eq(schema.albumPhotos.albumId, album.id),
          orderBy: [schema.albumPhotos.sortOrder],
        });
        return c.json({
          success: true,
          message: "Album already unlocked",
          photos: dbPhotos.map((p) => {
            let tags: string[] = [];
            try { tags = JSON.parse(p.tags || "[]"); } catch { tags = []; }
            return {
              id: p.id,
              src: p.url,
              url: p.url,
              alt: p.alt || p.title || album.title,
              title: p.title || "",
              description: p.description || "",
              tags,
              sortOrder: p.sortOrder,
            };
          }),
        });
      }
      throw err;
    }

    const unlockChanges = batchResults[0]?.meta?.changes ?? 0;
    const deductChanges = batchResults[1]?.meta?.changes ?? 0;

    if (unlockChanges === 0 || deductChanges === 0) {
      if (unlockChanges > 0 && deductChanges === 0) {
        await c.env.DB.prepare("DELETE FROM album_unlocks WHERE user_id = ? AND album_id = ?").bind(user.id, album.id).run();
      }
      const currentUser = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
      const currentPoints = currentUser?.points ?? 0;
      return c.json(
        {
          success: false,
          error: `Insufficient points. You need ${album.requiredPoints} points, but have ${currentPoints}. Check in daily to earn more!`,
          requiredPoints: album.requiredPoints,
          userPoints: currentPoints,
        },
        400
      );
    }

    const updatedUser = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });

    // Fetch photos now that album is unlocked
    const dbPhotos = await db.query.albumPhotos.findMany({
      where: eq(schema.albumPhotos.albumId, album.id),
      orderBy: [schema.albumPhotos.sortOrder],
    });
    const photos: AlbumPhotoDto[] = dbPhotos.map((p) => {
      let tags: string[] = [];
      try { tags = JSON.parse(p.tags || "[]"); } catch { tags = []; }
      return {
        id: p.id,
        src: p.url,
        url: p.url,
        alt: p.alt || p.title || album.title,
        title: p.title || "",
        description: p.description || "",
        tags,
        sortOrder: p.sortOrder,
      };
    });

    return c.json({
      success: true,
      message: `Successfully unlocked album! Spent ${album.requiredPoints} points.`,
      remainingPoints: updatedUser?.points ?? 0,
      photos,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to unlock album" }, 500);
  }
});

// Admin: Create Album (with transactional photos support #17)
albumsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const {
      title,
      slug,
      description = "",
      cover = "",
      layout = "masonry",
      columns = 3,
      permissionType = "public",
      requiredPoints = 0,
      draft = false,
      photos = [],
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }

    const inserted = await db
      .insert(schema.albums)
      .values({
        title: title.trim(),
        slug: slug?.trim() || null,
        description: description?.trim() || "",
        cover: cover?.trim() || "",
        layout: layout === "grid" ? "grid" : "masonry",
        columns: Math.max(2, Math.min(4, Number(columns) || 3)),
        permissionType:
          permissionType === "login_required" || permissionType === "points_required"
            ? permissionType
            : "public",
        requiredPoints: Math.max(0, parseInt(requiredPoints) || 0),
        draft: draft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    const newAlbum = inserted[0];

    // Batch insert photos if provided (#17)
    if (Array.isArray(photos) && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const photoUrl = typeof p === "string" ? p : p.src || p.url;
        if (photoUrl && typeof photoUrl === "string" && photoUrl.trim()) {
          await db.insert(schema.albumPhotos).values({
            albumId: newAlbum.id,
            url: photoUrl.trim(),
            alt: typeof p === "object" ? p.alt || "" : "",
            title: typeof p === "object" ? p.title || "" : "",
            description: typeof p === "object" ? p.description || "" : "",
            sortOrder: i,
          });
        }
      }
    }

    return c.json({
      success: true,
      data: newAlbum,
      album: newAlbum,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create album" }, 500);
  }
});

// Admin: Update Album
albumsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id") || "0", 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid album ID" }, 400);
    }

    const existing = await db.query.albums.findFirst({
      where: eq(schema.albums.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    const body = await c.req.json();

    const updates: Partial<typeof schema.albums.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.slug !== undefined) updates.slug = body.slug.trim() || null;
    if (body.description !== undefined) updates.description = body.description;
    if (body.cover !== undefined) updates.cover = body.cover;
    if (body.layout !== undefined) updates.layout = body.layout === "grid" ? "grid" : "masonry";
    if (body.columns !== undefined) updates.columns = Math.max(2, Math.min(4, Number(body.columns) || 3));
    if (body.permissionType !== undefined) {
      updates.permissionType =
        body.permissionType === "login_required" || body.permissionType === "points_required"
          ? body.permissionType
          : "public";
    }
    if (body.requiredPoints !== undefined) {
      updates.requiredPoints = Math.max(0, parseInt(body.requiredPoints) || 0);
    }
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;

    const updated = await db
      .update(schema.albums)
      .set(updates)
      .where(eq(schema.albums.id, id))
      .returning();

    // If photos array provided, update photos
    if (Array.isArray(body.photos)) {
      // Remove previous photos and insert new batch
      await db.delete(schema.albumPhotos).where(eq(schema.albumPhotos.albumId, id));
      for (let i = 0; i < body.photos.length; i++) {
        const p = body.photos[i];
        const photoUrl = typeof p === "string" ? p : p.src || p.url;
        if (photoUrl && typeof photoUrl === "string" && photoUrl.trim()) {
          await db.insert(schema.albumPhotos).values({
            albumId: id,
            url: photoUrl.trim(),
            alt: typeof p === "object" ? p.alt || "" : "",
            title: typeof p === "object" ? p.title || "" : "",
            description: typeof p === "object" ? p.description || "" : "",
            sortOrder: i,
          });
        }
      }
    }

    return c.json({
      success: true,
      data: updated[0],
      album: updated[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update album" }, 500);
  }
});

// Admin: Delete Album
albumsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id") || "0", 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: "Invalid album ID" }, 400);
    }

    const existing = await db.query.albums.findFirst({
      where: eq(schema.albums.id, id),
    });
    if (!existing) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    await db.delete(schema.albums).where(eq(schema.albums.id, id));
    return c.json({ success: true, message: "Album deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete album" }, 500);
  }
});

// Admin: Add single photo to album (with album existence check #48)
albumsRouter.post("/:id/photos", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const albumId = parseInt(c.req.param("id") || "0", 10);
    if (isNaN(albumId)) {
      return c.json({ success: false, error: "Invalid album ID" }, 400);
    }

    const album = await db.query.albums.findFirst({
      where: eq(schema.albums.id, albumId),
    });
    if (!album) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    const body = await c.req.json();
    const { url, src, title = "", description = "", alt = "", sortOrder = 0 } = body;
    const photoUrl = src || url;

    if (!photoUrl) {
      return c.json({ success: false, error: "Photo URL is required" }, 400);
    }

    const inserted = await db
      .insert(schema.albumPhotos)
      .values({
        albumId,
        url: photoUrl.trim(),
        alt: alt?.trim() || title?.trim() || "",
        title: title?.trim() || "",
        description: description?.trim() || "",
        sortOrder: parseInt(sortOrder) || 0,
      })
      .returning();

    return c.json({ success: true, data: inserted[0], photo: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to add photo" }, 500);
  }
});

// Admin: Delete photo (with existence check #49)
albumsRouter.delete("/photos/:photoId", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const photoId = parseInt(c.req.param("photoId") || "0", 10);
    if (isNaN(photoId)) {
      return c.json({ success: false, error: "Invalid photo ID" }, 400);
    }

    const existing = await db.query.albumPhotos.findFirst({
      where: eq(schema.albumPhotos.id, photoId),
    });
    if (!existing) {
      return c.json({ success: false, error: "Photo not found" }, 404);
    }

    await db.delete(schema.albumPhotos).where(eq(schema.albumPhotos.id, photoId));
    return c.json({ success: true, message: "Photo deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete photo" }, 500);
  }
});
