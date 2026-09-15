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
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // Look for shirine_token in cookies
    const match = cookieHeader.match(/shirine_token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (token && c.env.DB) {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (payload) {
      try {
        const db = getDb(c.env.DB);
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

        // Ensure user exists, is active, and session version matches
        if (
          dbUser &&
          dbUser.status === "active" &&
          (payload.sessionVersion === undefined || dbUser.sessionVersion === payload.sessionVersion)
        ) {
          c.set("user", {
            id: dbUser.id,
            username: dbUser.username,
            role: dbUser.role as "superadmin" | "admin" | "user",
            sessionVersion: dbUser.sessionVersion,
          });
        }
      } catch (err) {
        console.error("Auth middleware DB verification failed:", err);
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
