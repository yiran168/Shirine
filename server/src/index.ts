import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import type { Env, Variables } from "./types";
import { authMiddleware } from "./core/middleware";
import { handleBlobStream } from "./core/blob-handler";
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
    allowHeaders: ["Content-Type", "Authorization", "X-Post-Grant"],
    credentials: true,
  })
);

// Global Request Body Size Limit (10MB for uploads, protected against DoS: V10-P0-24)
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 10 * 1024 * 1024,
    onError: (c) => c.json({ success: false, error: "Payload Too Large: Request body exceeds maximum allowed size" }, 413),
  })
);

// Unified Configuration & Environment Guard (V10 Item 16)
app.use("/api/*", async (c, next) => {
  if (!c.env.JWT_SECRET) {
    if (c.env.ENVIRONMENT === "production") {
      console.error("[CRITICAL] JWT_SECRET environment secret is not configured in production!");
      return c.json(
        { success: false, error: "Server configuration error: JWT_SECRET secret must be configured" },
        500
      );
    } else {
      (c.env as any).JWT_SECRET = "shirine-dev-local-jwt-secret-key-32bytes-min";
    }
  }
  await next();
});

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
app.get("/api/blob/*", (c) => handleBlobStream(c));

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
