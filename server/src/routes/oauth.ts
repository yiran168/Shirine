import { Hono, type Context } from "hono";
import { importPKCS8 } from "jose";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";
import { signToken } from "../core/auth";
import { verifyTurnstile } from "../core/turnstile";
import { authorizeUrl, exchangeIdentity, type OAuthFlow } from "../core/oauth-providers";
import { callbackUrl, configured, digest, isProvider, oauthProviders, randomValue, readOAuthConfig, safeReturnPath, seal, unseal, validOrigin, writeOAuthConfig, type OAuthConfig, type OAuthProvider, type ProviderConfig } from "../core/oauth-config";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
type StoredFlow = OAuthFlow & { origin: string; returnTo: string; fingerprint: string };
export const oauthRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
oauthRouter.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

oauthRouter.get("/providers", async c => {
  try {
    const config = await readOAuthConfig(c.env);
    return c.json({ success: true, providers: config.origin ? oauthProviders.filter(p => configured(p.id, config.providers[p.id])).map(({ id, name, icon }) => ({ id, name, icon })) : [] });
  } catch { return c.json({ success: false, error: "第三方登录暂时不可用", providers: [] }, 503); }
});

oauthRouter.get("/settings", requireAdmin, async c => {
  try {
    const config = await readOAuthConfig(c.env);
    return c.json({ success: true, origin: config.origin, providers: oauthProviders.map(p => {
      const s = config.providers[p.id];
      return { ...p, enabled: s?.enabled || false, clientId: s?.clientId || "", hasSecret: !!s?.secret, teamId: s?.teamId || "", keyId: s?.keyId || "", tenant: s?.tenant || "common", ready: !!config.origin && configured(p.id, s), callback: config.origin ? callbackUrl(config.origin, p.id) : "" };
    }) });
  } catch { return c.json({ success: false, error: "无法读取 OAuth 配置，请确认 JWT_SECRET 未被更换及数据库迁移已完成" }, 503); }
});

oauthRouter.put("/settings", requireAdmin, async c => {
  try {
    const body = await c.req.json();
    const origin = typeof body.origin === "string" ? validOrigin(body.origin.trim()) : "";
    if (!origin || (c.env.ENVIRONMENT === "production" && !origin.startsWith("https://"))) return c.json({ success: false, error: "请填写网站 HTTPS 根地址，不含路径（本地开发可使用 localhost HTTP）" }, 400);
    if (!Array.isArray(body.providers) || body.providers.length !== oauthProviders.length || new Set(body.providers.map((p: any) => p.id)).size !== oauthProviders.length) return c.json({ success: false, error: "平台配置不完整，请刷新后重试" }, 400);
    const old = await readOAuthConfig(c.env);
    const next: OAuthConfig = { origin, providers: {} };
    for (const item of body.providers) {
      if (!isProvider(item.id) || typeof item.enabled !== "boolean" || typeof item.clientId !== "string" || item.clientId.length > 255 || (item.secret !== undefined && (typeof item.secret !== "string" || item.secret.length > 8192))) return c.json({ success: false, error: "无效的平台配置" }, 400);
      const id = item.id as OAuthProvider;
      const secret = item.clearSecret === true ? "" : item.secret?.trim() || old.providers[id]?.secret || "";
      const value: ProviderConfig = { enabled: item.enabled, clientId: item.clientId.trim(), secret };
      if (/[\s\x00-\x1f]/.test(value.clientId)) return c.json({ success: false, error: "Client ID 不能包含空白字符" }, 400);
      if (id === "microsoft") {
        value.tenant = typeof item.tenant === "string" ? item.tenant.trim().toLowerCase() : "common";
        if (!/^(common|consumers|organizations|[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12})$/.test(value.tenant!)) return c.json({ success: false, error: "微软租户应为 common、consumers、organizations 或租户 UUID" }, 400);
      }
      if (id === "apple") {
        value.teamId = typeof item.teamId === "string" ? item.teamId.trim() : "";
        value.keyId = typeof item.keyId === "string" ? item.keyId.trim() : "";
        if (value.enabled && (!/^[A-Z\d]{10}$/.test(value.teamId!) || !/^[A-Z\d]{10}$/.test(value.keyId!) || !origin.startsWith("https://"))) return c.json({ success: false, error: "Apple 需要 HTTPS、10 位 Team ID 和 Key ID" }, 400);
        if (secret) {
          try { await importPKCS8(secret, "ES256"); } catch { return c.json({ success: false, error: "Apple 私钥必须是完整有效的 .p8 PEM 私钥" }, 400); }
        }
      }
      if (value.enabled && !configured(id, value)) return c.json({ success: false, error: `${oauthProviders.find(p => p.id === id)!.name} 缺少应用 ID 或密钥，请补齐后启用` }, 400);
      next.providers[id] = value;
    }
    await writeOAuthConfig(c.env, next);
    return c.json({ success: true });
  } catch { return c.json({ success: false, error: "保存第三方登录配置失败，原配置未被替换" }, 500); }
});

