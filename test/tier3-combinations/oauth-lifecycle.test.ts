import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { exportJWK, exportPKCS8, generateKeyPair, SignJWT } from "../../server/node_modules/jose";
import { createTestEnv, type TestEnvironment } from "../helpers/test-env";
import { callbackUrl, oauthProviders, readOAuthConfig, safeReturnPath, writeOAuthConfig, type OAuthProvider } from "../../server/src/core/oauth-config";
import { exchangeIdentity } from "../../server/src/core/oauth-providers";
import { verifyToken } from "../../server/src/core/auth";

const realFetch = globalThis.fetch;
const origin = "http://localhost";
let env: TestEnvironment;
let key: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let publicKey: any;
let applePrivate = "";
beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  key = pair.privateKey; publicKey = { ...await exportJWK(pair.publicKey), kid: "oauth-test", alg: "RS256", use: "sig" };
  applePrivate = await exportPKCS8((await generateKeyPair("ES256", { extractable: true })).privateKey);
});
afterEach(() => { globalThis.fetch = realFetch; env?.close(); });
async function setup(ids: OAuthProvider[] = ["github"], site = origin) {
  env = createTestEnv();
  const providers = Object.fromEntries(ids.map(id => [id, { enabled: true, clientId: "app-test", secret: id === "apple" ? applePrivate : "test-secret-not-public", teamId: "ABCDEFGHIJ", keyId: "0123456789", tenant: "common" }]));
  await writeOAuthConfig(env.env, { origin: site, providers });
}
async function start(id = "github", returnTo = "/albums/?view=grid#photo", token = "", site = origin) {
  const res = await env.requestJson(`/api/auth/oauth/${id}/start`, { method: "POST", headers: { Origin: site, "Content-Type": "application/json" }, body: JSON.stringify({ returnTo, turnstileToken: token }) });
  return { ...res, state: res.data.url ? new URL(res.data.url).searchParams.get("state")! : "", cookie: res.headers.get("set-cookie")?.split(";")[0] || "" };
}
async function callback(flow: Awaited<ReturnType<typeof start>>, id = "github", extras = "") {
  return env.request(`/api/auth/oauth/${id}/callback?state=${flow.state}&code=test-code${extras}`, { headers: { Cookie: flow.cookie } });
}
async function mockProvider(id: OAuthProvider, nonce = "", profile: any = {}) {
  const issuer = id === "google" ? "https://accounts.google.com" : id === "apple" ? "https://appleid.apple.com" : id === "gitlab" ? "https://gitlab.com" : "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0";
  const idToken = await new SignJWT({ nonce, name: "Same Admin Name", tid: "9188040d-6c67-4c5b-b112-36a304b66dad" }).setProtectedHeader({ alg: "RS256", kid: "oauth-test" }).setIssuer(issuer).setAudience("app-test").setSubject("external-42").setIssuedAt().setExpirationTime("5m").sign(key);
  globalThis.fetch = (async (input: any) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (/\/keys$|\/certs$/.test(url.pathname)) return Response.json({ keys: [publicKey] });
    if (/\/token$|\/access_token$/.test(url.pathname)) return Response.json({ access_token: "external-access-token", id_token: idToken, openid: "external-42" });
    if (url.pathname.endsWith("/debug_token")) return Response.json({ data: { app_id: "app-test", is_valid: true, user_id: "external-42" } });
    return Response.json({ id: "external-42", login: "superadmin", name: "Same Admin Name", email: "admin@example.com", username: "user", global_name: "User", nickname: "用户", ret: 0, openid: "external-42", data: { id: "external-42", open_id: "external-42", name: "用户" }, ...profile });
  }) as typeof fetch;
}

