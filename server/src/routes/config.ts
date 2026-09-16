import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Default Site Configs (Material 3 Expressive Dynamic Theme)
export const defaultSiteConfig = {
  site: {
    site: "https://shirine.pages.dev",
    base: "/",
    title: "Shirine",
    subtitle: "A Material 3 Expressive dynamic blog",
    lang: "zh_CN",
    timeZone: "Asia/Shanghai",
    topAppBar: { contentAlign: "center" },
    displaySettings: {
      colorStyle: true,
      colorSpec: true,
      wallpaperMode: true,
      layoutMode: true,
      reduceMotion: true,
      texture: true,
    },
    themeColor: {
      hue: 315,
      fixed: false,
      style: "tonalSpot",
      spec: "2025",
    },
    wallpaperMode: { defaultMode: "banner" },
    texture: {
      enable: true,
      defaultPreset: "starlight",
      defaultOpacity: 0.12,
      allowMotion: true,
    },
    banner: {
      src: {
        desktop: ["/assets/images/banner/desktop/1.webp"],
        mobile: ["/assets/images/banner/mobile/1.webp"],
      },
      position: "center",
      dim: { enable: true, opacity: 0.24 },
      homeText: {
        enable: true,
        title: "Shirine",
        subtitle: [
          "特別なことはないけど、君がいると十分です",
          "今でもあなたは私の光",
          "君ってさ、知らないうちに我的毎日になってたよ",
          "君と話すと、なんか毎日がちょっと楽しくなるんだ",
          "今日はなんでもない日。でも、ちょっとだけいい日",
        ],
        typewriter: {
          enable: true,
          speed: 100,
          deleteSpeed: 50,
          pauseTime: 2000,
          loop: true,
        },
      },
      carousel: {
        enable: true,
        interval: 6000,
        fadeDuration: 1200,
      },
    },
  },
  profile: {
    avatar: "/assets/images/demo-avatar.webp",
    name: "Shirine",
    bio: "The rain remembers what the sky forgot to say.",
    links: [
      {
        name: "Twitter",
        icon: "fa6-brands:twitter",
        url: "https://twitter.com",
      },
      {
        name: "Steam",
        icon: "fa6-brands:steam",
        url: "https://store.steampowered.com",
      },
      {
        name: "GitHub",
        icon: "fa6-brands:github",
        url: "https://github.com/yiran168/Shirine",
      },
    ],
  },
  announcement: {
    enable: true,
    title: "",
    content: "The only way to do great work is to love what you do",
    link: {
      enable: true,
      text: "GitHub",
      url: "https://github.com",
    },
  },
  music: {
    enable: true,
    provider: "mixed",
    defaultVolume: 0.7,
    defaultMode: "sequence",
    meting: {
      server: "netease",
      type: "playlist",
      id: "14164869977",
    },
    tracks: [
      {
        id: "dazbee",
        title: "口笛で愛は歌えない",
        artist: "Dazbee",
        cover: "/assets/images/music/dazbee.webp",
        source: "/assets/music/url/dazbee.mp3",
        duration: 241,
      },
      {
        id: "hitori",
        title: "ひとり上手",
        artist: "Kaya",
        cover: "/assets/images/music/hitori.webp",
        source: "/assets/music/url/hitori.mp3",
        duration: 253,
      },
      {
        id: "xryx",
        title: "眩耀夜行",
        artist: "スリーズブーケ",
        cover: "/assets/images/music/xryx.webp",
        source: "/assets/music/url/xryx.mp3",
        duration: 245,
      },
      {
        id: "cl",
        title: "春雷の頃",
        artist: "22/7",
        cover: "/assets/images/music/cl.webp",
        source: "/assets/music/url/cl.mp3",
        duration: 242,
      },
    ],
  },
  sidebar: {
    widgets: {
      profile: { enable: true, priority: 1 },
      announcement: {
        enable: true,
        priority: 2,
        title: "公告",
        content: "欢迎来到 Shirine！基于 Cloudflare 全栈架构的唯美动态博客。",
      },
      categories: { enable: true, priority: 3 },
      tags: { enable: true, priority: 4 },
      recentPosts: { enable: true, priority: 5, limit: 5 },
    },
  },
  footer: {
    startYear: 2026,
    enableHtmlInject: false,
    links: [],
  },
};

