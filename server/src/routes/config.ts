import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";

export const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Default Site Configs (Matching Shirone schema with Shirine branding)
const defaultSiteConfig = {
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
          "君と話すと、なんか毎日がちょっと楽しくなるんだ"
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
    avatar: "/assets/avatar.webp",
    name: "Shirine Master",
    bio: "Passionate developer, writer, and dreamer.",
    links: [
      { name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/yiran168/Shirine" },
      { name: "Twitter", icon: "fa6-brands:x-twitter", url: "https://twitter.com" },
    ],
  },
  footer: {
    startYear: 2024,
    author: "Shirine",
    icp: "",
    customHtml: "",
  },
  sidebar: {
    enable: true,
    components: [
      { type: "profile", enable: true },
      { type: "announcement", enable: true },
      { type: "music", enable: true },
      { type: "toc", enable: true },
      { type: "categories", enable: true },
      { type: "tags", enable: true },
      { type: "recent-posts", enable: true },
    ],
  },
  announcement: {
    enable: true,
    content: "欢迎来到 Shirine 动态博客！注册账号即可参与每日签到获取积分，解锁会员专属文章与精美相册！",
    icon: "material-symbols:campaign-outline-rounded",
  },
  music: {
    enable: true,
    metingUrl: "https://api.i-meting.com/meting/api",
    id: "8152976493",
    type: "playlist",
    server: "netease",
  },
};

// Default System Configs
const defaultSystemConfig = {
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

// GET Site Configs
configRouter.get("/site", async (c) => {
  try {
    const db = getDb(c.env.DB);
    const rows = await db.query.siteConfigs.findMany();

    const merged = { ...defaultSiteConfig };
    for (const row of rows) {
      try {
        (merged as any)[row.key] = JSON.parse(row.value);
      } catch {}
    }

    return c.json({ success: true, config: merged });
  } catch (err: any) {
    return c.json({ success: true, config: defaultSiteConfig });
  }
});

// Admin: Save Site Configs
configRouter.put("/site", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json(); // { domain: string, config: any } or full object

    if (body.domain && body.config) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: body.domain,
          value: JSON.stringify(body.config),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.config), updatedAt: new Date() },
        });
    } else {
      // Update multiple domains
      for (const [key, val] of Object.entries(body)) {
        await db
          .insert(schema.siteConfigs)
          .values({
            key,
            value: JSON.stringify(val),
          })
          .onConflictDoUpdate({
            target: schema.siteConfigs.key,
            set: { value: JSON.stringify(val), updatedAt: new Date() },
          });
      }
    }

    return c.json({ success: true, message: "Site configuration saved successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to save site config" }, 500);
  }
});

// GET Public System Configs (Safe, no secrets)
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

    return c.json({
      success: true,
      config: {
        turnstileEnabled: sys.turnstile.enabled,
        turnstileSiteKey: sys.turnstile.siteKey,
        defaultLang: sys.i18n.defaultLang,
        live2dGuestEnabled: sys.live2d.guestEnabled,
      },
    });
  } catch (err: any) {
    return c.json({
      success: true,
      config: {
        turnstileEnabled: false,
        turnstileSiteKey: "",
        defaultLang: "zh_CN",
        live2dGuestEnabled: true,
      },
    });
  }
});

// Admin: GET Full System Configs (Includes secrets)
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

    return c.json({ success: true, config: sys });
  } catch (err: any) {
    return c.json({ success: true, config: defaultSystemConfig });
  }
});

// Admin: Save System Configs
configRouter.put("/system", requireAdmin, async (c) => {
  try {
    const db = getDb(c.env.DB);
    const body = await c.req.json(); // { key: string, value: any } or full object

    if (body.key && body.value) {
      await db
        .insert(schema.systemConfigs)
        .values({
          key: body.key,
          value: JSON.stringify(body.value),
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
