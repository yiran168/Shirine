import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";
import type { PageDto } from "../types/dto";

import { PRESET_PAGES } from "../db/seed";

export const pagesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "posts",
  "albums",
  "moments",
  "friends",
  "tags",
  "categories",
  "archive",
  "rss",
  "atom",
  "pages",
  "page",
  "404",
  "timeline",
  "anime",
  "compass",
]);

// List all pages
pagesRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    let allPages = await db.query.pages.findMany({
      where: !isAdmin ? eq(schema.pages.draft, 0) : undefined,
      orderBy: [desc(schema.pages.createdAt)],
    });

    if (allPages.length === 0) {
      try {
        const superadmin = await db.query.users.findFirst({
          where: eq(schema.users.role, "superadmin"),
        });
        const uid = superadmin ? superadmin.id : null;
        for (const page of PRESET_PAGES) {
          await db
            .insert(schema.pages)
            .values({
              slug: page.slug,
              title: page.title,
              content: page.content,
              draft: 0,
              uid,
            })
            .onConflictDoNothing();
        }
        allPages = await db.query.pages.findMany({
          where: !isAdmin ? eq(schema.pages.draft, 0) : undefined,
          orderBy: [desc(schema.pages.createdAt)],
        });
      } catch {}
    }

    const formatted: (PageDto & { status?: string })[] = allPages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      draft: p.draft === 1,
      status: p.draft === 1 ? "draft" : "published",
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return c.json({ success: true, data: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch pages" }, 500);
  }
});

// Get page by slug
pagesRouter.get("/:slug", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);
    const slug = c.req.param("slug");
    const isAdmin = user && (user.role === "superadmin" || user.role === "admin");

    const page = await db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
    });

    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    if (page.draft === 1 && !isAdmin) {
      return c.json({ success: false, error: "Page not published" }, 404);
    }

    const pageDto: PageDto = {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      draft: page.draft === 1,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };

    return c.json({
      success: true,
      data: pageDto,
      page: pageDto,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch page" }, 500);
  }
});

// Admin: Create page (with reserved route check #65 and duplicate 409 check #66)
pagesRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { slug, title, content } = body;
    const isDraft = body.draft !== undefined ? Boolean(body.draft) : body.status === "draft";

    if (!slug || typeof slug !== "string" || !slug.trim()) {
      return c.json({ success: false, error: "Slug is required" }, 400);
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    if (!content || typeof content !== "string") {
      return c.json({ success: false, error: "Content is required" }, 400);
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/^[/\s]+|[/\s]+$/g, "");
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return c.json(
        {
          success: false,
          error: `Slug "${cleanSlug}" is reserved for system routes. Please pick another slug.`,
        },
        400
      );
    }

    // Check if slug exists
    const existing = await db.query.pages.findFirst({
      where: eq(schema.pages.slug, cleanSlug),
    });
    if (existing) {
      return c.json({ success: false, error: `Page slug "${cleanSlug}" already exists` }, 409);
    }

    const inserted = await db
      .insert(schema.pages)
      .values({
        slug: cleanSlug,
        title: title.trim(),
        content,
        draft: isDraft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    return c.json({
      success: true,
      data: inserted[0],
      page: inserted[0],
    });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return c.json({ success: false, error: "Page slug already exists" }, 409);
    }
    return c.json({ success: false, error: err.message || "Failed to create page" }, 500);
  }
});

// Admin: Update page
pagesRouter.put("/:idOrSlug", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const idOrSlug = c.req.param("idOrSlug") || "";
    if (!idOrSlug) {
      return c.json({ success: false, error: "Page slug or ID is required" }, 400);
    }
    const isId = /^\d+$/.test(idOrSlug);

    let existing = null;
    if (isId) {
      existing = await db.query.pages.findFirst({
        where: eq(schema.pages.id, parseInt(idOrSlug, 10)),
      });
    }
    if (!existing) {
      existing = await db.query.pages.findFirst({
        where: eq(schema.pages.slug, idOrSlug),
      });
    }

    if (!existing) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    const body = await c.req.json();
    const updates: Partial<typeof schema.pages.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.content !== undefined) updates.content = body.content;
    if (body.draft !== undefined) {
      updates.draft = body.draft ? 1 : 0;
    } else if (body.status !== undefined) {
      updates.draft = body.status === "draft" ? 1 : 0;
    }
    if (body.slug !== undefined && body.slug.trim()) {
      const cleanSlug = body.slug.trim().toLowerCase().replace(/^[/\s]+|[/\s]+$/g, "");
      if (cleanSlug !== existing.slug && RESERVED_SLUGS.has(cleanSlug)) {
        return c.json({ success: false, error: `Slug "${cleanSlug}" is reserved` }, 400);
      }
      updates.slug = cleanSlug;
    }

    const updated = await db
      .update(schema.pages)
      .set(updates)
      .where(eq(schema.pages.id, existing.id))
      .returning();

    return c.json({
      success: true,
      data: updated[0],
      page: updated[0],
    });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return c.json({ success: false, error: "Page slug already exists" }, 409);
    }
    return c.json({ success: false, error: err.message || "Failed to update page" }, 500);
  }
});

// Admin: Delete page
pagesRouter.delete("/:idOrSlug", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const idOrSlug = c.req.param("idOrSlug") || "";
    if (!idOrSlug) {
      return c.json({ success: false, error: "Page slug or ID is required" }, 400);
    }
    const isId = /^\d+$/.test(idOrSlug);

    let existing = null;
    if (isId) {
      existing = await db.query.pages.findFirst({
        where: eq(schema.pages.id, parseInt(idOrSlug, 10)),
      });
    }
    if (!existing) {
      existing = await db.query.pages.findFirst({
        where: eq(schema.pages.slug, idOrSlug),
      });
    }

    if (!existing) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    await db.delete(schema.pages).where(eq(schema.pages.id, existing.id));
    return c.json({ success: true, message: "Page deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete page" }, 500);
  }
});
