import { describe, it, expect } from "bun:test";
import { createTestEnv } from "./helpers/test-env";

describe("Smoke Test", () => {
  it("initializes test environment and handles health check", async () => {
    const env = createTestEnv();
    const res = await env.requestJson("/api/health");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("ok");
    expect(res.data.service).toBe("Shirine API");
    env.close();
  });
});