// Default System Configs
export const defaultSystemConfig = {
  checkin_rule: {
    mode: "fixed", // "fixed" | "random"
    fixedPoints: 10,
    randomMin: 5,
    randomMax: 20,
  },
  turnstile: {
    enabled: false,
    siteKey: "",
    secretKey: "",
  },
  i18n: {
    defaultLang: "zh_CN",
  },
  live2d: {
    guestEnabled: true,
    adminEnabled: true,
    model: "/pio/models/NOIR/noir.model3.json",
  },
};

export function deepMerge<T extends Record<string, any>>(target: T, source: any): T {
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

// GET Site Configs
configRouter.get("/site", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const rows = await db.query.siteConfigs.findMany();

    const merged = { ...defaultSiteConfig };
    for (const row of rows) {
      try {
        const val = JSON.parse(row.value);
        if (row.key in merged) {
          (merged as any)[row.key] = deepMerge((defaultSiteConfig as any)[row.key], val);
        } else {
          (merged as any)[row.key] = val;
        }
      } catch {}
    }

    const flatSite = (merged as any).site || {};
    const responseData = {
      ...flatSite,
      ...merged,
      title: flatSite.title,
      subtitle: flatSite.subtitle,
    };

    return c.json({
      success: true,
      data: responseData,
      config: responseData,
    });
  } catch (err: any) {
    const flatDefault = (defaultSiteConfig as any).site || {};
    const defaultData = {
      ...flatDefault,
      ...defaultSiteConfig,
      title: flatDefault.title,
      subtitle: flatDefault.subtitle,
    };
    return c.json({
      success: true,
      data: defaultData,
      config: defaultData,
    });
  }
});

// URL Sanitizer to prevent javascript: / vbscript: / data: active content injection (V8-P0-16, V10-P0-05)
function sanitizeUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "#";
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return "#";
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  ) {
    return trimmed;
  }
  // Safe relative paths like assets/images/... or ./assets/... (V10-P0-05)
  if (lower.startsWith("assets/") || lower.startsWith("./assets/")) {
    return "/" + trimmed.replace(/^\.\//, "");
  }
  return "#";
}

