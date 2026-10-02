import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { digest, type OAuthProvider, type ProviderConfig } from "./oauth-config";

export type OAuthFlow = { verifier: string; nonce: string; callback: string };
export type OAuthIdentity = { subject: string; nickname: string };
const pkceProviders = new Set<OAuthProvider>(["microsoft", "github", "google", "twitter", "feishu", "gitlab"]);
const fbVersion = "v26.0";
function endpoints(id: OAuthProvider, c: ProviderConfig) {
  const microsoft = `https://login.microsoftonline.com/${c.tenant || "common"}/oauth2/v2.0`;
  return {
    microsoft: { authorize: `${microsoft}/authorize`, token: `${microsoft}/token`, scope: "openid profile" },
    apple: { authorize: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token", scope: "" },
    github: { authorize: "https://github.com/login/oauth/authorize", token: "https://github.com/login/oauth/access_token", scope: "read:user" },
    google: { authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", scope: "openid profile" },
    qq: { authorize: "https://graph.qq.com/oauth2.0/authorize", token: "https://graph.qq.com/oauth2.0/token", scope: "get_user_info" },
    facebook: { authorize: `https://www.facebook.com/${fbVersion}/dialog/oauth`, token: `https://graph.facebook.com/${fbVersion}/oauth/access_token`, scope: "public_profile" },
    twitter: { authorize: "https://x.com/i/oauth2/authorize", token: "https://api.x.com/2/oauth2/token", scope: "users.read tweet.read" },
    discord: { authorize: "https://discord.com/oauth2/authorize", token: "https://discord.com/api/oauth2/token", scope: "identify" },
    wechat: { authorize: "https://open.weixin.qq.com/connect/qrconnect", token: "https://api.weixin.qq.com/sns/oauth2/access_token", scope: "snsapi_login" },
    feishu: { authorize: "https://accounts.feishu.cn/open-apis/authen/v1/authorize", token: "https://open.feishu.cn/open-apis/authen/v2/oauth/token", scope: "" },
    gitlab: { authorize: "https://gitlab.com/oauth/authorize", token: "https://gitlab.com/oauth/token", scope: "openid profile" },
  }[id];
}
export async function authorizeUrl(id: OAuthProvider, config: ProviderConfig, flow: OAuthFlow, state: string): Promise<string> {
  const endpoint = endpoints(id, config);
  const url = new URL(endpoint.authorize);
  url.search = new URLSearchParams({ [id === "wechat" ? "appid" : "client_id"]: config.clientId, redirect_uri: flow.callback, response_type: "code", state }).toString();
  if (endpoint.scope) url.searchParams.set("scope", endpoint.scope);
  if (["google", "microsoft", "apple", "gitlab"].includes(id)) url.searchParams.set("nonce", flow.nonce);
  if (pkceProviders.has(id)) {
    url.searchParams.set("code_challenge", await digest(flow.verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  if (id === "apple") url.searchParams.set("response_mode", "form_post");
  if (id === "wechat") url.hash = "wechat_redirect";
  return url.href;
}

// URLs are fixed provider endpoints. Never follow redirects with a code or secret.
async function json(url: string | URL, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json", "User-Agent": "Shirine-OAuth", ...init.headers } });
  if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
  const body = await response.text();
  if (body.length > 1024 * 1024) throw new Error("INVALID_PROVIDER_RESPONSE");
  const data = JSON.parse(body);
  if (!data || typeof data !== "object" || data.error || data.errcode || (data.code !== undefined && String(data.code) !== "0")) throw new Error("PROVIDER_REJECTED");
  return data;
}
const query = (base: string, fields: Record<string, string>) => `${base}?${new URLSearchParams(fields)}`;
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(url: string) {
  let key = keys.get(url);
  if (!key) { key = createRemoteJWKSet(new URL(url), { timeoutDuration: 8000 }); keys.set(url, key); }
  return key;
}
async function oidc(id: OAuthProvider, token: string, config: ProviderConfig, nonce: string): Promise<JWTPayload> {
  const options = {
    google: { jwks: "https://www.googleapis.com/oauth2/v3/certs", issuer: ["https://accounts.google.com", "accounts.google.com"] },
    apple: { jwks: "https://appleid.apple.com/auth/keys", issuer: "https://appleid.apple.com" },
    gitlab: { jwks: "https://gitlab.com/oauth/discovery/keys", issuer: "https://gitlab.com" },
    microsoft: { jwks: `https://login.microsoftonline.com/${config.tenant || "common"}/discovery/v2.0/keys`, issuer: undefined },
  }[id as "google" | "apple" | "gitlab" | "microsoft"];
  const { payload } = await jwtVerify(token, jwks(options.jwks), { audience: config.clientId, issuer: options.issuer, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat", "nonce", "iss"], clockTolerance: 10 });
  if (typeof payload.sub !== "string" || !payload.sub.trim()) throw new Error("INVALID_SUBJECT");
  if (payload.nonce !== nonce) throw new Error("INVALID_NONCE");
  if (payload.azp && payload.azp !== config.clientId) throw new Error("INVALID_AUDIENCE");
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) throw new Error("INVALID_AUDIENCE");
  if (id === "microsoft") {
    const tenant = payload.tid;
    if (typeof tenant !== "string" || !/^[a-f\d-]{36}$/i.test(tenant) || payload.iss !== `https://login.microsoftonline.com/${tenant}/v2.0`) throw new Error("INVALID_ISSUER");
    const selected = config.tenant || "common";
    const consumer = "9188040d-6c67-4c5b-b112-36a304b66dad";
    if ((selected === "consumers" && tenant !== consumer) || (selected === "organizations" && tenant === consumer) || (!/^(common|consumers|organizations)$/.test(selected) && tenant !== selected)) throw new Error("INVALID_TENANT");
  }
  return payload;
}
export async function exchangeIdentity(id: OAuthProvider, config: ProviderConfig, flow: OAuthFlow, code: string): Promise<OAuthIdentity> {
  let secret = config.secret;
  if (id === "apple") {
    secret = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: config.keyId }).setIssuer(config.teamId!).setSubject(config.clientId).setAudience("https://appleid.apple.com").setIssuedAt().setExpirationTime("5m").sign(await importPKCS8(secret, "ES256"));
  }
  const fields: Record<string, string> = { client_id: config.clientId, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: flow.callback };
  if (pkceProviders.has(id)) fields.code_verifier = flow.verifier;
  const endpoint = endpoints(id, config).token;
  let tokens: any;
  if (id === "wechat") tokens = await json(query(endpoint, { appid: config.clientId, secret, code, grant_type: "authorization_code" }));
  else if (id === "qq") tokens = await json(query(endpoint, { ...fields, fmt: "json", need_openid: "1" }));
  else if (id === "facebook") tokens = await json(query(endpoint, fields));
  else if (id === "feishu") tokens = await json(endpoint, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(fields) });
  else {
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (id === "twitter") {
      headers.Authorization = `Basic ${btoa(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(secret)}`)}`;
      delete fields.client_secret;
    }
    tokens = await json(endpoint, { method: "POST", headers, body: new URLSearchParams(fields) });
  }
  let subject: unknown, nickname: unknown;
  if (["microsoft", "google", "apple", "gitlab"].includes(id)) {
    if (typeof tokens.id_token !== "string") throw new Error("MISSING_ID_TOKEN");
    const payload = await oidc(id, tokens.id_token, config, flow.nonce);
    subject = id === "microsoft" ? `${payload.tid}:${payload.sub}` : payload.sub;
    nickname = payload.name || payload.preferred_username;
  } else {
    if (typeof tokens.access_token !== "string" || !tokens.access_token) throw new Error("MISSING_ACCESS_TOKEN");
    const headers = { Authorization: `Bearer ${tokens.access_token}` };
    if (id === "github") { const p = await json("https://api.github.com/user", { headers }); subject = p.id; nickname = p.name || p.login; }
    if (id === "discord") { const p = await json("https://discord.com/api/users/@me", { headers }); subject = p.id; nickname = p.global_name || p.username; }
    if (id === "twitter") { const p = await json("https://api.x.com/2/users/me", { headers }); subject = p.data?.id; nickname = p.data?.name; }
    if (id === "feishu") { const p = await json("https://open.feishu.cn/open-apis/authen/v1/user_info", { headers }); subject = p.data?.open_id; nickname = p.data?.name; }
    if (id === "qq") {
      if (typeof tokens.openid !== "string" || !tokens.openid) throw new Error("MISSING_OPENID");
      const p = await json(query("https://graph.qq.com/user/get_user_info", { access_token: tokens.access_token, oauth_consumer_key: config.clientId, openid: tokens.openid }));
      if (p.ret !== 0) throw new Error("INVALID_QQ_PROFILE");
      subject = tokens.openid; nickname = p.nickname;
    }
    if (id === "wechat") {
      if (typeof tokens.openid !== "string" || !tokens.openid) throw new Error("MISSING_OPENID");
      const p = await json(query("https://api.weixin.qq.com/sns/userinfo", { access_token: tokens.access_token, openid: tokens.openid, lang: "zh_CN" }));
      if (p.openid !== tokens.openid) throw new Error("INVALID_WECHAT_PROFILE");
      subject = p.openid; nickname = p.nickname;
    }
    if (id === "facebook") {
      const checked = await json(query(`https://graph.facebook.com/${fbVersion}/debug_token`, { input_token: tokens.access_token }), { headers: { Authorization: `Bearer ${config.clientId}|${secret}` } });
      if (!checked.data?.is_valid || checked.data.app_id !== config.clientId) throw new Error("INVALID_FACEBOOK_TOKEN");
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const proof = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokens.access_token)))).map(b => b.toString(16).padStart(2, "0")).join("");
      const p = await json(query(`https://graph.facebook.com/${fbVersion}/me`, { fields: "id,name", appsecret_proof: proof }), { headers });
      if (p.id !== checked.data.user_id) throw new Error("INVALID_FACEBOOK_PROFILE");
      subject = p.id; nickname = p.name;
    }
  }
  if ((typeof subject !== "string" && typeof subject !== "number") || !String(subject) || String(subject).length > 255 || (typeof subject === "number" && !Number.isSafeInteger(subject))) throw new Error("INVALID_IDENTITY");
  return { subject: String(subject), nickname: typeof nickname === "string" ? nickname.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 64) : `${id} 用户` };
}
