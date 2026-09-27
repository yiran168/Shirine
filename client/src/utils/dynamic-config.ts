import { siteConfig } from "@/config/siteConfig";
import { profileConfig } from "@/config/profileConfig";
import { musicConfig } from "@/config/musicConfig";
import { announcementConfig } from "@/config/announcementConfig";
import { footerConfig } from "@/config/footerConfig";
import type { TrackDescriptor } from "@/types/musicConfig";
import { setSiteLang } from "@/i18n/translation";
import { fetchApi } from "./content-utils";

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
const CACHE_TTL_MS = 2500;

export function clearDynamicConfigCache(): void {
  cachedPromise = null;
  cachedTime = 0;
}

export async function getDynamicSiteConfig(request?: Request): Promise<DynamicSiteConfigResult> {
  const now = Date.now();
  if (cachedPromise && now - cachedTime < CACHE_TTL_MS) {
    return cachedPromise;
  }

  const fetchConfig = async (): Promise<DynamicSiteConfigResult> => {
    try {
      const res = await fetchApi("/config/site", request);
      if (res && res.ok) {
        const json = await res.json();
        const data = json.data || json.config;
        if (json.success && data) {
          const rawSite = data.site || {};
          const mergedSite = deepMerge(siteConfig, {
            ...rawSite,
            liquidGlassMode: data.liquidGlassMode || rawSite.liquidGlassMode || siteConfig.liquidGlassMode || "none",
          });
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

  cachedTime = now;
  cachedPromise = fetchConfig();
  return cachedPromise;
}
