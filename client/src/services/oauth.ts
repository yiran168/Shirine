import { getApiBase } from "./api";

export interface OAuthProviderInfo { id: string; name: string; icon: string }
export interface OAuthSetting extends OAuthProviderInfo {
  enabled: boolean; clientId: string; hasSecret: boolean; secret?: string; clearSecret?: boolean;
  teamId: string; keyId: string; tenant: string; help: string; docs: string; ready: boolean; callback: string;
}
async function call(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  // Retain compatibility with existing password sessions while OAuth uses HttpOnly cookies.
  let token: string | null = null;
  try { token = localStorage.getItem("shirine_token"); } catch {}
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getApiBase()}/auth/oauth${path}`, { ...options, headers, credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "第三方登录服务暂时不可用");
  return result;
}
export const oauthApi = {
  providers: (): Promise<{ providers: OAuthProviderInfo[] }> => call("/providers"),
  settings: (): Promise<{ origin: string; providers: OAuthSetting[] }> => call("/settings"),
  save: (origin: string, providers: OAuthSetting[]) => call("/settings", { method: "PUT", body: JSON.stringify({ origin, providers: providers.map(p => ({ id: p.id, enabled: p.enabled, clientId: p.clientId, secret: p.secret || "", clearSecret: p.clearSecret || false, teamId: p.teamId, keyId: p.keyId, tenant: p.tenant })) }) }),
  start: (id: string, turnstileToken: string): Promise<{ url: string }> => call(`/${encodeURIComponent(id)}/start`, { method: "POST", body: JSON.stringify({ turnstileToken, returnTo: location.pathname + location.search + location.hash }) }),
};
