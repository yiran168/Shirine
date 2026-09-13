import type { Context, Next } from "hono";
import type { Env, Variables } from "../types";
import { verifyToken } from "./auth";

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

  if (token) {
    const user = await verifyToken(token, c.env.JWT_SECRET);
    if (user) {
      c.set("user", user);
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
  if (user.role !== "superadmin") {
    return c.json({ success: false, error: "Forbidden: Superadmin access required" }, 403);
  }
  await next();
}