// Admin: Save Site Configs (supports both domain updates and flat admin form #23, #76)
configRouter.put("/site", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();

    // 1. Check if flat site fields from admin settings are submitted
    if (
      "title" in body ||
      "subtitle" in body ||
      "themeHue" in body ||
      "topAppBarAlign" in body ||
      "wallpaperMode" in body ||
      "texturePreset" in body ||
      "textureOpacity" in body ||
      "textureAllowMotion" in body ||
      "bannerDesktop" in body ||
      "bannerMobile" in body ||
      "bannerSubtitles" in body
    ) {
      const existingRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      let baseSite = defaultSiteConfig.site;
      if (existingRow) {
        try {
          baseSite = deepMerge(defaultSiteConfig.site, JSON.parse(existingRow.value));
        } catch {}
      }

      const siteUpdates: Record<string, any> = {};
      if (body.title !== undefined) siteUpdates.title = body.title;
      if (body.subtitle !== undefined) siteUpdates.subtitle = body.subtitle;
      if (body.themeHue !== undefined) {
        const hueNum = Number(body.themeHue);
        siteUpdates.themeColor = { hue: Number.isFinite(hueNum) ? hueNum : 315 };
      }
      if (body.topAppBarAlign !== undefined) siteUpdates.topAppBar = { contentAlign: body.topAppBarAlign };
      if (body.wallpaperMode !== undefined) siteUpdates.wallpaperMode = { defaultMode: body.wallpaperMode };
      if (body.texturePreset !== undefined || body.textureOpacity !== undefined || body.textureAllowMotion !== undefined || body.allowMotion !== undefined) {
        const opNum = Number(body.textureOpacity);
        const existingAllowMotion = baseSite.texture?.allowMotion ?? true;
        const requestedMotion = body.textureAllowMotion !== undefined
          ? Boolean(body.textureAllowMotion)
          : (body.allowMotion !== undefined ? Boolean(body.allowMotion) : existingAllowMotion);
        siteUpdates.texture = {
          enable: body.texturePreset !== "none",
          defaultPreset: body.texturePreset || baseSite.texture?.defaultPreset || "starlight",
          defaultOpacity: Number.isFinite(opNum) ? opNum : (baseSite.texture?.defaultOpacity ?? 0.12),
          allowMotion: requestedMotion,
        };
      }
      if (body.bannerDesktop !== undefined || body.bannerMobile !== undefined || body.bannerSubtitles !== undefined) {
        siteUpdates.banner = {};
        if (body.bannerDesktop !== undefined) {
          const arr = Array.isArray(body.bannerDesktop) ? body.bannerDesktop : [body.bannerDesktop].filter(Boolean);
          siteUpdates.banner.src = { ...(siteUpdates.banner.src || {}), desktop: arr.map(sanitizeUrl) };
        }
        if (body.bannerMobile !== undefined) {
          const arr = Array.isArray(body.bannerMobile) ? body.bannerMobile : [body.bannerMobile].filter(Boolean);
          siteUpdates.banner.src = { ...(siteUpdates.banner.src || {}), mobile: arr.map(sanitizeUrl) };
        }
        if (body.bannerSubtitles !== undefined) {
          const subs = Array.isArray(body.bannerSubtitles)
            ? body.bannerSubtitles
            : String(body.bannerSubtitles).split("\n").map((s: string) => s.trim()).filter(Boolean);
          siteUpdates.banner.homeText = { subtitle: subs };
        }
      }

      const updatedSite = deepMerge(baseSite, siteUpdates);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "site",
          value: JSON.stringify(updatedSite),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(updatedSite), updatedAt: new Date() },
        });
    }

    // 2. Profile updates
    if ("authorName" in body || "bio" in body || "avatar" in body || "profileLinks" in body) {
      const profileUpdates: Record<string, any> = {};
      if (body.authorName !== undefined) profileUpdates.name = body.authorName;
      if (body.bio !== undefined) profileUpdates.bio = body.bio;
      if (body.avatar !== undefined) profileUpdates.avatar = sanitizeUrl(body.avatar);
      if (body.profileLinks !== undefined && Array.isArray(body.profileLinks)) {
        profileUpdates.links = body.profileLinks.map((item: any) => ({
          name: String(item.name || "").trim().slice(0, 50),
          icon: String(item.icon || "").trim().slice(0, 100),
          url: sanitizeUrl(item.url),
        }));
      }

      const existingProfile = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "profile"),
      });
      let baseProfile = defaultSiteConfig.profile;
      if (existingProfile) {
        try {
          baseProfile = deepMerge(defaultSiteConfig.profile, JSON.parse(existingProfile.value));
        } catch {}
      }
      const updatedProfile = deepMerge(baseProfile, profileUpdates);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "profile",
          value: JSON.stringify(updatedProfile),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(updatedProfile), updatedAt: new Date() },
        });
    }

    // 3. Music updates
    if (
      "musicEnable" in body ||
      "musicProvider" in body ||
      "musicVolume" in body ||
      "musicTracks" in body ||
      "musicMetingId" in body ||
      "musicMetingServer" in body
    ) {
      const musicUpdates: Record<string, any> = {};
      if (body.musicEnable !== undefined) musicUpdates.enable = Boolean(body.musicEnable);
      if (body.musicProvider !== undefined) musicUpdates.provider = body.musicProvider;
      if (body.musicVolume !== undefined) musicUpdates.defaultVolume = Number(body.musicVolume);
      if (body.musicTracks !== undefined && Array.isArray(body.musicTracks)) {
        musicUpdates.tracks = body.musicTracks;
      }
      if (body.musicMetingId !== undefined || body.musicMetingServer !== undefined) {
        musicUpdates.meting = {
          server: body.musicMetingServer || "netease",
          type: "playlist",
          id: String(body.musicMetingId || "14164869977"),
        };
      }

      const existingMusic = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "music"),
      });
      let baseMusic = defaultSiteConfig.music;
      if (existingMusic) {
        try {
          baseMusic = deepMerge(defaultSiteConfig.music, JSON.parse(existingMusic.value));
        } catch {}
      }
      const updatedMusic = deepMerge(baseMusic, musicUpdates);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "music",
          value: JSON.stringify(updatedMusic),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(updatedMusic), updatedAt: new Date() },
        });
    }

    // 4. Announcement updates
    if ("announcementTitle" in body || "announcementContent" in body || "announcementLinkText" in body || "announcementLinkUrl" in body || "announcementEnable" in body) {
      const annUpdates: Record<string, any> = {};
      if (body.announcementEnable !== undefined) annUpdates.enable = Boolean(body.announcementEnable);
      if (body.announcementTitle !== undefined) annUpdates.title = body.announcementTitle;
      if (body.announcementContent !== undefined) annUpdates.content = body.announcementContent;
      if (body.announcementLinkText !== undefined || body.announcementLinkUrl !== undefined) {
        const safeUrl = sanitizeUrl(body.announcementLinkUrl);
        annUpdates.link = {
          enable: Boolean(body.announcementLinkUrl && safeUrl !== "#"),
          text: body.announcementLinkText || "链接",
          url: safeUrl,
        };
      }

      const existingAnn = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "announcement"),
      });
      let baseAnn = defaultSiteConfig.announcement;
      if (existingAnn) {
        try {
          baseAnn = deepMerge(defaultSiteConfig.announcement, JSON.parse(existingAnn.value));
        } catch {}
      }
      const updatedAnn = deepMerge(baseAnn, annUpdates);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "announcement",
          value: JSON.stringify(updatedAnn),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(updatedAnn), updatedAt: new Date() },
        });
    }

    // 5. Domain updates: { domain: "...", config: {...} }
    if (typeof body.domain === "string" && "config" in body) {
      const domainKey = body.domain;
      const defaultDomain = (defaultSiteConfig as any)[domainKey] || {};
      const existingRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, domainKey),
      });
      let baseVal = defaultDomain;
      if (existingRow) {
        try {
          baseVal = deepMerge(defaultDomain, JSON.parse(existingRow.value));
        } catch {}
      }
      const mergedVal = deepMerge(baseVal, body.config);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: domainKey,
          value: JSON.stringify(mergedVal),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(mergedVal), updatedAt: new Date() },
        });
    } else if (body.site || body.profile || body.music || body.announcement || body.sidebar || body.footer) {
      // Domain-structured full object: V10-P0-03 read existing domain before merging to preserve custom fields
      for (const [key, val] of Object.entries(body)) {
        if (!(key in defaultSiteConfig)) continue;
        const defaultDomain = (defaultSiteConfig as any)[key] || {};
        const existingRow = await db.query.siteConfigs.findFirst({
          where: eq(schema.siteConfigs.key, key),
        });
        let baseDomain = defaultDomain;
        if (existingRow) {
          try {
            baseDomain = deepMerge(defaultDomain, JSON.parse(existingRow.value));
          } catch {}
        }
        const mergedVal = deepMerge(baseDomain, val);
        await db
          .insert(schema.siteConfigs)
          .values({
            key,
            value: JSON.stringify(mergedVal),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.siteConfigs.key,
            set: { value: JSON.stringify(mergedVal), updatedAt: new Date() },
          });
      }
    }

    return c.json({ success: true, message: "Site configuration saved successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to save site config" }, 500);
  }
});

