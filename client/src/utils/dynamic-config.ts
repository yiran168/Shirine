import { siteConfig } from "@/config/siteConfig";
import { profileConfig } from "@/config/profileConfig";
import { musicConfig } from "@/config/musicConfig";
import { announcementConfig } from "@/config/announcementConfig";
import { footerConfig } from "@/config/footerConfig";
import type { TrackDescriptor } from "@/types/musicConfig";
import { setSiteLang } from "@/i18n/translation";

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
  music: typeof musicConfig & { tracks?: readonly TrackDescriptor[] | TrackDescriptor[] };
  announcement: typeof announcementConfig;
  footer: typeof footerConfig;
}

let cachedPromise: Promise<DynamicSiteConfigResult> | null = null;
let cachedTime = 0;
const CACHE_TTL_MS = 2000;

export function clearDynamicConfigCache(): void {
  cachedPromise = null;
  cachedTime = 0;
}

export async function getDynamicSiteConfig(request?: Request): Promise<DynamicSiteConfigResult> {
  const now = Date.now();
  if (!request && cachedPromise && now - cachedTime < CACHE_TTL_MS) {
    return cachedPromise;
  }

  const fetchConfig = async (): Promise<DynamicSiteConfigResult> => {
    let apiBase = "";
    if (request?.url) {
      try {
        const origin = new URL(request.url).origin;
        apiBase = `${origin}/api`;
      } catch {}
    }
    if (!apiBase && import.meta.env.PUBLIC_API_URL) {
      const raw = import.meta.env.PUBLIC_API_URL.replace(/\/$/, "");
      apiBase = raw.endsWith("/api") ? raw : `${raw}/api`;
    } else if (!apiBase && typeof window !== "undefined" && window.location) {
      apiBase = `${window.location.origin}/api`;
    } else if (!apiBase) {
      apiBase = "http://127.0.0.1:11498/api";
    }

    try {
      const res = await fetch(`${apiBase}/config/site`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json.config;
        if (json.success && data) {
          const mergedSite = deepMerge(siteConfig, data.site || {});
          if (mergedSite.title && (!mergedSite.banner?.homeText?.title || mergedSite.banner.homeText.title === siteConfig.title)) {
            if (!mergedSite.banner) mergedSite.banner = {} as any;
            if (!mergedSite.banner.homeText) mergedSite.banner.homeText = {} as any;
            mergedSite.banner.homeText.title = mergedSite.title;
          }
          if (mergedSite.lang) {
            setSiteLang(mergedSite.lang);
          }
          return {
            site: mergedSite,
            profile: deepMerge(profileConfig, data.profile || {}),
            music: deepMerge(musicConfig, data.music || {}),
            announcement: deepMerge(announcementConfig, data.announcement || {}),
            footer: deepMerge(footerConfig, data.footer || {}),
          };
        }
      }
    } catch {}

    return {
      site: siteConfig,
      profile: profileConfig,
      music: musicConfig,
      announcement: announcementConfig,
      footer: footerConfig,
    };
  };

  if (!request) {
    cachedTime = now;
    cachedPromise = fetchConfig();
    return cachedPromise;
  }

  return fetchConfig();
}
