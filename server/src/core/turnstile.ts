import type { Context } from "hono";
import type { Env } from "../types";
import { getDb, schema } from "../db";
import { eq } from "drizzle-orm";

export async function verifyTurnstile(
  c: Context<any>,
  token?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const db = getDb(c.env.DB);
    // Fetch system configs
    const configRow = await db.query.systemConfigs.findFirst({
      where: eq(schema.systemConfigs.key, "turnstile"),
    });

    if (!configRow) {
      // Turnstile not configured, bypass
      return { success: true };
    }

    const config = JSON.parse(configRow.value);
    if (!config.enabled) {
      // Turnstile disabled by admin, bypass
      return { success: true };
    }

    if (!token) {
      return { success: false, message: "Turnstile verification token is required" };
    }

    const secretKey = config.secretKey;
    if (!secretKey) {
      // Secret key not configured, bypass or pass
      return { success: true };
    }

    const clientIp = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";

    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const outcome = (await verifyRes.json()) as { success: boolean; "error-codes"?: string[] };
    if (outcome.success) {
      return { success: true };
    }

    return {
      success: false,
      message: `Turnstile verification failed: ${outcome["error-codes"]?.join(", ") || "invalid token"}`,
    };
  } catch (err: any) {
    console.error("Turnstile verification error:", err);
    return { success: false, message: "Turnstile verification server error" };
  }
}
