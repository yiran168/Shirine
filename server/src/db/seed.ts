import { eq, sql } from "drizzle-orm";
import type { getDb } from "./index";
import { schema } from "./index";
import {
  PRESET_POSTS,
  PRESET_MOMENTS,
  PRESET_ALBUMS,
  PRESET_FRIENDS,
} from "./seed-data";
import { defaultSiteConfig } from "../routes/config";

export async function seedPresetData(
  db: ReturnType<typeof getDb>,
  overwrite = false
) {
  const summary = {
    posts: 0,
    moments: 0,
    albums: 0,
    photos: 0,
    friends: 0,
  };

  // 1. Resolve SuperAdmin if already registered via /setup/admin
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.role, "superadmin"),
  });
  const adminUid = existingAdmin ? existingAdmin.id : null;

  // 2. Friends
  for (const f of PRESET_FRIENDS) {
    const existing = await db.query.friends.findFirst({
      where: eq(schema.friends.url, f.url),
    });
    if (!existing) {
      await db.insert(schema.friends).values({
        name: f.name,
        desc: f.desc,
        avatar: f.avatar,
        url: f.url,
        accepted: f.accepted,
        sortOrder: f.sortOrder,
        uid: adminUid,
      });
      summary.friends++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.friends)
        .set({
          ...(overwrite ? {
            name: f.name,
            desc: f.desc,
            avatar: f.avatar,
            accepted: f.accepted,
            sortOrder: f.sortOrder,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.friends.id, existing.id));
      summary.friends++;
    }
  }

  // 3. Moments
  for (const m of PRESET_MOMENTS) {
    const existing = await db.query.moments.findFirst({
      where: eq(schema.moments.content, m.content),
    });
    if (!existing) {
      await db.insert(schema.moments).values({
        content: m.content,
        location: m.location,
        mood: m.mood,
        images: JSON.stringify(m.images),
        tags: JSON.stringify(m.tags),
        pinned: m.pinned,
        uid: adminUid,
        createdAt: new Date(m.createdAt),
      });
      summary.moments++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.moments)
        .set({
          ...(overwrite ? {
            location: m.location,
            mood: m.mood,
            images: JSON.stringify(m.images),
            tags: JSON.stringify(m.tags),
            pinned: m.pinned,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.moments.id, existing.id));
      summary.moments++;
    }
  }

  // 4. Albums & Photos
  for (const a of PRESET_ALBUMS) {
    let albumId: number | null = null;
    const existing = await db.query.albums.findFirst({
      where: eq(schema.albums.slug, a.slug),
    });

    if (!existing) {
      const inserted = await db
        .insert(schema.albums)
        .values({
          slug: a.slug,
          title: a.title,
          description: a.description,
          cover: a.cover,
          layout: a.layout,
          columns: a.columns,
          tags: JSON.stringify(a.tags),
          hidden: a.hidden,
          permissionType: a.permissionType,
          requiredPoints: a.requiredPoints,
          draft: a.draft,
          uid: adminUid,
        })
        .returning();
      albumId = inserted[0]?.id;
      summary.albums++;
    } else {
      albumId = existing.id;
      if (overwrite || (existing.uid === null && adminUid !== null)) {
        await db
          .update(schema.albums)
          .set({
            ...(overwrite ? {
              title: a.title,
              description: a.description,
              cover: a.cover,
              layout: a.layout,
              columns: a.columns,
              tags: JSON.stringify(a.tags),
              hidden: a.hidden,
              permissionType: a.permissionType,
              requiredPoints: a.requiredPoints,
              draft: a.draft,
            } : {}),
            uid: existing.uid ?? adminUid,
            updatedAt: new Date(),
          })
          .where(eq(schema.albums.id, existing.id));
        summary.albums++;
      }
    }

    if (albumId && (overwrite || !existing)) {
      if (overwrite) {
        await db.delete(schema.albumPhotos).where(eq(schema.albumPhotos.albumId, albumId));
      }
      for (const p of a.photos) {
        await db
          .insert(schema.albumPhotos)
          .values({
            albumId,
            url: p.url,
            alt: p.alt,
            title: p.title,
            description: p.description,
            tags: JSON.stringify(p.tags),
            sortOrder: p.sortOrder,
          })
          .onConflictDoUpdate({
            target: [schema.albumPhotos.albumId, schema.albumPhotos.url],
            set: {
              alt: p.alt,
              title: p.title,
              description: p.description,
              tags: JSON.stringify(p.tags),
              sortOrder: p.sortOrder,
            },
          });
        summary.photos++;
      }
    }
  }

  // 5. Posts
  for (const p of PRESET_POSTS) {
    const existing = await db.query.posts.findFirst({
      where: eq(schema.posts.slug, p.slug),
    });

    if (!existing) {
      await db.insert(schema.posts).values({
        slug: p.slug,
        alias: p.alias,
        permalink: p.permalink,
        title: p.title,
        description: p.description,
        content: p.content,
        image: p.image,
        category: p.category,
        tags: JSON.stringify(p.tags),
        lang: p.lang || "zh_CN",
        pinned: p.pinned,
        draft: p.draft,
        commentEnabled: p.commentEnabled,
        permissionType: p.permissionType,
        requiredPoints: p.requiredPoints,
        encrypted: p.encrypted || 0,
        password: p.password || "",
        passwordHint: p.passwordHint || "",
        hideHomeContent: p.hideHomeContent ?? 1,
        uid: adminUid,
        createdAt: new Date(p.createdAt),
      });
      summary.posts++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.posts)
        .set({
          ...(overwrite ? {
            alias: p.alias,
            permalink: p.permalink,
            title: p.title,
            description: p.description,
            content: p.content,
            image: p.image,
            category: p.category,
            tags: JSON.stringify(p.tags),
            lang: p.lang || "zh_CN",
            pinned: p.pinned,
            draft: p.draft,
            commentEnabled: p.commentEnabled,
            permissionType: p.permissionType,
            requiredPoints: p.requiredPoints,
            encrypted: p.encrypted || 0,
            password: p.password || "",
            passwordHint: p.passwordHint || "",
            hideHomeContent: p.hideHomeContent ?? 1,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.posts.id, existing.id));
      summary.posts++;
    }
  }

  // 6. Default Site Configs (if empty)
  for (const [key, value] of Object.entries(defaultSiteConfig)) {
    const existing = await db.query.siteConfigs.findFirst({
      where: eq(schema.siteConfigs.key, key),
    });
    if (!existing) {
      await db.insert(schema.siteConfigs).values({
        key,
        value: JSON.stringify(value),
      });
    }
  }

  return summary;
}
