import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAuth, requireAdmin } from "../core/middleware";

export const albumsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List albums
albumsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);

    const allAlbums = await db.query.albums.findMany({
      where: !user || user.role !== "superadmin" ? eq(schema.albums.draft, 0) : undefined,
      orderBy: [desc(schema.albums.createdAt)],
    });

    let unlockedAlbumIds = new Set<number>();
    if (user) {
      const userUnlocks = await db.query.albumUnlocks.findMany({
        where: eq(schema.albumUnlocks.userId, user.id),
      });
      unlockedAlbumIds = new Set(userUnlocks.map((u) => u.albumId));
    }

    const albumsWithPerms = await Promise.all(
      allAlbums.map(async (album) => {
        let isUnlocked = true;
        if (album.permissionType === "login_required") {
          isUnlocked = !!user;
        } else if (album.permissionType === "points_required") {
          isUnlocked = !!(
            user &&
            (user.role === "superadmin" || user.id === album.uid || unlockedAlbumIds.has(album.id))
          );
        }

        const photoCount = await db.query.albumPhotos.findMany({
          where: eq(schema.albumPhotos.albumId, album.id),
          columns: { id: true },
        });

        return {
          id: album.id,
          title: album.title,
          description: album.description,
          cover: album.cover,
          photoCount: photoCount.length,
          permissionType: album.permissionType,
          requiredPoints: album.requiredPoints,
          isUnlocked,
          draft: album.draft === 1,
          createdAt: album.createdAt,
          updatedAt: album.updatedAt,
        };
      })
    );

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
    const id = parseInt(c.req.param("id"));

    const album = await db.query.albums.findFirst({
      where: eq(schema.albums.id, id),
    });

    if (!album) {
      return c.json({ success: false, error: "Album not found" }, 404);
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
      } else if (user.role !== "superadmin" && user.id !== album.uid) {
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

    let photos = [];
    if (isUnlocked) {
      photos = await db.query.albumPhotos.findMany({
        where: eq(schema.albumPhotos.albumId, album.id),
        orderBy: [schema.albumPhotos.sortOrder],
      });
    }

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
      album: {
        id: album.id,
        title: album.title,
        description: album.description,
        cover: album.cover,
        permissionType: album.permissionType,
        requiredPoints: album.requiredPoints,
        isUnlocked,
        lockReason,
        userPoints,
        photos,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch album" }, 500);
  }
});

// Unlock Album
albumsRouter.post("/:id/unlock", requireAuth, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));

    const album = await db.query.albums.findFirst({
      where: eq(schema.albums.id, id),
    });

    if (!album) {
      return c.json({ success: false, error: "Album not found" }, 404);
    }

    if (album.permissionType !== "points_required") {
      return c.json({ success: true, message: "This album does not require points to unlock" });
    }

    const existingUnlock = await db.query.albumUnlocks.findFirst({
      where: and(
        eq(schema.albumUnlocks.userId, user.id),
        eq(schema.albumUnlocks.albumId, album.id)
      ),
    });
    if (existingUnlock || user.role === "superadmin" || user.id === album.uid) {
      return c.json({ success: true, message: "Album already unlocked" });
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    });
    if (!currentUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    if (currentUser.points < album.requiredPoints) {
      return c.json(
        {
          success: false,
          error: `Insufficient points. You need ${album.requiredPoints} points, but have ${currentUser.points}. Check in daily to earn more!`,
          requiredPoints: album.requiredPoints,
          userPoints: currentUser.points,
        },
        400
      );
    }

    const newPoints = currentUser.points - album.requiredPoints;
    await db.insert(schema.albumUnlocks).values({
      userId: user.id,
      albumId: album.id,
      pointsSpent: album.requiredPoints,
    });

    await db
      .update(schema.users)
      .set({ points: newPoints, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const photos = await db.query.albumPhotos.findMany({
      where: eq(schema.albumPhotos.albumId, album.id),
      orderBy: [schema.albumPhotos.sortOrder],
    });

    return c.json({
      success: true,
      message: `Successfully unlocked album! Spent ${album.requiredPoints} points.`,
      remainingPoints: newPoints,
      photos,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to unlock album" }, 500);
  }
});

// Admin: Create Album
albumsRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { title, description = "", cover = "", permissionType = "public", requiredPoints = 0, draft = false } = body;

    if (!title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }

    const inserted = await db
      .insert(schema.albums)
      .values({
        title: title.trim(),
        description,
        cover,
        permissionType,
        requiredPoints: Math.max(0, parseInt(requiredPoints) || 0),
        draft: draft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    return c.json({ success: true, album: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create album" }, 500);
  }
});

// Admin: Update Album
albumsRouter.put("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const updates: Partial<typeof schema.albums.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.cover !== undefined) updates.cover = body.cover;
    if (body.permissionType !== undefined) updates.permissionType = body.permissionType;
    if (body.requiredPoints !== undefined)
      updates.requiredPoints = Math.max(0, parseInt(body.requiredPoints) || 0);
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;

    const updated = await db.update(schema.albums).set(updates).where(eq(schema.albums.id, id)).returning();
    return c.json({ success: true, album: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update album" }, 500);
  }
});

// Admin: Delete Album
albumsRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.albums).where(eq(schema.albums.id, id));
    return c.json({ success: true, message: "Album deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete album" }, 500);
  }
});

// Admin: Add photo to album
albumsRouter.post("/:id/photos", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const albumId = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const { url, title = "", description = "", sortOrder = 0 } = body;

    if (!url) {
      return c.json({ success: false, error: "Photo URL is required" }, 400);
    }

    const inserted = await db
      .insert(schema.albumPhotos)
      .values({
        albumId,
        url,
        title,
        description,
        sortOrder,
      })
      .returning();

    return c.json({ success: true, photo: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to add photo" }, 500);
  }
});

// Admin: Delete photo
albumsRouter.delete("/photos/:photoId", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const photoId = parseInt(c.req.param("photoId"));
    await db.delete(schema.albumPhotos).where(eq(schema.albumPhotos.id, photoId));
    return c.json({ success: true, message: "Photo deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete photo" }, 500);
  }
});
