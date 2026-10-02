import { afterEach, beforeEach, expect, test, spyOn } from "bun:test";
import { TestEnvironment } from "../helpers/test-env";
import { ALL as proxy } from "../../client/src/pages/api/[...path]";
import app from "../../server/src/index";
import { signAlbumGrant } from "../../server/src/core/auth";

let env: TestEnvironment;
beforeEach(() => { env = new TestEnvironment(); });
afterEach(() => env.close());

test("password verification cannot expose photos of a points or login album", async () => {
  for (const permissionType of ["points_required", "login_required"]) {
    const album = await env.createAlbum({ permissionType, requiredPoints: 20, photos: [{ url: "https://example.com/private.jpg" }] });
    const res = await env.requestJson(`/api/albums/${album.id}/password/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(res.data.photos ?? []).toHaveLength(0);
    expect(res.data.isUnlocked).not.toBe(true);
  }
});

test("a password grant does not replace a required points purchase", async () => {
  const user = await env.createUser("mixed", undefined, 40);
  const album = await env.createAlbum({ permissionType: "points_required", requiredPoints: 20, password: "secret", photos: [{ url: "https://example.com/private.jpg" }] });
  const verified = await env.requestJson(`/api/albums/${album.id}/password/verify`, { method: "POST", headers: { Cookie: user.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ password: "secret" }) });
  expect(verified.data.photos ?? []).toHaveLength(0);
  const cookie = `${user.cookie}; shirine_album_grant_${album.id}=${verified.data.grant}`;
  const detail = await env.requestJson(`/api/albums/${album.id}`, { headers: { Cookie: cookie } });
  expect(detail.data.data.isUnlocked).toBe(false);
  expect(detail.data.data.lockReason).toBe("points_required");
  expect(detail.data.data.photos).toHaveLength(0);
  const purchase = await env.requestJson(`/api/albums/${album.id}/unlock`, { method: "POST", headers: { Cookie: cookie } });
  expect(purchase.data.success).toBe(true);
  expect(purchase.data.photos).toHaveLength(1);
  const noGrant = await env.requestJson(`/api/albums/${album.id}/unlock`, { method: "POST", headers: { Cookie: user.cookie } });
  expect(noGrant.status).toBe(403);
  expect(noGrant.data.photos ?? []).toHaveLength(0);
});

test("insufficient album balance leaves no ledger entry and can be retried after earning points", async () => {
  const user = await env.createUser("poor", undefined, 0);
  const album = await env.createAlbum({ permissionType: "points_required", requiredPoints: 10 });
  const buy = () => env.requestJson(`/api/albums/${album.id}/unlock`, { method: "POST", headers: { Cookie: user.cookie } });
  expect((await buy()).status).toBe(400);
  expect(env.d1.sqlite.query("SELECT count(*) AS n FROM point_transactions").get()).toEqual({ n: 0 });
  env.d1.sqlite.query("UPDATE users SET points = 20 WHERE id = ?").run(user.id);
  expect((await buy()).data.success).toBe(true);
});

test("service bindings preserve the public origin for legitimate cookie requests", async () => {
  const user = await env.createUser("binding");
  const response = await proxy({ request: new Request("https://blog.example/api/user/checkin", { method: "POST", headers: { Cookie: user.cookie, Origin: "https://blog.example" } }), params: { path: "user/checkin" }, locals: { runtime: { env: { SHIRINE_SERVER: { fetch: (url: string, init: RequestInit) => app.fetch(new Request(url, init), env.env) } } } } } as any);
  expect(response.status).toBe(200);
});

test("cookie authentication rejects lookalike names, cross-scheme and foreign loopback origins", async () => {
  const user = await env.createUser("csrf");
  expect((await env.request("/api/auth/me", { headers: { Cookie: `evil_${user.cookie}` } })).status).toBe(401);
  for (const [url, origin] of [["https://blog.example/api/user/checkin", "http://blog.example"], ["http://localhost/api/user/checkin", "https://attacker.example"]]) {
    expect((await env.request(url, { method: "POST", headers: { Cookie: user.cookie, Origin: origin } })).status).toBe(403);
  }
});

test("logout reports revocation failures without falsely clearing the session", async () => {
  const user = await env.createUser("logout_failure");
  env.d1.sqlite.exec("CREATE TRIGGER fail_revoke BEFORE INSERT ON revoked_tokens BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;");
  const res = await env.requestJson("/api/auth/logout", { method: "POST", headers: { Cookie: user.cookie } });
  expect(res.status).toBe(503);
  expect(res.data.success).toBe(false);
  expect(res.headers.get("Set-Cookie")).toBeNull();
});

test("audio upload supports files larger than 10 MiB and rejects forged signatures", async () => {
  const admin = await env.createSuperadmin();
  const upload = async (bytes: Uint8Array, type: string) => {
    const body = new FormData();
    body.append("file", new File([bytes], "test.mp3", { type }));
    return env.requestJson("/api/upload", { method: "POST", headers: { Cookie: admin.cookie }, body });
  };
  expect((await upload(new TextEncoder().encode("not an audio file at all"), "audio/mpeg")).status).toBe(400);
  const bytes = new Uint8Array(11 * 1024 * 1024);
  bytes.set([0x49, 0x44, 0x33, 4]);
  const res = await upload(bytes, "audio/mpeg");
  expect(res.status).toBe(200);
  expect(res.data.size).toBe(bytes.length);
});

test("concurrent admin adjustments retain both deltas and accurate balances", async () => {
  const admin = await env.createSuperadmin();
  const user = await env.createUser("adjust", undefined, 10);
  const batch = env.d1.batch.bind(env.d1);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  env.d1.batch = async statements => {
    if (++arrivals === 2) release();
    await gate;
    return batch(statements);
  };
  const adjust = (amount: number) => env.requestJson(`/api/admin/users/${user.id}/points`, { method: "PUT", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
  const results = await Promise.all([adjust(5), adjust(7)]);
  expect(results.every(r => r.data.success)).toBe(true);
  expect(env.d1.sqlite.query("SELECT points FROM users WHERE id = ?").get(user.id)).toEqual({ points: 22 });
  expect(env.d1.sqlite.query("SELECT sum(amount) AS delta FROM point_transactions WHERE user_id = ?").get(user.id)).toEqual({ delta: 12 });
});

test("password verification cannot expose protected article content", async () => {
  for (const permissionType of ["points_required", "login_required"]) {
    const post = await env.createPost({ permissionType, requiredPoints: 20, content: "protected article secret" });
    const res = await env.requestJson(`/api/posts/${post.id}/password/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(res.data.content).toBeNull();
    expect(res.data.isUnlocked).toBe(false);
  }
});

test("registration treats case variants as one username even during concurrent requests", async () => {
  let registrationIndex = 0;
  const register = (username: string) => env.requestJson("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email: `case-${++registrationIndex}@example.com`, password: "password123" }) });
  const res = await Promise.all([register("CaseName"), register("casename")]);
  expect(res.filter(r => r.status === 201)).toHaveLength(1);
  expect(res.filter(r => r.status === 400)).toHaveLength(1);
});

test("profile changes enforce the same password length as login", async () => {
  const user = await env.createUser("password_max");
  const res = await env.requestJson("/api/user/profile", { method: "PUT", headers: { Cookie: user.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ oldPassword: "userpassword123", newPassword: "x".repeat(129) }) });
  expect(res.status).toBe(400);
});

test("check-in uses the committed balance when another adjustment precedes its batch", async () => {
  const user = await env.createUser("checkin_race", undefined, 10);
  const batch = env.d1.batch.bind(env.d1);
  env.d1.batch = async statements => {
    env.d1.sqlite.query("UPDATE users SET points = points + 7 WHERE id = ?").run(user.id);
    return batch(statements);
  };
  const res = await env.requestJson("/api/user/checkin", { method: "POST", headers: { Cookie: user.cookie } });
  expect(res.data.currentPoints).toBe(27);
  expect(env.d1.sqlite.query("SELECT balance_after FROM point_transactions WHERE type = 'checkin'").get()).toEqual({ balance_after: 27 });
});

test("password grants do not bypass login requirements on R2 album objects", async () => {
  const album = await env.createAlbum({ permissionType: "login_required", password: "secret", photos: [{ url: "/api/blob/private.jpg" }] });
  await env.storage.put("private.jpg", "private bytes");
  const grant = await signAlbumGrant(album.id, 1, null, env.jwtSecret);
  const res = await env.requestMedia("/api/blob/private.jpg", { headers: { Cookie: `shirine_album_grant_${album.id}=${grant}` } });
  expect(res.status).toBe(401);
});

test("failed album replacement preserves its metadata and previous photos", async () => {
  const admin = await env.createSuperadmin();
  const album = await env.createAlbum({ title: "Original", photos: [{ url: "https://example.com/original.jpg" }] });
  env.d1.sqlite.exec("CREATE TRIGGER fail_photo BEFORE INSERT ON album_photos WHEN NEW.url LIKE '%failure%' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;");
  const res = await env.requestJson(`/api/albums/${album.id}`, { method: "PUT", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Changed", photos: [{ url: "https://example.com/failure.jpg" }] }) });
  expect(res.status).toBe(500);
  expect(env.d1.sqlite.query("SELECT title FROM albums WHERE id = ?").get(album.id)).toEqual({ title: "Original" });
  expect(env.d1.sqlite.query("SELECT url FROM album_photos WHERE album_id = ?").all(album.id)).toEqual([{ url: "https://example.com/original.jpg" }]);
});

test("failed album creation leaves neither a partial album nor orphaned photos", async () => {
  const admin = await env.createSuperadmin();
  env.d1.sqlite.exec("CREATE TRIGGER fail_photo BEFORE INSERT ON album_photos WHEN NEW.url LIKE '%failure%' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;");
  const res = await env.requestJson("/api/albums", { method: "POST", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Atomic new album", photos: ["https://example.com/first.jpg", "https://example.com/failure.jpg"] }) });
  expect(res.status).toBe(500);
  expect(env.d1.sqlite.query("SELECT count(*) AS n FROM albums").get()).toEqual({ n: 0 });
  expect(env.d1.sqlite.query("SELECT count(*) AS n FROM album_photos").get()).toEqual({ n: 0 });
});

test("media library can reach files beyond its first R2 page without exposing bucket URLs", async () => {
  const admin = await env.createSuperadmin();
  for (let i = 0; i < 105; i++) await env.storage.put(`uploads/${String(i).padStart(3, '0')}.webp`, "test");
  const first = await env.requestJson("/api/upload", { headers: { Cookie: admin.cookie } });
  expect(first.data.objects).toHaveLength(100);
  expect(first.data.cursor).toBeTruthy();
  expect(first.data.objects[0].url).toStartWith("/api/blob/");
  const next = await env.requestJson(`/api/upload?cursor=${first.data.cursor}`, { headers: { Cookie: admin.cookie } });
  expect(next.data.objects).toHaveLength(5);
  expect(next.data.cursor).toBeNull();
  expect(new Set([...first.data.objects, ...next.data.objects].map(x => x.key)).size).toBe(105);
});

test("initial setup cannot create two superadmins from a stale setup marker", async () => {
  env.d1.sqlite.exec("INSERT INTO setup_state (id, completed) VALUES (1, 0)");
  const setup = (username: string) => env.requestJson("/api/auth/setup/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: "password123" }) });
  const res = await Promise.all([setup("initial_one"), setup("initial_two")]);
  expect(res.filter(r => r.data.success)).toHaveLength(1);
  expect(env.d1.sqlite.query("SELECT count(*) AS n FROM users WHERE role = 'superadmin'").get()).toEqual({ n: 1 });
});

test("AI requests use the saved secret when the form sends a masked placeholder", async () => {
  const admin = await env.createSuperadmin();
  env.d1.sqlite.query("INSERT INTO system_configs (key, value) VALUES ('ai_config', ?)").run(JSON.stringify({ apiUrl: "https://ai.example/v1", apiKey: "test-saved-secret" }));
  const fetchMock = spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-saved-secret");
    return Response.json({ data: [{ id: "model" }], choices: [{ message: { content: "hello" } }] });
  });
  try {
    for (const route of ["models", "generate"]) {
      const res = await env.requestJson(`/api/admin/ai/${route}`, { method: "POST", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: "••••••••", prompt: "hello" }) });
      expect(res.data.success).toBe(true);
    }
  } finally { fetchMock.mockRestore(); }
});

test("friend management accepts signed local media while public applications reject malformed descriptions", async () => {
  const admin = await env.createSuperadmin();
  const body = { name: "Friend", avatar: "/api/blob/uploads/avatar.webp", url: "https://friend.example" };
  expect((await env.requestJson("/api/friends", { method: "POST", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })).data.success).toBe(true);
  expect((await env.requestJson("/api/friends/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, avatar: "https://example.com/avatar.webp", desc: {} }) })).status).toBe(400);
});

test("production cannot authenticate with a publicly known development key", async () => {
  env.env.JWT_SECRET = "dev_fallback_jwt_secret_please_set_in_wrangler_secrets";
  expect((await env.request("https://blog.example/api/health")).status).toBe(500);
});

test("deployment JSONC parsing preserves URLs and comment-like string values", async () => {
  const { stripJsonCommentsAndTrailingCommas } = await import("../../scripts/deploy");
  const source = '{"url":"https://example.com/path", "text":"/*value*/,}", // comment\n "items":[1,2,],}';
  expect(JSON.parse(stripJsonCommentsAndTrailingCommas(source))).toEqual({ url: "https://example.com/path", text: "/*value*/,}", items: [1, 2] });
});

test("failed settings reads never return editable defaults as a successful admin load", async () => {
  const admin = await env.createSuperadmin();
  env.d1.sqlite.exec("DROP TABLE system_configs; DROP TABLE site_configs;");
  for (const path of ["/api/config/site", "/api/config/system/admin"]) {
    const result = await env.requestJson(path, { headers: { Cookie: admin.cookie } });
    expect(result.status).toBe(503);
    expect(result.data.success).toBe(false);
    expect(result.data.data).toBeUndefined();
  }
});
