import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import type { Env, Variables } from "./types";
import { authMiddleware, requireAdmin } from "./core/middleware";
import { handleBlobStream } from "./core/blob-handler";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { postsRouter } from "./routes/posts";
import { albumsRouter } from "./routes/albums";
import { momentsRouter } from "./routes/moments";
import { pagesRouter } from "./routes/pages";
import { friendsRouter } from "./routes/friends";
import { trimTrailingSlash } from "hono/trailing-slash";
import { configRouter } from "./routes/config";
import { adminRouter } from "./routes/admin";
import { uploadRouter, getPublicR2Url } from "./routes/upload";
import { protectMediaUrls, canonicalizeMediaInput, verifyMediaSignature, signedMediaUrl } from "./core/media-access";
import { musicRouter } from "./routes/music";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global Middlewares
app.use(trimTrailingSlash());
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

// Unified Configuration & Environment Guard (V10 Item 16)
app.use("/api/*", async (c, next) => {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET === "dev_fallback_jwt_secret_please_set_in_wrangler_secrets" || c.env.JWT_SECRET === "shirine-dev-local-jwt-secret-key-32bytes-min") {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname);
    if (c.env.ENVIRONMENT === "production" || !local) {
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

// Only authenticated administrators may submit the larger multipart upload body.
app.use("/api/*", async (c, next) => {
  const upload = c.req.method === "POST" && c.req.path === "/api/upload";
  const limit = bodyLimit({
    maxSize: upload ? 51 * 1024 * 1024 : 10 * 1024 * 1024,
    onError: c => c.json({ success: false, error: "Payload Too Large" }, 413),
  });
  if (upload) return requireAdmin(c, async () => {
    const response = await limit(c, next);
    if (response instanceof Response) c.res = response;
  });
  return limit(c, next);
});


app.use("/api/*", async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method) && c.req.header("Content-Type")?.includes("application/json")) {
    const readJson = c.req.json.bind(c.req);
    c.req.json = async () => canonicalizeMediaInput(await readJson());
  }
  await next();
  if (!c.res.headers.get("content-type")?.includes("application/json")) return;
  c.header("Cache-Control", "private, no-store");
  const body = await c.res.clone().text();
  if (!body.includes("http") && !body.includes("/api/blob/") && !body.includes("/api/upload/blob/") && !body.includes("avatar_")) return;
  const base = await getPublicR2Url(c.env);
  const user = c.get("user");
  const data = await protectMediaUrls(JSON.parse(body), [base, c.env.PUBLIC_R2_URL || "", "https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev"], c.env, user?.role === "admin" || user?.role === "superadmin");
  c.res = new Response(JSON.stringify(data), { status: c.res.status, headers: c.res.headers });
});

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
app.route("/api/music", musicRouter);
// Renew images on long-open pages. The signature is only a hotlink guard;
// handleBlobStream rechecks the user's permissions before reading any object.
app.post("/api/media/refresh", async c => {
  if (c.req.header("Sec-Fetch-Site") !== "same-origin") return c.json({ success: false }, 403);
  const url = new URL(c.req.query("url") || "/", "https://media.invalid");
  if (!url.pathname.startsWith("/api/blob/")) return c.json({ success: false }, 400);
  const key = decodeURIComponent(url.pathname.slice("/api/blob/".length));
  if (!await verifyMediaSignature(key, url, c.env, true)) return c.json({ success: false }, 403);
  return c.json({ success: true, url: await signedMediaUrl(key, c.env) });
});
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
