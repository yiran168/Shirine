import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env, Variables } from "./types";
import { authMiddleware } from "./core/middleware";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { postsRouter } from "./routes/posts";
import { albumsRouter } from "./routes/albums";
import { momentsRouter } from "./routes/moments";
import { pagesRouter } from "./routes/pages";
import { friendsRouter } from "./routes/friends";
import { configRouter } from "./routes/config";
import { adminRouter } from "./routes/admin";
import { uploadRouter } from "./routes/upload";

import { getDb, schema } from "./db";
import { and, eq, like } from "drizzle-orm";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return "*";
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1" || originUrl.hostname === "::1") {
          return origin;
        }
        const allowed = c.env.ALLOWED_ORIGINS
          ? c.env.ALLOWED_ORIGINS.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
        if (allowed.length > 0 && allowed.includes(origin)) {
          return origin;
        }
      } catch {}
      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Post-Password", "X-Post-Grant"],
    credentials: true,
  })
);

// Global JWT Extraction Middleware
app.use("/api/*", authMiddleware);

// Health Check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    service: "Shirine API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.route("/api/auth", authRouter);
app.route("/api/user", userRouter);
app.route("/api/posts", postsRouter);
app.route("/api/albums", albumsRouter);
app.route("/api/moments", momentsRouter);
app.route("/api/pages", pagesRouter);
app.route("/api/friends", friendsRouter);
app.route("/api/config", configRouter);
app.route("/api/admin", adminRouter);
app.route("/api/upload", uploadRouter);
app.get("/api/blob/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/blob\/?/, "");
  if (!key) return c.text("Key is required", 400);
  if (!c.env.STORAGE) return c.text("Storage bucket not bound", 404);
  const decodedKey = decodeURIComponent(key);
  const object = await c.env.STORAGE.get(decodedKey);
  if (!object) return c.text("Object not found", 404);

  // Check if this object belongs to a protected album (V8-P0-19)
  let isProtected = false;
  if (c.env.DB) {
    try {
      const db = getDb(c.env.DB);
      const photoMatch = await db.query.albumPhotos.findFirst({
        where: like(schema.albumPhotos.url, `%${decodedKey}%`),
      });
      if (photoMatch) {
        const album = await db.query.albums.findFirst({
          where: eq(schema.albums.id, photoMatch.albumId),
        });
        if (album && (album.draft === 1 || album.permissionType !== "public")) {
          isProtected = true;
          const user = c.get("user");
          const isAdmin = user && (user.role === "superadmin" || user.role === "admin");
          const isAuthor = user && album.uid && user.id === album.uid;
          if (!isAdmin && !isAuthor) {
            if (!user) {
              return c.text("Unauthorized: Authentication required to access protected media", 401);
            }
            if (album.draft === 1) {
              return c.text("Forbidden: Draft album media is unpublished", 403);
            }
            if (album.permissionType === "points_required") {
              const unlock = await db.query.albumUnlocks.findFirst({
                where: and(
                  eq(schema.albumUnlocks.userId, user.id),
                  eq(schema.albumUnlocks.albumId, album.id)
                ),
              });
              if (!unlock) {
                return c.text("Forbidden: Album must be unlocked before accessing media", 403);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Blob authorization check failed:", err);
    }
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  const contentType = headers.get("content-type") || "";
  if (contentType.includes("svg") || contentType.includes("html") || contentType.includes("xml")) {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    headers.set("Content-Disposition", "attachment");
  }

  if (isProtected) {
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  } else {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return new Response(object.body, { headers });
});

// 404 Handler
app.notFound((c) => {
  return c.json({ success: false, error: "Endpoint not found" }, 404);
});

// Error Handler
app.onError((err, c) => {
  console.error("Server uncaught exception:", err);
  return c.json(
    {
      success: false,
      error: err.message || "Internal Server Error",
    },
    500
  );
});

export default app;
