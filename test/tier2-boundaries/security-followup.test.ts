import { afterEach, beforeEach, expect, test } from "bun:test";
import { TestEnvironment } from "../helpers/test-env";
import { signedMediaUrl } from "../../server/src/core/media-access";
import { schema } from "../../server/src/db";

let env: TestEnvironment;
beforeEach(() => { env = new TestEnvironment(); });
afterEach(() => env.close());
const json = (body: unknown, cookie = ""): RequestInit => ({method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});

test("legacy password-only posts without a password deny both content and R2 media", async () => {
  const key = "uploads/legacy-private.webp";
  await env.storage.put(key, new Uint8Array([1,2,3]));
  const post = await env.createPost({permissionType:"password",password:"",encrypted:0,content:"PRIVATE BODY",image:`/api/blob/${key}`});
  const detail = await env.requestJson(`/api/posts/${post.id}`);
  expect(JSON.stringify(detail.data)).not.toContain("PRIVATE BODY");
  const list = await env.requestJson("/api/posts");
  expect(JSON.stringify(list.data)).not.toContain("PRIVATE BODY");
  const verify = await env.requestJson(`/api/posts/${post.id}/password/verify`, json({}));
  expect(JSON.stringify(verify.data)).not.toContain("PRIVATE BODY");
  const media = await env.request(await signedMediaUrl(key, env.env));
  expect(media.status).toBe(403);
});

test("saving password protection without a usable password is rejected without changing public data", async () => {
  const admin = await env.createSuperadmin();
  expect((await env.requestJson("/api/posts", json({slug:"empty-password",title:"Empty password",content:"body",permissionType:"password"},admin.cookie))).status).toBe(400);
  const post = await env.createPost();
  expect((await env.requestJson(`/api/posts/${post.id}`, {...json({permissionType:"password",password:""},admin.cookie),method:"PUT"})).status).toBe(400);
  expect(env.d1.sqlite.query("SELECT permission_type FROM posts WHERE id=?").get(post.id)).toEqual({permission_type:"public"});
});

test("ordinary login attempts are throttled atomically even with Turnstile off", async () => {
  const request = () => env.requestJson("/api/auth/login", {...json({username:"unknown_user",password:"wrongpassword"}),headers:{"Content-Type":"application/json","CF-Connecting-IP":"203.0.113.8"}});
  const results = await Promise.all(Array.from({length:24},request));
  expect(results.filter(result=>result.status===401)).toHaveLength(20);
  expect(results.filter(result=>result.status===429)).toHaveLength(4);
  expect(results.find(result=>result.status===429)?.headers.get("Retry-After")).toBeTruthy();
  const other = await env.requestJson("/api/auth/login", {...json({username:"another_user",password:"wrongpassword"}),headers:{"Content-Type":"application/json","CF-Connecting-IP":"203.0.113.9"}});
  expect(other.status).toBe(401);
  env.d1.sqlite.query("UPDATE oauth_rate_limits SET expires_at=0 WHERE bucket LIKE 'password-auth:%'").run();
  expect((await request()).status).toBe(401);
});

test("ordinary authentication fails closed when its attempt budget cannot be stored", async () => {
  const originalBatch = env.d1.batch;
  env.d1.batch = async () => { throw new Error("Budget storage unavailable"); };
  try {
    const result = await env.requestJson("/api/auth/login", json({username:"unknown_user",password:"wrongpassword"}));
    expect(result.status).toBe(503);
    expect(result.headers.get("Set-Cookie")).toBeNull();
  } finally { env.d1.batch = originalBatch; }
});

test("an approved external avatar with a matching path cannot publish an unattached R2 object", async () => {
  const key = "uploads/hidden.webp";
  await env.storage.put(key, new Uint8Array([1,2,3]));
  await env.db.insert(schema.friends).values([
    { name:"External friend",url:"https://friend.example",avatar:`https://friend.example/${key}`,accepted:1 },
    { name:"External proxy",url:"https://proxy.example",avatar:`https://proxy.example/api/blob/${key}`,accepted:1 },
  ]);
  expect((await env.request(await signedMediaUrl(key, env.env))).status).toBe(403);
});

test("configured storage domains with a path prefix still authorize genuine published images", async () => {
  const key = "uploads/public.webp";
  env.d1.sqlite.query("INSERT INTO site_configs (key,value) VALUES ('publicR2Url',?)").run(JSON.stringify("https://storage.example/media"));
  await env.storage.put(key, new Uint8Array([1,2,3]));
  await env.createPost({image:`https://storage.example/media/${key}`});
  expect((await env.request(await signedMediaUrl(key, env.env))).status).toBe(200);
});
