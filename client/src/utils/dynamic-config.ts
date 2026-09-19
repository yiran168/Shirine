import { siteConfig } from "@/config/siteConfig";
import { profileConfig } from "@/config/profileConfig";
import { musicConfig } from "@/config/musicConfig";
import { announcementConfig } from "@/config/announcementConfig";
import type { TrackDescriptor } from "@/types/musicConfig";

function deepMerge<T extends Record<string, any>>(target: T, source: any): T {
  if (!source || typeof source !== "object") return target;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = (target as any)[key];
    if (
      sVal &&
      typeof sVal === "object" &&
      !Array.isArray(sVal) &&
      tVal &&
      typeof tVal === "object" &&
      !Array.isArray(tVal)
    ) {
      (result as any)[key] = deepMerge(tVal, sVal);
    } else if (sVal !== undefined) {
      (result as any)[key] = sVal;
    }
  }
  return result;
}

export interface DynamicSiteConfigResult {
  site: typeof siteConfig;
  profile: typeof profileConfig;
  music: typeof musicConfig & { tracks?: TrackDescriptor[] };
  announcement: typeof announcementConfig;
}

let cachedPromise: Promise<DynamicSiteConfigResult> | null = null;
let cachedTime = 0;
const CACHE_TTL_MS = 2000;

export async function getDynamicSiteConfig(): Promise<DynamicSiteConfigResult> {
  const now = Date.now();
  if (cachedPromise && now - cachedTime < CACHE_TTL_MS) {
    return cachedPromise;
  }

  cachedTime = now;
  cachedPromise = (async () => {
    const rawBase = (import.meta.env.PUBLIC_API_URL || "http://localhost:11498/api").replace(/\/$/, "");
    const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;
    try {
      const res = await fetch(`${apiBase}/config/site`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json.config;
        if (json.success && data) {
          return {
            site: deepMerge(siteConfig, data.site || {}),
            profile: deepMerge(profileConfig, data.profile || {}),
            music: deepMerge(musicConfig, data.music || {}),
            announcement: deepMerge(announcementConfig, data.announcement || {}),
          };
        }
      }
    } catch {}

    return {
      site: siteConfig,
      profile: profileConfig,
      music: musicConfig,
      announcement: announcementConfig,
    };
  })();

  return cachedPromise;
}
