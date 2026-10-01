import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createTestEnv } from "../helpers/test-env";
const migration = readFileSync(new URL("../../server/src/db/migrations/20261001-profile-socials.sql", import.meta.url), "utf8");

test("social link migration preserves existing links and respects subsequent removal", async () => {
  const env = createTestEnv();
  const old = { name: "Existing author", bio: "Keep this", links: [{ name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/example" }] };
  await env.d1.prepare("INSERT INTO site_configs (key,value) VALUES ('profile',?)").bind(JSON.stringify(old)).run();
  await env.d1.exec(migration);
  const read = async () => (await env.requestJson("/api/config/site")).data.data.profile;
  const profile = await read();
  expect(profile.name).toBe(old.name);
  expect(profile.bio).toBe(old.bio);
  expect(profile.links[0]).toEqual(old.links[0]);
  expect(profile.links.slice(1).map((link: any) => link.url)).toEqual(["https://www.bilibili.com/", "https://im.qq.com/"]);
  await env.d1.exec(migration);
  expect((await read()).links).toHaveLength(3);
  const admin = await env.createSuperadmin();
  const update = await env.requestJson("/api/config/site", { method: "PUT", headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ profileLinks: [] }) });
  expect(update.status).toBe(200);
  await env.d1.exec(migration);
  expect((await read()).links).toEqual([]);
});

test("configured Bilibili and QQ destinations survive the migration and later editing", async () => {
  const env = createTestEnv();
  const admin = await env.createSuperadmin();
  const links = [{ name: "B 站", icon: "fa6-brands:bilibili", url: "https://space.bilibili.com/12345" }, { name: "QQ", icon: "fa6-brands:qq", url: "https://qm.qq.com/example" }];
  await env.requestJson("/api/config/site", { method: "PUT", headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ profileLinks: links }) });
  await env.d1.exec(migration);
  expect((await env.requestJson("/api/config/site")).data.data.profile.links).toEqual(links);
});