// GET Public System Configs (Safe, no secrets #80)
configRouter.get("/system", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const rows = await db.query.systemConfigs.findMany();

    const sys = { ...defaultSystemConfig };
    for (const row of rows) {
      try {
        (sys as any)[row.key] = JSON.parse(row.value);
      } catch {}
    }

    const publicConfig = {
      turnstileEnabled: sys.turnstile.enabled,
      turnstileSiteKey: sys.turnstile.siteKey,
      defaultLang: sys.i18n.defaultLang,
      live2dGuestEnabled: sys.live2d.guestEnabled,
    };

    return c.json({
      success: true,
      data: publicConfig,
      config: publicConfig,
    });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        degraded: true,
        error: "Configuration backend unavailable",
        code: "CONFIG_BACKEND_UNAVAILABLE",
      },
      503
    );
  }
});

// Admin: GET Full System Configs (Secret masked #80)
configRouter.get("/system/admin", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const rows = await db.query.systemConfigs.findMany();

    const sys = { ...defaultSystemConfig };
    for (const row of rows) {
      try {
        (sys as any)[row.key] = JSON.parse(row.value);
      } catch {}
    }

    const hasTurnstileSecret = Boolean(c.env.CF_TURNSTILE_SECRET || sys.turnstile.secretKey);
    const adminSys = {
      checkin_rule: sys.checkin_rule,
      turnstile: {
        enabled: sys.turnstile.enabled,
        siteKey: sys.turnstile.siteKey,
        configured: hasTurnstileSecret,
        // Mask secretKey if configured (#80, V10-P0-01)
        secretKey: hasTurnstileSecret ? "••••••••" : "",
      },
      i18n: sys.i18n,
      live2d: sys.live2d,
      // Flat fields matching AdminDashboard.svelte systemConfigState
      checkinMode: sys.checkin_rule?.mode || "fixed",
      checkinFixedPoints: sys.checkin_rule?.fixedPoints ?? 10,
      checkinRandomMin: sys.checkin_rule?.randomMin ?? 5,
      checkinRandomMax: sys.checkin_rule?.randomMax ?? 20,
      turnstileEnable: sys.turnstile?.enabled ?? false,
      turnstileSiteKey: sys.turnstile?.siteKey || "",
      turnstileSecretKey: hasTurnstileSecret ? "••••••••" : "",
      live2dGuestEnable: sys.live2d?.guestEnabled ?? true,
      live2dAdminEnable: sys.live2d?.adminEnabled ?? true,
      live2dModel: sys.live2d?.model || defaultSystemConfig.live2d.model,
      defaultLang: sys.i18n?.defaultLang || "zh_CN",
    };

    return c.json({
      success: true,
      data: adminSys,
      config: adminSys,
    });
  } catch (err: any) {
    return c.json({ success: true, data: defaultSystemConfig, config: defaultSystemConfig });
  }
});

