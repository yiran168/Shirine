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
        desktop: ["/assets/banner/1.webp"],
        mobile: ["/assets/banner/1.webp"],
      },
      position: "center",
      dim: { enable: true, opacity: 0.24 },
      homeText: {
        enable: true,
        title: "Shirine",
        subtitle: [
          "唯美、灵动与自由的记忆碎片",
          "Every moment is worth remembering",
          "今でもあなたは私の光",
          "君と話すと、なんか毎日がちょっと楽しくなるんだ",
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
    avatar: "/assets/avatar/avatar.webp",
    name: "Shirine",
    bio: "Love & Freedom. Coding with anime aesthetics.",
    links: [
      {
        name: "GitHub",
        icon: "fa6-brands:github",
        url: "https://github.com/yiran168/Shirine",
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

    return c.json({
      success: true,
      data: merged,
      config: merged, // Backward compatibility (#22)
    });
  } catch (err: any) {
    return c.json({
      success: true,
      data: defaultSiteConfig,
      config: defaultSiteConfig,
    });
  }
});

// Admin: Save Site Configs (supports both domain updates and flat admin form #23, #76)
configRouter.put("/site", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();

    // Check if flat fields from admin settings are submitted
    if ("title" in body || "subtitle" in body || "themeHue" in body || "topAppBarAlign" in body) {
      const siteUpdates: Record<string, any> = {};
      if (body.title !== undefined) siteUpdates.title = body.title;
      if (body.subtitle !== undefined) siteUpdates.subtitle = body.subtitle;
      if (body.themeHue !== undefined) siteUpdates.themeColor = { hue: Number(body.themeHue) || 315 };
      if (body.topAppBarAlign !== undefined) siteUpdates.topAppBar = { contentAlign: body.topAppBarAlign };

      const existingRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      let baseSite = defaultSiteConfig.site;
      if (existingRow) {
        try {
          baseSite = deepMerge(defaultSiteConfig.site, JSON.parse(existingRow.value));
        } catch {}
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

    // Check if domain updates are submitted
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
    } else if (body.site || body.profile || body.sidebar || body.footer) {
      // Domain-structured full object
      for (const [key, val] of Object.entries(body)) {
        const defaultDomain = (defaultSiteConfig as any)[key] || {};
        const mergedVal = deepMerge(defaultDomain, val);
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
    return c.json({
      success: true,
      data: {
        turnstileEnabled: false,
        turnstileSiteKey: "",
        defaultLang: "zh_CN",
        live2dGuestEnabled: true,
      },
    });
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

    const adminSys = {
      checkin_rule: sys.checkin_rule,
      turnstile: {
        enabled: sys.turnstile.enabled,
        siteKey: sys.turnstile.siteKey,
        configured: Boolean(sys.turnstile.secretKey),
        // Mask secretKey if configured (#80)
        secretKey: sys.turnstile.secretKey ? "••••••••" : "",
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
      turnstileSecretKey: sys.turnstile?.secretKey ? "••••••••" : "",
      live2dGuestEnable: sys.live2d?.guestEnabled ?? true,
      live2dAdminEnable: sys.live2d?.adminEnabled ?? true,
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

// Admin: Save System Configs (supports flat admin form #22, #79)
configRouter.put("/system", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json();

    // If flat fields from AdminDashboard.svelte are submitted
    if (
      "checkinMode" in body ||
      "checkinFixedPoints" in body ||
      "turnstileEnable" in body ||
      "live2dGuestEnable" in body
    ) {
      // 1. checkin_rule
      const checkinRule = {
        mode: body.checkinMode || "fixed",
        fixedPoints: Math.max(0, parseInt(body.checkinFixedPoints) || 10),
        randomMin: Math.max(1, parseInt(body.checkinRandomMin) || 5),
        randomMax: Math.max(1, parseInt(body.checkinRandomMax) || 20),
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

      // 2. turnstile (preserve secret if masked placeholder is sent)
      const existingTurnstileRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "turnstile"),
      });
      let existingTurnstileSecret = "";
      if (existingTurnstileRow) {
        try {
          existingTurnstileSecret = JSON.parse(existingTurnstileRow.value).secretKey || "";
        } catch {}
      }

      let secretKeyToSave = existingTurnstileSecret;
      if (body.turnstileSecretKey && body.turnstileSecretKey !== "••••••••") {
        secretKeyToSave = body.turnstileSecretKey.trim();
      }

      const turnstileConfig = {
        enabled: Boolean(body.turnstileEnable),
        siteKey: body.turnstileSiteKey?.trim() || "",
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

      // 3. live2d
      const live2dConfig = {
        guestEnabled: body.live2dGuestEnable !== undefined ? Boolean(body.live2dGuestEnable) : true,
        adminEnabled: body.live2dAdminEnable !== undefined ? Boolean(body.live2dAdminEnable) : true,
        model: defaultSystemConfig.live2d.model,
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