describe("OAuth configuration and authorization boundaries", () => {
  it("keeps all secrets encrypted and invisible to public or admin reads, preserving blank edits", async () => {
    await setup();
    const admin = await env.createSuperadmin();
    const user = await env.createUser();
    expect((await env.request("/api/auth/oauth/settings")).status).toBe(401);
    expect((await env.request("/api/auth/oauth/settings", { headers: { Authorization: `Bearer ${user.token}` } })).status).toBe(403);
    const settings = await env.requestJson("/api/auth/oauth/settings", { headers: { Authorization: `Bearer ${admin.token}` } });
    expect(settings.data.providers).toHaveLength(11);
    expect(JSON.stringify(settings.data)).not.toContain("test-secret-not-public");
    expect(env.d1.sqlite.query("SELECT value FROM system_configs WHERE key = 'oauth_providers_v1'").get()).not.toEqual(expect.objectContaining({ value: expect.stringContaining("test-secret-not-public") }));
    const save = await env.requestJson("/api/auth/oauth/settings", { method: "PUT", headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" }, body: JSON.stringify(settings.data) });
    expect(save.status).toBe(200);
    expect((await readOAuthConfig(env.env)).providers.github?.secret).toBe("test-secret-not-public");
    const pub = await env.requestJson("/api/auth/oauth/providers");
    expect(pub.data.providers.map((p: any) => p.id)).toEqual(["github"]);
    expect(JSON.stringify(pub.data)).not.toContain("app-test");
    settings.data.providers.find((p: any) => p.id === "github").clearSecret = true;
    expect((await env.request("/api/auth/oauth/settings", { method: "PUT", headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" }, body: JSON.stringify(settings.data) })).status).toBe(400);
    expect((await readOAuthConfig(env.env)).providers.github?.secret).toBe("test-secret-not-public");
  });
  it("blocks disabled providers, foreign origins and open redirects", async () => {
    await setup();
    expect((await start("google")).status).toBe(403);
    expect((await start("github", "/", "", "https://evil.example")).status).toBe(403);
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil.example", "/api/auth/logout", "/auth/complete"]) expect(safeReturnPath(value)).toBe("/");
    expect(safeReturnPath("/posts/test?x=1#part")).toBe("/posts/test?x=1#part");
    const flow = await start();
    const url = new URL(flow.data.url);
    expect(url.searchParams.get("redirect_uri")).toBe(callbackUrl(origin, "github"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(flow.headers.get("cache-control")).toContain("no-store");
    expect(flow.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("requires Turnstile before every OAuth start when enabled, including direct API calls", async () => {
    await setup(oauthProviders.map(p => p.id));
    env.d1.sqlite.query("INSERT INTO system_configs (key,value) VALUES ('turnstile',?)").run(JSON.stringify({ enabled: true, siteKey: "test" }));
    for (const provider of oauthProviders) expect((await start(provider.id)).status).toBe(400);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM oauth_states").get()).toEqual({ n: 0 });
    let checked = 0;
    globalThis.fetch = (async (url: any, options: any) => {
      expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      checked++;
      return Response.json({ success: options.body.get("response") === "good-token" });
    }) as typeof fetch;
    expect((await start("github", "/", "bad-token")).status).toBe(400);
    expect((await start("github", "/", "good-token")).status).toBe(200);
    expect(checked).toBe(2);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM oauth_states").get()).toEqual({ n: 1 });
  });
  it("also requires Turnstile on normal registration and password login", async () => {
    await setup();
    const existing = await env.createUser("captcha_reader", "secret-password");
    env.d1.sqlite.query("INSERT INTO system_configs (key,value) VALUES ('turnstile',?)").run(JSON.stringify({ enabled: true, siteKey: "test" }));
    globalThis.fetch = (async (_url: any, options: any) => Response.json({ success: options.body.get("response") === "valid-captcha" })) as typeof fetch;
    for (const endpoint of ["login", "register"]) {
      const body = { username: endpoint === "login" ? existing.username : "captcha_new_reader", email: "captcha_new_reader@example.com", password: "secret-password" };
      for (const token of ["", "wrong-captcha"]) {
        const failed = await env.requestJson(`/api/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, turnstileToken: token }) });
        expect(failed.status).toBe(400);
        expect(failed.data.token).toBeUndefined();
      }
      const passed = await env.requestJson(`/api/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, turnstileToken: "valid-captcha" }) });
      expect(passed.data.success).toBe(true);
      expect(passed.data.user.role).toBe("user");
    }
  });
  it("rejects wrong browsers, cross-provider callbacks, replay, and expired states", async () => {
    await setup(["github", "discord"]); await mockProvider("github");
    const flow = await start();
    expect((await callback({ ...flow, cookie: "" })).status).toBe(400);
    expect((await callback(flow, "discord")).status).toBe(400);
    expect((await callback(flow)).status).toBe(200);
    expect((await callback(flow)).status).toBe(400);
    const expired = await start();
    env.d1.sqlite.query("UPDATE oauth_states SET expires_at = 0").run();
    expect((await callback(expired)).status).toBe(400);
  });
  it("creates only ordinary accounts and reuses the exact identity without email/name merging", async () => {
    await setup(); await mockProvider("github");
    const admin = await env.createSuperadmin();
    env.d1.sqlite.query("UPDATE users SET email = 'admin@example.com', nickname = 'Same Admin Name' WHERE id = ?").run(admin.id);
    const response = await callback(await start());
    const cookie = response.headers.getSetCookie().find(s => s.startsWith("shirine_token="))!;
    const token = cookie.split(";")[0].split("=")[1];
    const payload = await verifyToken(token, env.jwtSecret);
    expect(payload?.role).toBe("user"); expect(payload?.id).not.toBe(admin.id);
    expect(cookie).toContain("HttpOnly");
    expect(await response.text()).not.toContain(token);
    expect((await callback(await start())).status).toBe(200);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM oauth_accounts").get()).toEqual({ n: 1 });
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM users").get()).toEqual({ n: 2 });
    env.d1.sqlite.query("UPDATE users SET status = 'banned' WHERE id = ?").run(payload!.id);
    const banned = await callback(await start());
    expect(banned.status).toBe(400); expect(banned.headers.get("set-cookie")).not.toContain("shirine_token=");
  });
  it("invalidates pending authorization when credentials change or the provider is disabled", async () => {
    await setup();
    const flow = await start();
    await writeOAuthConfig(env.env, { origin, providers: {} });
    expect((await callback(flow)).status).toBe(400);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM users").get()).toEqual({ n: 0 });
  });
  it("keeps simultaneous first logins for the same provider identity attached to one user", async () => {
    await setup(); await mockProvider("github");
    const first = await start(); const second = await start();
    const responses = await Promise.all([callback(first), callback(second)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM users").get()).toEqual({ n: 1 });
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM oauth_accounts").get()).toEqual({ n: 1 });
  });
  it("allows cookie sessions through the configured Pages HTTP proxy while rejecting foreign origins", async () => {
    await setup(["github"], "https://frontend.example");
    await mockProvider("github");
    const flow = await start("github", "/", "", "https://frontend.example");
    const signedIn = await callback(flow);
    const session = signedIn.headers.getSetCookie().find(s => s.startsWith("shirine_token="))!.split(";")[0];
    const blocked = await env.request("/api/user/checkin", { method: "POST", headers: { Cookie: session, Origin: "https://evil.example" } });
    expect(blocked.status).toBe(403);
    const accepted = await env.requestJson("/api/user/checkin", { method: "POST", headers: { Cookie: session, Origin: "https://frontend.example" } });
    expect(accepted.status).toBe(200); expect(accepted.data.success).toBe(true);
    const again = await env.request("/api/user/checkin", { method: "POST", headers: { Cookie: session, Origin: "https://frontend.example.evil.example" } });
    expect(again.status).toBe(403);
  });
  it("limits repeated starts and does not expose provider errors or mint a session after rejection", async () => {
    await setup();
    const flow = await start();
    globalThis.fetch = (async () => Response.json({ error: "secret-provider-detail" }, { status: 400 })) as typeof fetch;
    const result = await callback(flow);
    expect(result.status).toBe(400);
    expect(await result.text()).not.toContain("secret-provider-detail");
    expect(result.headers.get("set-cookie")).not.toContain("shirine_token=");
    for (let i = 1; i < 30; i++) expect((await start()).status).toBe(200);
    expect((await start()).status).toBe(429);
  });
  it("does not consume a valid state on a wrong browser cookie and fails atomically on identity storage errors", async () => {
    await setup(); await mockProvider("github");
    const flow = await start();
    expect((await callback({ ...flow, cookie: `shirine_oauth_github=${"a".repeat(43)}` })).status).toBe(400);
    env.d1.sqlite.exec("CREATE TRIGGER fail_identity BEFORE INSERT ON oauth_accounts BEGIN SELECT RAISE(ABORT, 'simulated'); END;");
    expect((await callback(flow)).status).toBe(400);
    expect(env.d1.sqlite.query("SELECT count(*) AS n FROM users").get()).toEqual({ n: 0 });
  });
  it("uses SameSite=None+Secure for Apple form_post, and still validates its state", async () => {
    await setup(["apple"], "https://blog.example");
    const flow = await start("apple", "/", "", "https://blog.example");
    expect(flow.headers.get("set-cookie")).toContain("SameSite=None");
    expect(flow.headers.get("set-cookie")).toContain("Secure");
    expect(new URL(flow.data.url).searchParams.get("response_mode")).toBe("form_post");
    const nonce = new URL(flow.data.url).searchParams.get("nonce")!;
    await mockProvider("apple", nonce);
    const result = await env.request("/api/auth/oauth/apple/callback", { method: "POST", headers: { Cookie: flow.cookie, Origin: "https://appleid.apple.com", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ state: flow.state, code: "test-code" }) });
    expect(result.status).toBe(200);
    expect(result.headers.getSetCookie().some(c => c.startsWith("shirine_token=") && c.includes("Secure"))).toBe(true);
    const bad = await env.request("/api/auth/oauth/apple/callback", { method: "POST", headers: { Cookie: flow.cookie }, body: new URLSearchParams({ state: flow.state, code: "test-code" }) });
    expect(bad.status).toBe(400);
  });
});

describe("OAuth provider contracts", () => {
  for (const provider of oauthProviders) it(`${provider.name} exchanges a code for a stable provider identity`, async () => {
    await setup([provider.id]);
    const config = (await readOAuthConfig(env.env)).providers[provider.id]!;
    await mockProvider(provider.id, "expected-nonce");
    const identity = await exchangeIdentity(provider.id, config, { callback: callbackUrl(origin, provider.id), verifier: "v".repeat(43), nonce: "expected-nonce" }, "code");
    expect(identity.subject).toBe(provider.id === "microsoft" ? "9188040d-6c67-4c5b-b112-36a304b66dad:external-42" : "external-42");
    expect(identity.nickname.length).toBeGreaterThan(0);
  });
  it("rejects a validly signed OIDC token carrying another authorization nonce", async () => {
    await setup(["google"]); await mockProvider("google", "another-nonce");
    await expect(exchangeIdentity("google", (await readOAuthConfig(env.env)).providers.google!, { callback: callbackUrl(origin, "google"), verifier: "v".repeat(43), nonce: "expected-nonce" }, "code")).rejects.toThrow("INVALID_NONCE");
  });
});
