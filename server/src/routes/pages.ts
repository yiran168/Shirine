import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const pagesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// List all public pages
pagesRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const db = getDb(c.env.DB);

    const allPages = await db.query.pages.findMany({
      where: !user || user.role !== "superadmin" ? eq(schema.pages.draft, 0) : undefined,
      orderBy: [desc(schema.pages.createdAt)],
    });

    return c.json({ success: true, data: allPages });
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

    const page = await db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
    });

    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    if (page.draft === 1 && (!user || user.role !== "superadmin")) {
      return c.json({ success: false, error: "Page not published" }, 404);
    }

    return c.json({ success: true, page });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch page" }, 500);
  }
});

// Admin: Create page
pagesRouter.post("/", requireAdmin, async (c) => {
  try {
    const user = c.get("user")!;
    const db = getDb(c.env.DB);
    const body = await c.req.json();
    const { slug, title, content, draft = false } = body;

    if (!slug || !title || !content) {
      return c.json({ success: false, error: "Slug, title, and content are required" }, 400);
    }

    const inserted = await db
      .insert(schema.pages)
      .values({
        slug: slug.trim(),
        title: title.trim(),
        content,
        draft: draft ? 1 : 0,
        uid: user.id,
      })
      .returning();

    return c.json({ success: true, page: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to create page" }, 500);
  }
});

// Admin: Update page
pagesRouter.put("/:slug", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const slug = c.req.param("slug");
    const body = await c.req.json();

    const updates: Partial<typeof schema.pages.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.content !== undefined) updates.content = body.content;
    if (body.draft !== undefined) updates.draft = body.draft ? 1 : 0;
    if (body.newSlug !== undefined) updates.slug = body.newSlug.trim();

    const updated = await db.update(schema.pages).set(updates).where(eq(schema.pages.slug, slug)).returning();
    return c.json({ success: true, page: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to update page" }, 500);
  }
});

// Admin: Delete page
pagesRouter.delete("/:id", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.pages).where(eq(schema.pages.id, id));
    return c.json({ success: true, message: "Page deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete page" }, 500);
  }
});