function cookie(c: AppContext, id: OAuthProvider, value: string, origin: string, age: number) {
  const secure = origin.startsWith("https://");
  c.header("Set-Cookie", `shirine_oauth_${id}=${value}; Path=/api/auth/oauth/${id}; HttpOnly; SameSite=${id === "apple" && secure ? "None" : "Lax"}; Max-Age=${age}${secure ? "; Secure" : ""}`, { append: true });
}
const fingerprint = (id: OAuthProvider, config: ProviderConfig, origin: string) => digest(JSON.stringify([id, config, origin]));

oauthRouter.post("/:provider/start", async c => {
  const id = c.req.param("provider");
  if (!isProvider(id)) return c.json({ success: false, error: "不支持的平台" }, 404);
  try {
    const config = await readOAuthConfig(c.env);
    const provider = config.providers[id];
    if (!config.origin || !configured(id, provider)) return c.json({ success: false, error: "此平台尚未启用或配置不完整" }, 403);
    // Require the configured frontend origin even when reached through the Worker proxy.
    if (c.req.header("Origin") !== config.origin) return c.json({ success: false, error: "当前域名与 OAuth 网站地址不一致，请在后台检查网站地址" }, 403);
    if (c.env.ENVIRONMENT === "production") {
      const admin = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").first();
      if (!admin && !c.env.ADMIN_PASSWORD) return c.json({ success: false, error: "请先完成站点初始化" }, 403);
    }
    const now = Math.floor(Date.now() / 1000);
    const bucket = await digest(`${c.env.JWT_SECRET}\0${c.req.header("CF-Connecting-IP") || "local"}\0${Math.floor(now / 600)}`);
    const count = await c.env.DB.prepare("INSERT INTO oauth_rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts").bind(bucket, now + 600).first<{ attempts: number }>();
    if (!count || count.attempts > 30) return c.json({ success: false, error: "请求过于频繁，请稍后再试" }, 429);
    const body = await c.req.json();
    const verification = await verifyTurnstile(c, body.turnstileToken);
    if (!verification.success) return c.json({ success: false, error: verification.message || "请先完成人机验证" }, 400);
    const state = randomValue();
    const browser = randomValue();
    const flow: StoredFlow = { origin: config.origin, returnTo: safeReturnPath(body.returnTo), callback: callbackUrl(config.origin, id), verifier: randomValue(), nonce: randomValue(), fingerprint: await fingerprint(id, provider!, config.origin) };
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(now),
      c.env.DB.prepare("DELETE FROM oauth_rate_limits WHERE expires_at < ?").bind(now),
      c.env.DB.prepare("INSERT INTO oauth_states (state_hash, provider, browser_hash, payload, expires_at) VALUES (?, ?, ?, ?, ?)")
        .bind(await digest(state), id, await digest(browser), await seal(JSON.stringify(flow), c.env, "oauth-flow"), now + 600),
    ]);
    const url = await authorizeUrl(id, provider!, flow, state);
    cookie(c, id, browser, config.origin, 600);
    return c.json({ success: true, url });
  } catch { return c.json({ success: false, error: "无法发起第三方登录，请检查配置或稍后重试" }, 503); }
});

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
function finish(c: AppContext, target: string, success: boolean, message: string) {
  const nonce = randomValue();
  c.header("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
  const script = success ? `try { localStorage.removeItem('shirine_token'); } catch {} history.replaceState(null, '', '/auth/complete'); location.replace(${JSON.stringify(target).replace(/</g, "\\u003c")});` : "";
  return c.html(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shirine · 第三方登录</title><style nonce="${nonce}">body{font:16px system-ui;margin:10vh auto;padding:24px;max-width:480px;line-height:1.8;background:#f4f5fa;color:#24273b}main{border-radius:24px;background:white;padding:32px}a{color:#4856bd}</style></head><body><main><h1>Shirine</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(target)}">返回原页面</a></main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`, success ? 200 : 400);
}

oauthRouter.on(["GET", "POST"], "/:provider/callback", async c => {
  const id = c.req.param("provider");
  if (!isProvider(id) || (c.req.method === "POST" && id !== "apple")) return finish(c, "/", false, "不支持的授权回调。");
  let target = "/";
  try {
    const params = c.req.method === "POST" ? new URLSearchParams(await c.req.text()) : new URL(c.req.url).searchParams;
    const state = params.get("state") || "";
    const browser = (c.req.header("Cookie") || "").match(new RegExp(`(?:^|;\\s*)shirine_oauth_${id}=([^;]+)`))?.[1] || "";
    if (!/^[A-Za-z\d_-]{43}$/.test(state) || !/^[A-Za-z\d_-]{43}$/.test(browser)) return finish(c, target, false, "授权状态无效或浏览器未保留登录 Cookie，请返回重试。");
    // Atomically consume a state only for its initiating browser and provider.
    const stored = await c.env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ? AND browser_hash = ? AND provider = ? AND expires_at >= ? RETURNING payload")
      .bind(await digest(state), await digest(browser), id, Math.floor(Date.now() / 1000)).first<{ payload: string }>();
    if (!stored) return finish(c, target, false, "授权已过期或已使用，请重新登录。");
    const flow: StoredFlow = JSON.parse(await unseal(stored.payload, c.env, "oauth-flow"));
    cookie(c, id, "", flow.origin, 0);
    target = flow.origin + safeReturnPath(flow.returnTo);
    if (params.has("error")) return finish(c, target, false, "你已取消授权，或平台拒绝了此次请求。可以返回重新选择登录方式。");
    const code = params.get("code");
    if (!code || code.length > 4096) return finish(c, target, false, "平台没有返回有效授权码，请重试。");
    const config = await readOAuthConfig(c.env);
    const provider = config.providers[id];
    if (!configured(id, provider) || await fingerprint(id, provider!, config.origin) !== flow.fingerprint) return finish(c, target, false, "平台配置已更改，请重新发起登录。");
    const identity = await exchangeIdentity(id, provider!, flow, code);
    const username = `o_${id.slice(0, 4)}_${randomValue().slice(0, 22)}`;
    // Batch is transactional. Parallel first logins reuse the winning identity;
    // email, nickname and provider avatars never grant access to an existing user.
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO users (username, nickname, password_hash, salt, role, status, points) SELECT ?, ?, '!oauth-only!', ?, 'user', 'active', 0 WHERE NOT EXISTS (SELECT 1 FROM oauth_accounts WHERE provider = ? AND client_id = ? AND subject = ?)")
        .bind(username, identity.nickname, randomValue(), id, provider!.clientId, identity.subject),
      c.env.DB.prepare("INSERT INTO oauth_accounts (provider, client_id, subject, user_id) SELECT ?, ?, ?, id FROM users WHERE username = ?")
        .bind(id, provider!.clientId, identity.subject, username),
    ]);
    const user = await c.env.DB.prepare("SELECT u.id, u.username, u.role, u.status, u.session_version FROM users u JOIN oauth_accounts a ON a.user_id = u.id WHERE a.provider = ? AND a.client_id = ? AND a.subject = ?")
      .bind(id, provider!.clientId, identity.subject).first<{ id: number; username: string; role: "superadmin" | "admin" | "user"; status: string; session_version: number }>();
    if (!user || user.status !== "active") return finish(c, target, false, "该账号已被禁用，无法登录。");
    const token = await signToken({ id: user.id, username: user.username, role: user.role, sessionVersion: user.session_version }, c.env.JWT_SECRET);
    c.header("Set-Cookie", `shirine_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${flow.origin.startsWith("https://") ? "; Secure" : ""}`, { append: true });
    return finish(c, target, true, "登录成功，正在返回原页面……");
  } catch {
    // Never log authorization codes, secrets, access tokens, or raw provider errors.
    console.warn(`[OAuth] ${id}: callback failed`);
    return finish(c, target, false, "第三方授权未完成。请确认应用凭据、回调地址、应用审核状态和平台服务可用，再重新登录。");
  }
});
