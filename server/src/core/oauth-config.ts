import type { Env } from "../types";

export const oauthProviders = [
  { id: "microsoft", name: "Microsoft", icon: "fa6-brands:microsoft", help: "支持微软个人邮箱及工作/学校账号；注册 Web 应用并添加回调 URL。", docs: "https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc" },
  { id: "apple", name: "Apple", icon: "fa6-brands:apple", help: "需要 Apple Developer、关联 App 的 Services ID、Team ID、Key ID 和 Sign in with Apple .p8 私钥；必须使用 HTTPS 域名。", docs: "https://developer.apple.com/documentation/signinwithapplerestapi" },
  { id: "github", name: "GitHub", icon: "fa6-brands:github", help: "创建 OAuth App，填写 Homepage URL 和 Authorization callback URL。", docs: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps" },
  { id: "google", name: "Google", icon: "fa6-brands:google", help: "创建 Web OAuth 客户端并设置同意屏幕；测试模式仅限测试用户，公开使用需按平台要求发布应用。", docs: "https://developers.google.com/identity/openid-connect/openid-connect" },
  { id: "qq", name: "QQ", icon: "fa6-brands:qq", help: "需要审核通过的 QQ 互联网站应用，填写 App ID、App Key 和授权回调域。", docs: "https://wiki.connect.qq.com/使用authorization_code获取access_token" },
  { id: "facebook", name: "Facebook", icon: "fa6-brands:facebook", help: "创建 Meta 应用并启用 Facebook Login；配置有效 OAuth 重定向 URI，按平台要求切换正式模式。", docs: "https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/" },
  { id: "twitter", name: "X / Twitter", icon: "fa6-brands:x-twitter", help: "启用 OAuth 2.0，应用类型选 Web App；使用 Client ID / Client Secret，不是 API Key。需有 users/me 接口访问权限及额度。", docs: "https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code" },
  { id: "discord", name: "Discord", icon: "fa6-brands:discord", help: "创建 Discord 应用，在 OAuth2 页面添加 Redirect；只请求 identify 权限。", docs: "https://discord.com/developers/docs/topics/oauth2" },
  { id: "wechat", name: "微信", icon: "fa6-brands:weixin", help: "需要微信开放平台审核通过的网站应用及微信登录权限，使用网站应用 AppID / AppSecret；不使用公众号凭据。", docs: "https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html" },
  { id: "feishu", name: "飞书", icon: "material-symbols:flight", help: "创建飞书应用，在安全设置中添加重定向 URL；用户必须在应用可用范围内，发布应用后生效。", docs: "https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code" },
  { id: "gitlab", name: "GitLab", icon: "fa6-brands:gitlab", help: "支持 GitLab.com：创建 Confidential Application，启用 openid、profile，填写 Redirect URI。", docs: "https://docs.gitlab.com/integration/openid_connect_provider/" },
] as const;
export type OAuthProvider = typeof oauthProviders[number]["id"];
export type ProviderConfig = { enabled: boolean; clientId: string; secret: string; teamId?: string; keyId?: string; tenant?: string };
export type OAuthConfig = { origin: string; providers: Partial<Record<OAuthProvider, ProviderConfig>> };
const configKey = "oauth_providers_v1";
const encoder = new TextEncoder();

export function isProvider(id: string): id is OAuthProvider { return oauthProviders.some(p => p.id === id); }
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function randomValue(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function digest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function encryptionKey(env: Env) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(`Shirine OAuth encryption v1\0${env.JWT_SECRET}`));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(value: string, env: Env, purpose: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(purpose) }, await encryptionKey(env), encoder.encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`;
}
export async function unseal(value: string, env: Env, purpose: string): Promise<string> {
  const [version, iv, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !ciphertext) throw new Error("Invalid encrypted OAuth settings");
  const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv), additionalData: encoder.encode(purpose) }, await encryptionKey(env), decode(ciphertext)));
}
export async function readOAuthConfig(env: Env): Promise<OAuthConfig> {
  const row = await env.DB.prepare("SELECT value FROM system_configs WHERE key = ?").bind(configKey).first<{ value: string }>();
  return row ? JSON.parse(await unseal(row.value, env, configKey)) : { origin: "", providers: {} };
}
export async function writeOAuthConfig(env: Env, config: OAuthConfig): Promise<void> {
  await env.DB.prepare("INSERT INTO system_configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()")
    .bind(configKey, await seal(JSON.stringify(config), env, configKey)).run();
}
export function validOrigin(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return "";
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.origin : "";
  } catch { return ""; }
}
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2048 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x20]/.test(raw)) return "/";
  try {
    const url = new URL(raw, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || /^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
export function configured(id: OAuthProvider, config?: ProviderConfig): boolean {
  return !!(config?.enabled && config.clientId && config.secret && (id !== "apple" || (config.teamId && config.keyId)));
}
export function callbackUrl(origin: string, id: OAuthProvider): string { return `${origin}/api/auth/oauth/${id}/callback`; }
