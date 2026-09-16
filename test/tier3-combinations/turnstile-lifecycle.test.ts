import { describe, it, expect } from "bun:test";
import { createTestEnv } from "../helpers/test-env";
import { schema } from "../../server/src/db";
import { eq } from "drizzle-orm";

describe("Tier 3 - Combination: Turnstile Human Verification Lifecycle", () => {
  it("Smoothly toggles Turnstile validation and prioritizes environment secrets", async () => {
    const env = createTestEnv({
      turnstileSecret: "1x0000000000000000000000000000000AA",
    });

    // Phase 1: Turnstile not enabled -> Registration succeeds without token
    const reg1 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_phase1_user",
        password: "password123",
      }),
    });
    expect(reg1.status).toBe(201);
    expect(reg1.data.success).toBe(true);

    // Phase 2: Enable Turnstile via system configs
    await env.db.insert(schema.systemConfigs).values({
      key: "turnstile",
      value: JSON.stringify({
        enabled: true,
        siteKey: "0x4AAAAAAtestsitekey",
        secretKey: "db_fallback_secret",
      }),
    });

    // Attempting registration without token now fails
    const reg2 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_phase2_user",
        password: "password123",
      }),
    });
    expect(reg2.status).toBe(400);
    expect(reg2.data.error).toContain("Turnstile");

    // Phase 3: Disable Turnstile again
    await env.db
      .update(schema.systemConfigs)
      .set({
        value: JSON.stringify({
          enabled: false,
          siteKey: "0x4AAAAAAtestsitekey",
        }),
      })
      .where(eq(schema.systemConfigs.key, "turnstile"));

    // Registration succeeds once more without token
    const reg3 = await env.requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "turnstile_phase3_user",
        password: "password123",
      }),
    });
    expect(reg3.status).toBe(201);
    expect(reg3.data.success).toBe(true);

    env.close();
  });
});
