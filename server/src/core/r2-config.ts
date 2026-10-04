import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { getDb, schema } from "../db";
import { sanitizeR2Url } from "../utils/url";

export const LEGACY_R2_ORIGIN = "https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev";

/**
 * Resolves the public R2 access base URL.
 * Priority: D1 site_configs (publicR2Url / site.publicR2Url) -> D1 system_configs -> c.env.PUBLIC_R2_URL -> default fallback.
 */
export async function getPublicR2Url(env: Env): Promise<string> {
  const fallback = (env.PUBLIC_R2_URL || LEGACY_R2_ORIGIN).trim().replace(/\/+$/, "");

  try {
    if (env.DB) {
      const db = getDb(env.DB);
      // 1. Try D1 site_configs (key 'publicR2Url')
      const r2Row = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "publicR2Url"),
      });
      if (r2Row && r2Row.value !== undefined && r2Row.value !== null) {
        let val: any = r2Row.value;
        try {
          const parsed = JSON.parse(r2Row.value);
          val = typeof parsed === "string" ? parsed : (parsed?.url || parsed?.publicR2Url || r2Row.value);
        } catch {}
        if (typeof val === "string") {
          const sanitized = sanitizeR2Url(val);
          if (sanitized.length > 0) {
            return sanitized;
          }
          // Explicitly cleared or invalid -> immediately return fallback
          return fallback;
        }
      }

      // 2. Try D1 site_configs (key 'site')
      const siteRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      if (siteRow && siteRow.value) {
        try {
          const parsed = JSON.parse(siteRow.value);
          if (parsed && typeof parsed.publicR2Url === "string") {
            const sanitized = sanitizeR2Url(parsed.publicR2Url);
            if (sanitized.length > 0) {
              return sanitized;
            }
          }
        } catch {}
      }

      // 3. Try D1 system_configs (key 'publicR2Url')
      const sysRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "publicR2Url"),
      });
      if (sysRow && sysRow.value !== undefined && sysRow.value !== null) {
        let val: any = sysRow.value;
        try {
          const parsed = JSON.parse(sysRow.value);
          val = typeof parsed === "string" ? parsed : (parsed?.url || parsed?.publicR2Url || sysRow.value);
        } catch {}
        if (typeof val === "string") {
          const sanitized = sanitizeR2Url(val);
          if (sanitized.length > 0) {
            return sanitized;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to query custom publicR2Url from DB:", err);
  }

  return fallback;
}
