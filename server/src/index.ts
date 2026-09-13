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

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Set-Cookie"],
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
app.route("/api", uploadRouter); // for /api/blob/*

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
