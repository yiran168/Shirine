import type { Env } from "../types";
import { normalizeLegacyAvatar } from "./avatar-presets";

const MAX_AGE = 600;
async function mac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signed), x => x.toString(16).padStart(2, "0")).join("");
}
export async function signedMediaUrl(key: string, env: Env) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const signature = await mac(`${key}:${expires}`, env.JWT_SECRET);
  return `/api/blob/${key.split("/").map(encodeURIComponent).join("/")}?expires=${expires}&signature=${signature}`;
}
export async function verifyMediaSignature(key: string, url: URL, env: Env, allowExpired = false) {
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expires) || expires < now - (allowExpired ? 86400 : 0) || expires > now + MAX_AGE || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await mac(`${key}:${expires}`, env.JWT_SECRET);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

/** Replace storage origins in API data, including Markdown image/audio URLs. */
export async function protectMediaUrls(value: unknown, bases: string[], env: Env, admin = false): Promise<unknown> {
  const knownBases = bases.filter(Boolean).map(base => base.replace(/\/+$/, ""));
  const signed = new Map<string, Promise<string>>();
  async function visit(item: any, field = ""): Promise<any> {
    if (["publicR2Url", "effectivePublicR2Url", "fallbackR2Url"].includes(field)) return admin ? item : "";
    if (Array.isArray(item)) return Promise.all(item.map(x => visit(x)));
    if (item && typeof item === "object") return Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key, val]) => [key, await visit(val, key)])));
    if (typeof item !== "string") return item;
    item = normalizeLegacyAvatar(item);
    const matches = [...item.matchAll(/(?:https?:\/\/[^\s"'<>()[\]\\]+|\/api\/(?:upload\/)?blob\/[^\s"'<>()[\]\\]+)/g)];
    for (const match of matches) {
      const url = match[0];
      let key = "";
      const base = knownBases.find(base => url.startsWith(base + "/"));
      if (base) key = url.slice(base.length + 1).split(/[?#]/)[0];
      else if (url.startsWith("/api/")) key = url.replace(/^\/api\/(?:upload\/)?blob\//, "").split(/[?#]/)[0];
      if (!key) continue;
      try { key = decodeURIComponent(key); } catch { continue; }
      if (!signed.has(key)) signed.set(key, signedMediaUrl(key, env));
      item = item.replaceAll(url, await signed.get(key)!);
    }
    return item;
  }
  return visit(value);
}

/** Persist stable keys, not ten-minute presentation signatures. */
export function canonicalizeMediaInput(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalizeMediaInput);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, canonicalizeMediaInput(val)]));
  if (typeof value !== "string") return value;
  return normalizeLegacyAvatar(value).replace(/(\/api\/(?:upload\/)?blob\/[^\s"'<>()[\]\\?]+)\?expires=\d+(?:&|&amp;)signature=[a-f0-9]{64}/g, "$1");
}