// Admin: Save System Configs (supports modular partial domain updates: V10-P0-04)
configRouter.put("/system", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();

    // 1. checkin_rule: only if checkin fields appear in payload
    const hasCheckin =
      "checkinMode" in body ||
      "checkinFixedPoints" in body ||
      "checkinRandomMin" in body ||
      "checkinRandomMax" in body;
    if (hasCheckin) {
      const existingRuleRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "checkin_rule"),
      });
      let baseRule = defaultSystemConfig.checkin_rule;
      if (existingRuleRow) {
        try {
          baseRule = { ...baseRule, ...JSON.parse(existingRuleRow.value) };
        } catch {}
      }
      const checkinRule = {
        mode: body.checkinMode !== undefined ? body.checkinMode : baseRule.mode,
        fixedPoints:
          body.checkinFixedPoints !== undefined
            ? Math.max(0, parseInt(body.checkinFixedPoints) || 0)
            : baseRule.fixedPoints,
        randomMin:
          body.checkinRandomMin !== undefined
            ? Math.max(1, parseInt(body.checkinRandomMin) || 1)
            : baseRule.randomMin,
        randomMax:
          body.checkinRandomMax !== undefined
            ? Math.max(1, parseInt(body.checkinRandomMax) || 1)
            : baseRule.randomMax,
      };
      await db
        .insert(schema.systemConfigs)
        .values({
          key: "checkin_rule",
          value: JSON.stringify(checkinRule),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(checkinRule), updatedAt: new Date() },
        });
    }

    // 2. turnstile: only if turnstile fields appear in payload
    const hasTurnstile =
      "turnstileEnable" in body ||
      "turnstileSiteKey" in body ||
      "turnstileSecretKey" in body;
    if (hasTurnstile) {
      const existingTurnstileRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "turnstile"),
      });
      let baseTurnstile = defaultSystemConfig.turnstile;
      if (existingTurnstileRow) {
        try {
          baseTurnstile = { ...baseTurnstile, ...JSON.parse(existingTurnstileRow.value) };
        } catch {}
      }

      let secretKeyToSave = baseTurnstile.secretKey || "";
      if (body.turnstileSecretKey && body.turnstileSecretKey !== "••••••••") {
        secretKeyToSave = body.turnstileSecretKey.trim();
      }

      const turnstileConfig = {
        enabled:
          body.turnstileEnable !== undefined ? Boolean(body.turnstileEnable) : baseTurnstile.enabled,
        siteKey:
          body.turnstileSiteKey !== undefined ? body.turnstileSiteKey.trim() : baseTurnstile.siteKey,
        secretKey: secretKeyToSave,
      };
      await db
        .insert(schema.systemConfigs)
        .values({
          key: "turnstile",
          value: JSON.stringify(turnstileConfig),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(turnstileConfig), updatedAt: new Date() },
        });
    }

    // 3. live2d: only if live2d fields appear in payload
    const hasLive2d =
      "live2dGuestEnable" in body ||
      "live2dAdminEnable" in body ||
      "live2dModel" in body;
    if (hasLive2d) {
      const existingLive2dRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "live2d"),
      });
      let baseLive2d = defaultSystemConfig.live2d;
      if (existingLive2dRow) {
        try {
          baseLive2d = { ...baseLive2d, ...JSON.parse(existingLive2dRow.value) };
        } catch {}
      }
      const live2dModel =
        typeof body.live2dModel === "string" && body.live2dModel.trim()
          ? body.live2dModel.trim()
          : baseLive2d.model;
      const live2dConfig = {
        guestEnabled:
          body.live2dGuestEnable !== undefined
            ? Boolean(body.live2dGuestEnable)
            : baseLive2d.guestEnabled,
        adminEnabled:
          body.live2dAdminEnable !== undefined
            ? Boolean(body.live2dAdminEnable)
            : baseLive2d.adminEnabled,
        model: live2dModel,
      };
      await db
        .insert(schema.systemConfigs)
        .values({
          key: "live2d",
          value: JSON.stringify(live2dConfig),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(live2dConfig), updatedAt: new Date() },
        });
    }

    // 4. i18n: only if defaultLang appears in payload
    if ("defaultLang" in body && body.defaultLang) {
      const i18nConfig = {
        defaultLang: body.defaultLang,
      };
      await db
        .insert(schema.systemConfigs)
        .values({
          key: "i18n",
          value: JSON.stringify(i18nConfig),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(i18nConfig), updatedAt: new Date() },
        });
    }

    if (hasCheckin || hasTurnstile || hasLive2d || ("defaultLang" in body)) {
      return c.json({ success: true, message: "System configuration saved successfully" });
    }

    // Key-value or object save
    if (typeof body.key === "string" && "value" in body) {
      await db
        .insert(schema.systemConfigs)
        .values({
          key: body.key,
          value: JSON.stringify(body.value),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(body.value), updatedAt: new Date() },
        });
    } else {
      for (const [key, val] of Object.entries(body)) {
        await db
          .insert(schema.systemConfigs)
          .values({
            key,
            value: JSON.stringify(val),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.systemConfigs.key,
            set: { value: JSON.stringify(val), updatedAt: new Date() },
          });
      }
    }

    return c.json({ success: true, message: "System configuration saved successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to save system config" }, 500);
  }
});
