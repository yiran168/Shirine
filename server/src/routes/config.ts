import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { requireAdmin } from "../core/middleware";
import { sanitizeR2Url } from "../utils/url";

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
    publicR2Url: "",
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
    links: [
      { text: "GitHub", url: "https://github.com/yiran168/Shirine", external: true, enable: true },
      { text: "Steam", url: "https://store.steampowered.com", external: true, enable: true },
      { text: "Facebook", url: "https://www.facebook.com", external: true, enable: true },
    ],
    link: {
      enable: true,
      text: "GitHub",
      url: "https://github.com/yiran168/Shirine",
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
  compass: [
    {
      key: "dev",
      name: "Development",
      icon: "material-symbols:code-rounded",
      blurb: "Sites I keep open while writing code",
      entries: [
        {
          label: "GitHub",
          href: "https://github.com",
          note: "Code hosting & collaboration",
          icon: "fa6-brands:github",
        },
        {
          label: "MDN",
          href: "https://developer.mozilla.org",
          note: "Authoritative web docs",
          icon: "material-symbols:menu-book-rounded",
        },
        {
          label: "Stack Overflow",
          href: "https://stackoverflow.com",
          note: "Q&A and debugging",
          icon: "fa6-brands:stack-overflow",
        },
      ],
    },
    {
      key: "design",
      name: "Design",
      icon: "material-symbols:palette-outline-rounded",
      blurb: "Colors, icons and inspiration",
      entries: [
        {
          label: "Iconify",
          href: "https://icon-sets.iconify.design",
          note: "Searchable open-source icon sets",
        },
        {
          label: "Material Symbols",
          href: "https://fonts.google.com/icons",
          note: "Official M3 icon set",
          icon: "material-symbols:star-rounded",
        },
        {
          label: "Excalidraw",
          href: "https://excalidraw.com",
          note: "Hand-drawn whiteboard collaboration",
        },
      ],
    },
    {
      key: "tools",
      name: "Tools",
      icon: "material-symbols:build-outline-rounded",
      entries: [
        {
          label: "Squoosh",
          href: "https://squoosh.app",
          note: "Image compression & conversion",
        },
        {
          label: "Regex101",
          href: "https://regex101.com",
          note: "Regex testing & debugging",
        },
      ],
    },
    {
      key: "reads",
      name: "Reading",
      icon: "material-symbols:auto-stories-outline-rounded",
      entries: [
        { label: "Hacker News", href: "https://news.ycombinator.com" },
        { label: "V2EX", href: "https://www.v2ex.com" },
        {
          label: "Solidot",
          href: "https://www.solidot.org",
          note: "Tech and culture news",
        },
      ],
    },
  ],
  anime: [
    {
      title: "Lycoris Recoil",
      cover: "/assets/anime/lkls.webp",
      link: "https://www.bilibili.com/bangumi/media/md28338623",
      status: "completed",
      rating: 9.8,
      progress: { watched: 12, total: 12 },
      description: "Girl's gunfight",
      year: "2022",
      studio: "A-1 Pictures",
      genres: ["Action", "Slice of Life"],
      period: { start: "2022-07", end: "2022-09" },
    },
    {
      title: "Yowamushi Pedal",
      cover: "/assets/anime/rynh.webp",
      link: "https://www.bilibili.com/bangumi/media/md2590",
      status: "watching",
      rating: 9.5,
      progress: { watched: 8, total: 12 },
      description: "Girl's daily life, sweet and healing",
      year: "2015",
      studio: "Nexus",
      genres: ["Daily life", "Healing"],
      period: { start: "2015-07", end: "2015-09" },
    },
    {
      title: "Asteroid in Love",
      cover: "/assets/anime/laxxx.webp",
      link: "https://www.bilibili.com/bangumi/media/md28224128",
      status: "watching",
      rating: 9.2,
      progress: { watched: 5, total: 12 },
      description: "Meeting girls among the stars, pure love and healing",
      year: "2020",
      studio: "Doga Kobo",
      genres: ["Romance", "Healing"],
      period: { start: "2020-01", end: "2020-03" },
    },
    {
      title: "Is the Order a Rabbit?",
      cover: "/assets/anime/tz1.webp",
      link: "https://www.bilibili.com/bangumi/media/md2762",
      status: "planned",
      rating: 9.0,
      progress: { watched: 12, total: 12 },
      description: "A group of girls' warm daily life",
      year: "2014",
      studio: "White Fox",
      genres: ["Daily life", "Healing"],
      period: { start: "2014-04", end: "2014-06" },
    },
    {
      title: "The Secret of the Magic Girl",
      cover: "/assets/anime/cmmn.webp",
      link: "https://www.bilibili.com/bangumi/media/md26625039",
      status: "watching",
      rating: 9.0,
      progress: { watched: 8, total: 12 },
      description: "Muli, Muli!",
      year: "2024",
      studio: "C2C",
      genres: ["Daily life", "Healing", "Magic"],
      period: { start: "2025-07", end: "2025-10" },
    },
  ],
  projects: [
    {
      key: "shirine",
      title: "Shirine",
      summary: "An Astro blog theme shaped around an M3E component system, expressive content, and resilient client navigation.",
      category: "theme",
      phase: "building",
      technologies: ["Astro", "Svelte", "TypeScript", "Tailwind CSS"],
      icon: "material-symbols:deployed-code-outline-rounded",
      cover: "/assets/projects/shirine.webp",
      coverAlt: "Shirine theme homepage preview",
      featured: true,
      repository: "https://github.com/yiran168/Shirine",
      year: "2026",
      enable: true,
    },
    {
      key: "folkpatch",
      title: "FolkPatch",
      summary: "A kernel-level root solution for Android, built on APatch.",
      category: "android",
      phase: "building",
      technologies: ["Kotlin", "APatch", "Android"],
      icon: "material-symbols:terminal-rounded",
      repository: "https://github.com/LyraVoid/FolkPatch",
      year: "2025",
      enable: true,
    },
    {
      key: "kernelpatch",
      title: "KernelPatch",
      summary: "A kernel patch framework that powers APatch-style root on Android by loading code into the running kernel.",
      category: "android",
      phase: "shipped",
      technologies: ["C", "Linux Kernel", "Android"],
      icon: "material-symbols:extension-outline-rounded",
      repository: "https://github.com/lyravoid/KernelPatch",
      year: "2024",
      enable: true,
    },
  ],
  devices: [
    {
      id: "macbook-pro-16",
      name: 'MacBook Pro 16"',
      brand: "Apple",
      category: "desk",
      status: "active",
      specs: "M3 Max / 64GB / 2TB",
      description: "Primary workstation for development, design, and heavy rendering workloads.",
      icon: "material-symbols:laptop-mac-rounded",
      featured: true,
      year: "2024",
      link: "https://www.apple.com/macbook-pro/",
      enable: true,
    },
    {
      id: "iphone-16-pro",
      name: "iPhone 16 Pro",
      brand: "Apple",
      category: "mobile",
      status: "active",
      specs: "Natural Titanium / 256GB",
      description: "Daily driver smartphone with outstanding cameras and a smooth 120Hz ProMotion display.",
      icon: "material-symbols:phone-iphone",
      featured: true,
      year: "2024",
      enable: true,
    },
    {
      id: "sony-wh1000xm5",
      name: "Sony WH-1000XM5",
      brand: "Sony",
      category: "audio",
      status: "active",
      specs: "Silver / ANC / LDAC",
      description: "Industry-leading noise-canceling headphones for immersive coding sessions and travels.",
      icon: "material-symbols:headphones-rounded",
      year: "2023",
      enable: true,
    },
    {
      id: "custom-keyboard-75",
      name: "Custom 75% Mechanical Keyboard",
      brand: "Custom",
      category: "peripheral",
      status: "active",
      specs: "Anodized Aluminum / Linear Switches",
      description: "Custom gasket-mounted keyboard tuned for deep, quiet typing acoustics.",
      icon: "material-symbols:keyboard-outline-rounded",
      year: "2025",
      enable: true,
    },
    {
      id: "ipad-pro-11",
      name: 'iPad Pro 11"',
      brand: "Apple",
      category: "mobile",
      status: "backup",
      specs: "Space Gray / 128GB",
      description: "Secondary mobile screen and digital notepad for sketching ideas and reading papers.",
      icon: "material-symbols:tablet-mac-rounded",
      year: "2021",
      enable: true,
    },
  ],
  skills: [
    { name: "JavaScript", description: "ES2020+ syntax, async plumbing, and event-driven browser code.", icon: "simple-icons:javascript", category: "frontend", level: "advanced", enable: true },
    { name: "TypeScript", description: "Typed application code and maintainable contracts.", icon: "simple-icons:typescript", category: "frontend", level: "expert", enable: true },
    { name: "Astro", description: "Content-focused sites with fast server-rendered output.", icon: "simple-icons:astro", category: "frontend", level: "advanced", enable: true },
    { name: "Svelte", description: "Focused interactive islands and component systems.", icon: "simple-icons:svelte", category: "frontend", level: "advanced", enable: true },
    { name: "React", description: "Composable component trees with hooks and client state.", icon: "simple-icons:react", category: "frontend", level: "intermediate", enable: true },
    { name: "Vue", description: "Progressive component authoring for rapid single-page apps.", icon: "simple-icons:vuedotjs", category: "frontend", level: "intermediate", enable: true },
    { name: "Tailwind CSS", description: "Utility-first styling for rapidly composed interfaces.", icon: "simple-icons:tailwindcss", category: "frontend", level: "advanced", enable: true },
    { name: "Sass", description: "Nesting, variables, and mixins for maintainable stylesheets.", icon: "simple-icons:sass", category: "frontend", level: "intermediate", enable: true },
    { name: "Node.js", description: "Build tooling, services, and content pipelines.", icon: "simple-icons:nodedotjs", category: "backend", level: "advanced", enable: true },
    { name: "Python", description: "Scripting, data wrangling, and service automation.", icon: "simple-icons:python", category: "backend", level: "intermediate", enable: true },
    { name: "Java", description: "Typed OO code for larger service and tooling layers.", icon: "simple-icons:openjdk", category: "backend", level: "intermediate", enable: true },
    { name: "Go", description: "Concurrent services and small high-performance tools.", icon: "simple-icons:go", category: "backend", level: "beginner", enable: true },
    { name: "Rust", description: "Memory-safe systems code and performance-critical paths.", icon: "simple-icons:rust", category: "backend", level: "beginner", enable: true },
    { name: "C++", description: "Native modules and performance-sensitive components.", icon: "simple-icons:cplusplus", category: "backend", level: "beginner", enable: true },
    { name: "C", description: "Low-level systems work close to the runtime.", icon: "simple-icons:c", category: "backend", level: "beginner", enable: true },
    { name: "Playwright", description: "User-facing regression and accessibility testing.", icon: "simple-icons:playwright", category: "tooling", level: "advanced", enable: true },
  ],
  timeline: [
    {
      title: "Shirine Theme M3E Major Architecture Upgrade",
      date: "2026.08",
      category: "milestone",
      subtitle: "Open Source Project",
      description:
        "Refactored the entire blog theme into a Material 3 Expressive atomic component system with token-driven styling, complete keyboard navigation, and full accessibility compliance.",
      highlights: [
        "Implemented dynamic HCT palette calculation and state layer tokens",
        "Added multi-page capabilities: Timeline, Skills, Projects, and Protected Albums",
        "Zero-error strict type-checking and automated visual regression locks",
      ],
      tags: ["Astro", "Svelte 5", "M3E", "Tailwind 4"],
      links: [
        {
          label: "GitHub Repository",
          url: "https://github.com/yiran168/Shirine",
          icon: "fa6-brands:github",
        },
      ],
      icon: "material-symbols:rocket-launch-rounded",
      featured: true,
      enable: true,
    },
    {
      title: "Senior Frontend Engineer",
      date: "2025.03 – Present",
      category: "career",
      subtitle: "Technology Lab",
      location: "Tokyo, Japan",
      description:
        "Leading frontend architecture, web performance optimization, and interactive design system development for modern web platforms.",
      highlights: [
        "Spearheaded design system unification across web products",
        "Reduced core bundle load times by 40% using modern SSR and asset pipelines",
      ],
      tags: ["TypeScript", "Architecture", "Performance", "Design System"],
      icon: "material-symbols:work-rounded",
      featured: true,
      enable: true,
    },
    {
      title: "Full-Stack Web Application Launch",
      date: "2024.11",
      category: "project",
      subtitle: "Independent Creation",
      description:
        "Designed and built an end-to-end creative workflow application with real-time collaboration and cloud synchronization.",
      highlights: [
        "Designed intuitive fluid canvas interface with low-latency interaction",
        "Built serverless backend APIs with edge caching and relational persistence",
      ],
      tags: ["Svelte", "Node.js", "PostgreSQL", "Cloudflare"],
      icon: "material-symbols:deployed-code-outline-rounded",
      enable: true,
    },
    {
      title: "Computer Science & Engineering Degree",
      date: "2020.09 – 2024.06",
      category: "education",
      subtitle: "University of Technology",
      location: "Hangzhou, China",
      description:
        "Focused on computer systems, software engineering, human-computer interaction, and distributed architectures.",
      highlights: [
        "Graduated with honors and outstanding graduate thesis award",
        "Led university open source student community and hackathons",
      ],
      tags: ["Computer Science", "Algorithms", "Software Engineering"],
      icon: "material-symbols:school-rounded",
      enable: true,
    },
    {
      title: "Started Personal Blog & Tech Notes",
      date: "2022.04",
      category: "life",
      subtitle: "First Step into Tech Writing",
      description:
        "Published my first article online and began documenting frontend exploration, creative coding, and personal reflections.",
      tags: ["Blogging", "Writing", "Open Web"],
      icon: "material-symbols:edit-note-rounded",
      enable: true,
    },
  ],
  friendApplyInfo: {
    name: "Shirine",
    url: "https://github.com/yiran168/Shirine",
    avatar: "/assets/images/demo-avatar.webp",
    desc: "The rain remembers what the sky forgot to say.",
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
    lang: "zh_CN",
    model: "/pio/models/NOIR/noir.model3.json",
    models: [
      { name: "NOIR", url: "/pio/models/NOIR/noir.model3.json" },
      { name: "Shizuku", url: "https://cdn.jsdelivr.net/gh/fghrsh/live2d_api/model/shizuku/index.json" },
      { name: "Koharu", url: "https://cdn.jsdelivr.net/gh/fghrsh/live2d_api/model/koharu/index.json" },
    ],
    quotes: [
      "欢迎来到 Shirine！",
      "今天也是美好的一天～",
      "有什么想和我聊聊的吗？",
      "看文章累了就伸个懒腰吧！",
      "点击右下角按钮可以返回顶部哦～",
      "我会一直在这里陪着你的！",
    ],
  },
  ai_config: {
    apiUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  },
  publicR2Url: "",
};

