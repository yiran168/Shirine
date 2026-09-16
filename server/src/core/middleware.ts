import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { verifyToken } from "./auth";
import { getDb, schema } from "../db";

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");
  const cookieHeader = c.req.header("Cookie") || "";
  let bearerToken: string | undefined;
  let cookieToken: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.substring(7);
  }
  const match = cookieHeader.match(/shirine_token=([^;]+)/);
  if (match) {
    cookieToken = match[1];
  }

  const candidateTokens: Array<{ token: string; source: "bearer" | "cookie" }> = [];
  if (bearerToken) candidateTokens.push({ token: bearerToken, source: "bearer" });
  if (cookieToken && cookieToken !== bearerToken) candidateTokens.push({ token: cookieToken, source: "cookie" });

  let authenticatedSource: "bearer" | "cookie" | null = null;

  if (c.env.DB && candidateTokens.length > 0) {
    const db = getDb(c.env.DB);
    for (const item of candidateTokens) {
      const payload = await verifyToken(item.token, c.env.JWT_SECRET);
      if (!payload) continue;

      try {
        const dbUser = await db.query.users.findFirst({
          where: eq(schema.users.id, payload.id),
          columns: {
            id: true,
            username: true,
            role: true,
            status: true,
            sessionVersion: true,
          },
        });

        // Strict session version check: sessionVersion must be defined and match DB
        if (
          dbUser &&
          dbUser.status === "active" &&
          payload.sessionVersion !== undefined &&
          dbUser.sessionVersion === payload.sessionVersion
        ) {
          if (payload.jti) {
            const isRevoked = await db.query.revokedTokens.findFirst({
              where: eq(schema.revokedTokens.jti, payload.jti),
            });
            if (isRevoked) {
              continue;
            }
          }
          c.set("user", {
            id: dbUser.id,
            username: dbUser.username,
            role: dbUser.role as "superadmin" | "admin" | "user",
            sessionVersion: dbUser.sessionVersion,
            jti: payload.jti,
          });
          authenticatedSource = item.source;
          break;
        }
      } catch (err) {
        console.error("Auth middleware DB verification failed:", err);
      }
    }
  }

  // CSRF Protection for Cookie-authenticated mutating requests
  if (authenticatedSource === "cookie" && ["POST", "PUT", "DELETE", "PATCH"].includes(c.req.method.toUpperCase())) {
    const origin = c.req.header("Origin") || c.req.header("Referer");
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const reqUrl = new URL(c.req.url);
        const isSameHost = originUrl.host === reqUrl.host;
        const isLocal = reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1";
        const allowedOrigins = c.env.ALLOWED_ORIGINS
          ? c.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
          : [];
        const isAllowed = isSameHost || isLocal || allowedOrigins.includes(originUrl.origin);
        if (!isAllowed) {
          return c.json({ success: false, error: "Forbidden: CSRF check failed" }, 403);
        }
      } catch {
        return c.json({ success: false, error: "Forbidden: Invalid origin header" }, 403);
      }
    }
  }

  await next();
}

export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, error: "Unauthorized: Please log in" }, 401);
  }
  await next();
}

export async function requireAdmin(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, error: "Unauthorized: Please log in" }, 401);
  }
  if (user.role !== "superadmin" && user.role !== "admin") {
    return c.json({ success: false, error: "Forbidden: Admin access required" }, 403);
  }
  await next();
}
