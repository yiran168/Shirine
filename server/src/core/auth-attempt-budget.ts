import type { MiddlewareHandler } from "hono";
import type { Env, Variables } from "../types";

/** Separate IP budgets protect password endpoints even when CAPTCHA is disabled. */
export function authAttemptBudget(limit: number, seconds: number): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const now = Math.floor(Date.now() / 1000);
    const input = `${c.env.JWT_SECRET}\0${c.req.path}\0${c.req.header("CF-Connecting-IP") || "local"}`;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    const bucket = `password-auth:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
    try {
      // Reuse the existing expiring request-budget table; each endpoint has its own key.
      const results = await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM oauth_rate_limits WHERE bucket IN (SELECT bucket FROM oauth_rate_limits WHERE expires_at <= ? LIMIT 100)").bind(now),
        c.env.DB.prepare("INSERT INTO oauth_rate_limits (bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END WHERE expires_at<=? OR attempts<?").bind(bucket, now + seconds, now, now, now, limit),
      ]);
      if (!results[1].meta.changes) {
        c.header("Retry-After", String(seconds));
        return c.json({ success: false, error: "尝试次数过多，请稍后再试", code: "AUTH_RATE_LIMITED" }, 429);
      }
    } catch {
      return c.json({ success: false, error: "登录安全服务暂时不可用，请稍后再试" }, 503);
    }
    await next();
  };
}