export function deepMerge<T extends Record<string, any>>(target: T, source: any): T {
  if (source === undefined || source === null) return target;
  if (Array.isArray(source)) return source as unknown as T;
  if (Array.isArray(target)) return (Array.isArray(source) ? source : target) as unknown as T;
  if (typeof source !== "object" || typeof target !== "object") return source;
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
    const r2Row = await db.query.siteConfigs.findFirst({
      where: eq(schema.siteConfigs.key, "publicR2Url"),
    });
    let customPublicR2Url = "";
    if (r2Row && r2Row.value !== undefined && r2Row.value !== null) {
      try {
        const parsed = JSON.parse(r2Row.value);
        customPublicR2Url = typeof parsed === "string" ? parsed : (parsed?.url || parsed?.publicR2Url || String(r2Row.value));
      } catch {
        customPublicR2Url = String(r2Row.value);
      }
      customPublicR2Url = sanitizeR2Url(customPublicR2Url);
    } else {
      const candidate =
        (typeof (merged as any).publicR2Url === "string" ? (merged as any).publicR2Url : "") ||
        (typeof flatSite.publicR2Url === "string" ? flatSite.publicR2Url : "");
      customPublicR2Url = sanitizeR2Url(candidate);
    }

    const fallbackR2Url = (c.env.PUBLIC_R2_URL || "https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev").trim().replace(/\/+$/, "");
    const effectivePublicR2Url = customPublicR2Url || fallbackR2Url;

    const responseData = {
      ...flatSite,
      ...merged,
      publicR2Url: customPublicR2Url,
      effectivePublicR2Url,
      fallbackR2Url,
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
      publicR2Url: c.env.PUBLIC_R2_URL || "",
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
  // Auto-prefix domains like store.steampowered.com, facebook.com, github.com
  if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(trimmed)) {
    return "https://" + trimmed;
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
      "lang" in body ||
      "defaultLang" in body ||
      "themeHue" in body ||
      "themeStyle" in body ||
      "topAppBarAlign" in body ||
      "wallpaperMode" in body ||
      "texturePreset" in body ||
      "textureOpacity" in body ||
      "textureAllowMotion" in body ||
      "bannerDesktop" in body ||
      "bannerMobile" in body ||
      "bannerSubtitles" in body ||
      "publicR2Url" in body
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
      if (body.lang !== undefined || body.defaultLang !== undefined) {
        siteUpdates.lang = body.lang || body.defaultLang;
      }
      if (body.themeHue !== undefined || body.themeStyle !== undefined) {
        const existingTheme = baseSite.themeColor || {};
        const hueNum = body.themeHue !== undefined ? Number(body.themeHue) : existingTheme.hue;
        siteUpdates.themeColor = {
          ...existingTheme,
          hue: Number.isFinite(hueNum) ? hueNum : 315,
          style: body.themeStyle || existingTheme.style || "tonalSpot",
        };
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

      if (body.publicR2Url !== undefined) {
        siteUpdates.publicR2Url = sanitizeR2Url(body.publicR2Url);
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

    // 1.5 publicR2Url standalone update (persisted directly to D1 site_configs and system_configs)
    if ("publicR2Url" in body) {
      const publicR2Url = sanitizeR2Url(body.publicR2Url);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "publicR2Url",
          value: JSON.stringify(publicR2Url),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(publicR2Url), updatedAt: new Date() },
        });

      await db
        .insert(schema.systemConfigs)
        .values({
          key: "publicR2Url",
          value: JSON.stringify(publicR2Url),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(publicR2Url), updatedAt: new Date() },
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
    if (
      "announcementTitle" in body ||
      "announcementContent" in body ||
      "announcementLinkText" in body ||
      "announcementLinkUrl" in body ||
      "announcementEnable" in body ||
      "announcementLinks" in body
    ) {
      const annUpdates: Record<string, any> = {};
      if (body.announcementEnable !== undefined) annUpdates.enable = Boolean(body.announcementEnable);
      if (body.announcementTitle !== undefined) annUpdates.title = body.announcementTitle;
      if (body.announcementContent !== undefined) annUpdates.content = body.announcementContent;
      if (body.announcementLinks !== undefined && Array.isArray(body.announcementLinks)) {
        annUpdates.links = body.announcementLinks
          .map((l: any) => ({
            text: String(l.text || "").trim(),
            url: sanitizeUrl(l.url),
            external: true,
            enable: l.enable !== false,
          }))
          .filter((l: any) => l.text && l.url && l.url !== "#");
        if (annUpdates.links.length > 0) {
          annUpdates.link = {
            enable: true,
            text: annUpdates.links[0].text,
            url: annUpdates.links[0].url,
          };
        }
      }
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

    // 5. Compass updates
    if ("compass" in body && Array.isArray(body.compass)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "compass",
          value: JSON.stringify(body.compass),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.compass), updatedAt: new Date() },
        });
    }

    // 6. Anime updates
    if ("anime" in body && Array.isArray(body.anime)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "anime",
          value: JSON.stringify(body.anime),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.anime), updatedAt: new Date() },
        });
    }

    // 7. Projects updates
    if ("projects" in body && Array.isArray(body.projects)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "projects",
          value: JSON.stringify(body.projects),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.projects), updatedAt: new Date() },
        });
    }

    // 8. Devices updates
    if ("devices" in body && Array.isArray(body.devices)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "devices",
          value: JSON.stringify(body.devices),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.devices), updatedAt: new Date() },
        });
    }

    // 9. Skills updates
    if ("skills" in body && Array.isArray(body.skills)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "skills",
          value: JSON.stringify(body.skills),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.skills), updatedAt: new Date() },
        });
    }

    // 10. Friend Apply Info updates
    if ("friendApplyInfo" in body && typeof body.friendApplyInfo === "object" && body.friendApplyInfo !== null) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "friendApplyInfo",
          value: JSON.stringify(body.friendApplyInfo),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.friendApplyInfo), updatedAt: new Date() },
        });
    }

    // 11. Timeline updates
    if ("timeline" in body && Array.isArray(body.timeline)) {
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "timeline",
          value: JSON.stringify(body.timeline),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(body.timeline), updatedAt: new Date() },
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
      const standardDomainKeys = ["site", "profile", "music", "announcement", "sidebar", "footer"];
      for (const [key, val] of Object.entries(body)) {
        if (!standardDomainKeys.includes(key) || !(key in defaultSiteConfig)) continue;
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
      live2dModel: sys.live2d?.model || defaultSystemConfig.live2d.model,
      live2dLang: sys.live2d?.lang || "zh_CN",
      live2dModels: sys.live2d?.models || defaultSystemConfig.live2d.models,
      live2dQuotes: sys.live2d?.quotes || defaultSystemConfig.live2d.quotes,
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
    const aiConfig = (sys as any).ai_config || defaultSystemConfig.ai_config;
    const hasAiSecret = Boolean(aiConfig.apiKey);

    const r2Row = await db.query.siteConfigs.findFirst({
      where: eq(schema.siteConfigs.key, "publicR2Url"),
    });
    let customPublicR2Url = "";
    if (r2Row && r2Row.value !== undefined && r2Row.value !== null) {
      try {
        const parsed = JSON.parse(r2Row.value);
        customPublicR2Url = typeof parsed === "string" ? parsed : (parsed?.url || parsed?.publicR2Url || String(r2Row.value));
      } catch {
        customPublicR2Url = String(r2Row.value);
      }
      customPublicR2Url = sanitizeR2Url(customPublicR2Url);
    } else {
      const candidate = (sys as any).publicR2Url || "";
      customPublicR2Url = sanitizeR2Url(candidate);
    }

    const fallbackR2Url = (c.env.PUBLIC_R2_URL || "https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev").trim().replace(/\/+$/, "");
    const effectivePublicR2Url = customPublicR2Url || fallbackR2Url;

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
      ai_config: {
        apiUrl: aiConfig.apiUrl,
        apiKey: hasAiSecret ? "••••••••" : "",
        model: aiConfig.model,
      },
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
      live2dLang: sys.live2d?.lang || "zh_CN",
      live2dModels: sys.live2d?.models || defaultSystemConfig.live2d.models,
      live2dQuotes: sys.live2d?.quotes || defaultSystemConfig.live2d.quotes,
      aiApiUrl: aiConfig.apiUrl || "https://api.openai.com/v1",
      aiApiKey: hasAiSecret ? "••••••••" : "",
      aiModel: aiConfig.model || "gpt-4o-mini",
      defaultLang: sys.i18n?.defaultLang || "zh_CN",
      publicR2Url: customPublicR2Url,
      effectivePublicR2Url,
      fallbackR2Url,
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
      "live2dModel" in body ||
      "live2dLang" in body ||
      "live2dModels" in body ||
      "live2dQuotes" in body;
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
      const live2dQuotes =
        Array.isArray(body.live2dQuotes)
          ? body.live2dQuotes
          : typeof body.live2dQuotes === "string"
          ? body.live2dQuotes.split("\n").map((s: string) => s.trim()).filter(Boolean)
          : baseLive2d.quotes;
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
        lang: body.live2dLang || baseLive2d.lang || "zh_CN",
        models: Array.isArray(body.live2dModels) ? body.live2dModels : baseLive2d.models,
        quotes: live2dQuotes,
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

    // 5. ai_config: only if AI fields appear in payload
    const hasAi =
      "aiApiUrl" in body ||
      "aiApiKey" in body ||
      "aiModel" in body ||
      "ai_config" in body;
    if (hasAi) {
      const existingAiRow = await db.query.systemConfigs.findFirst({
        where: eq(schema.systemConfigs.key, "ai_config"),
      });
      let baseAi = defaultSystemConfig.ai_config;
      if (existingAiRow) {
        try {
          baseAi = { ...baseAi, ...JSON.parse(existingAiRow.value) };
        } catch {}
      }

      let apiKeyToSave = baseAi.apiKey || "";
      if (body.aiApiKey && body.aiApiKey !== "••••••••") {
        apiKeyToSave = body.aiApiKey.trim();
      } else if (body.ai_config?.apiKey && body.ai_config.apiKey !== "••••••••") {
        apiKeyToSave = body.ai_config.apiKey.trim();
      }

      const aiConfig = {
        apiUrl: body.aiApiUrl !== undefined ? body.aiApiUrl.trim() : (body.ai_config?.apiUrl || baseAi.apiUrl),
        apiKey: apiKeyToSave,
        model: body.aiModel !== undefined ? body.aiModel.trim() : (body.ai_config?.model || baseAi.model),
      };

      await db
        .insert(schema.systemConfigs)
        .values({
          key: "ai_config",
          value: JSON.stringify(aiConfig),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(aiConfig), updatedAt: new Date() },
        });
    }

    // 6. publicR2Url: persist custom R2 public domain to D1 site_configs and system_configs
    if ("publicR2Url" in body) {
      const publicR2Url = sanitizeR2Url(body.publicR2Url);
      await db
        .insert(schema.siteConfigs)
        .values({
          key: "publicR2Url",
          value: JSON.stringify(publicR2Url),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteConfigs.key,
          set: { value: JSON.stringify(publicR2Url), updatedAt: new Date() },
        });

      await db
        .insert(schema.systemConfigs)
        .values({
          key: "publicR2Url",
          value: JSON.stringify(publicR2Url),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemConfigs.key,
          set: { value: JSON.stringify(publicR2Url), updatedAt: new Date() },
        });

      // Synchronize siteConfigs 'site' row as well if it exists
      const existingSiteRow = await db.query.siteConfigs.findFirst({
        where: eq(schema.siteConfigs.key, "site"),
      });
      if (existingSiteRow) {
        try {
          const parsed = JSON.parse(existingSiteRow.value);
          parsed.publicR2Url = publicR2Url;
          await db
            .update(schema.siteConfigs)
            .set({ value: JSON.stringify(parsed), updatedAt: new Date() })
            .where(eq(schema.siteConfigs.key, "site"));
        } catch {}
      }
    }

    if (hasCheckin || hasTurnstile || hasLive2d || ("defaultLang" in body) || hasAi || ("publicR2Url" in body)) {
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
