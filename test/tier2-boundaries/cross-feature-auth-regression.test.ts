import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { TestEnvironment } from "../helpers/test-env";
import { signedMediaUrl } from "../../server/src/core/media-access";

let env: TestEnvironment;
beforeEach(() => { env = new TestEnvironment(); });
afterEach(() => { env.close(); setSystemTime(); });
const json = (body: unknown, cookie = ""): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
const timezone = (zone: string) => env.d1.sqlite.query("INSERT INTO site_configs (key,value) VALUES ('site',?)").run(JSON.stringify({ timeZone: zone }));

test("a valid long registration email remains usable as a login identifier", async () => {
  const email = `${"a".repeat(60)}@example.com`;
  const registration = await env.requestJson("/api/auth/register", json({ username: "long_email", email, password: "password123" }));
  expect(registration.status).toBe(201);
  const login = await env.requestJson("/api/auth/login", json({ username: email.toUpperCase(), password: "password123" }));
  expect(login.status).toBe(200);
  expect(login.data.user.id).toBe(registration.data.user.id);
});

test("media migrations do not rewrite an existing account's password", async () => {
  const password = "/assets/avatars/avatar_1.webp";
  const user = await env.createUser("literal_password", password);
  const login = await env.requestJson("/api/auth/login", json({ username: user.username, password }));
  expect(login.status).toBe(200);
  const change = await env.requestJson("/api/user/profile", { ...json({ oldPassword: password, newPassword: "/assets/avatars/avatar_2.webp" }, user.cookie), method: "PUT" });
  expect(change.status).toBe(200);
  expect((await env.requestJson("/api/auth/login", json({ username: user.username, password: "/assets/avatars/avatar_2.webp" }))).status).toBe(200);
});

test("content passwords remain literal while signed image URLs persist as stable keys", async () => {
  const admin = await env.createSuperadmin();
  const password = "/assets/avatars/avatar_1.webp";
  const image = await signedMediaUrl("uploads/cover.webp", env.env);
  const created = await env.requestJson("/api/posts", json({ title: "Password and media", slug: "literal-secret", content: `![](${image})`, image, password, permissionType: "password" }, admin.cookie));
  expect(created.status).toBe(201);
  const row = env.d1.sqlite.query("SELECT id,password,image,content FROM posts WHERE slug='literal-secret'").get() as any;
  expect(row.password).toBe(password);
  expect(row.image).toBe("/api/blob/uploads/cover.webp");
  expect(row.content).toBe("![](/api/blob/uploads/cover.webp)");
  const unlock = await env.requestJson(`/api/posts/${row.id}/password/verify`, json({ password }));
  expect(unlock.status).toBe(200);
  expect(unlock.data.success).toBe(true);
});

test("check-in, avatar menu and profile use the same configured calendar", async () => {
  setSystemTime(new Date("2026-10-03T10:00:00Z"));
  timezone("Pacific/Kiritimati");
  const user = await env.createUser("timezone_user");
  const checkin = await env.requestJson("/api/user/checkin", json({}, user.cookie));
  expect(checkin.status).toBe(200);
  expect(checkin.data.checkinDate).toBe("2026-10-04");
  const headers = { Cookie: user.cookie };
  expect((await env.requestJson("/api/auth/me", { headers })).data.user.checkedInToday).toBe(true);
  expect((await env.requestJson("/api/user/profile", { headers })).data.user.checkedInToday).toBe(true);
  expect((await env.requestJson("/api/user/checkin", json({}, user.cookie))).status).toBe(400);
  expect(env.d1.sqlite.query("SELECT count(*) AS n FROM point_transactions").get()).toEqual({ n: 1 });
});

test("daylight saving changes do not reset a consecutive check-in streak", async () => {
  setSystemTime(new Date("2026-03-09T04:30:00Z"));
  timezone("America/New_York");
  const user = await env.createUser("dst_user");
  env.d1.sqlite.query("UPDATE users SET last_checkin_date='2026-03-08', checkin_streak=5 WHERE id=?").run(user.id);
  const checkin = await env.requestJson("/api/user/checkin", json({}, user.cookie));
  expect(checkin.status).toBe(200);
  expect(checkin.data.checkinDate).toBe("2026-03-09");
  expect(checkin.data.checkinStreak).toBe(6);
});

test("invalid legacy site timezones fall back without breaking profiles or check-in", async () => {
  timezone("invalid/zone");
  const user = await env.createUser("legacy_timezone");
  expect((await env.requestJson("/api/user/checkin", json({}, user.cookie))).status).toBe(200);
  for (const endpoint of ["/api/auth/me", "/api/user/profile"]) {
    const result = await env.requestJson(endpoint, { headers: { Cookie: user.cookie } });
    expect(result.status).toBe(200);
    expect(result.data.user.checkedInToday).toBe(true);
  }
});
