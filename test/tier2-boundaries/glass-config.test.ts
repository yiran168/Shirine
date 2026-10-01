import { expect, test } from "bun:test";
import { createTestEnv } from "../helpers/test-env";

test("glass styles survive saving, unrelated edits, and public reads", async () => {
  const env = createTestEnv();
  const admin = await env.createSuperadmin();
  const headers = { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" };
  for (const mode of ["subtle", "vibrant", "crystal", "none"]) {
    const saved = await env.requestJson("/api/config/site", { method: "PUT", headers, body: JSON.stringify({ liquidGlassMode: mode }) });
    expect(saved.status).toBe(200);
    await env.requestJson("/api/config/site", { method: "PUT", headers, body: JSON.stringify({ subtitle: "Glass regression" }) });
    const read = await env.requestJson("/api/config/site");
    expect(read.data.data.liquidGlassMode).toBe(mode);
    expect(read.data.config.liquidGlassMode).toBe(mode);
  }
  const rejected = await env.requestJson("/api/config/site", { method: "PUT", headers, body: JSON.stringify({ liquidGlassMode: "invalid" }) });
  expect(rejected.status).toBe(400);
  expect((await env.requestJson("/api/config/site")).data.data.liquidGlassMode).toBe("none");
});
