import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const POSTS_DIR = path.resolve(ROOT_DIR, "client/src/content/posts");
const MOMENTS_DIR = path.resolve(ROOT_DIR, "client/src/content/moments");
const ALBUMS_DIR = path.resolve(ROOT_DIR, "client/public/images/albums");
const OUTPUT_TS = path.resolve(ROOT_DIR, "server/src/db/seed-data.ts");
const OUTPUT_SQL = path.resolve(ROOT_DIR, "server/src/db/seed.sql");

// Parse simple YAML frontmatter
function parseFrontmatterAndBody(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: fileContent };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentKey = null;
  let isArray = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyValMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyValMatch) {
      const key = keyValMatch[1];
      let val = keyValMatch[2].trim();

      if (val === "" || val === "[]") {
        currentKey = key;
        isArray = true;
        frontmatter[key] = [];
      } else if (val.startsWith("[") && val.endsWith("]")) {
        currentKey = null;
        isArray = false;
        try {
          frontmatter[key] = JSON.parse(val.replace(/'/g, '"'));
        } catch {
          frontmatter[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
        }
      } else {
        currentKey = null;
        isArray = false;
        if (val === "true") frontmatter[key] = true;
        else if (val === "false") frontmatter[key] = false;
        else if (/^\d+$/.test(val)) frontmatter[key] = parseInt(val, 10);
        else frontmatter[key] = val.replace(/^["']|["']$/g, "");
      }
    } else if (trimmed.startsWith("- ") && currentKey && isArray) {
      const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, "");
      frontmatter[currentKey].push(item);
    }
  }

  return { frontmatter, body };
}

// 1. Collect Posts
function collectPosts() {
  const posts = [];

  function scan(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        scan(fullPath);
      } else if (file.name.endsWith(".mdx")) {
        console.warn(`[Seed Generator] Skipping MDX file: ${file.name} to prevent raw component syntax breakdown.`);
      } else if (file.name.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const { frontmatter, body } = parseFrontmatterAndBody(content);

        let slug = path.relative(POSTS_DIR, fullPath).replace(/\\/g, "/").replace(/\.md$/, "");
        if (slug.endsWith("/index")) {
          slug = slug.replace(/\/index$/, "");
        }

        const isEncrypted = Boolean(frontmatter.encrypted || frontmatter.password);
        const draft = frontmatter.draft ? 1 : 0;
        const permissionType = frontmatter.permissionType || (isEncrypted ? "password" : "public");

        posts.push({
          slug,
          alias: frontmatter.alias || null,
          permalink: frontmatter.permalink || null,
          title: frontmatter.title || slug,
          description: frontmatter.description || "",
          content: body.trim(),
          image: frontmatter.image || "",
          category: frontmatter.category || "",
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          lang: frontmatter.lang || "zh_CN",
          pinned: frontmatter.pinned ? 1 : 0,
          draft,
          commentEnabled: frontmatter.comment !== false ? 1 : 0,
          permissionType,
          requiredPoints: frontmatter.requiredPoints || 0,
          encrypted: isEncrypted ? 1 : 0,
          password: frontmatter.password || "",
          passwordHint: frontmatter.passwordHint || "",
          hideHomeContent: frontmatter.hideHomeContent === false ? 0 : 1,
          createdAt: frontmatter.published ? new Date(frontmatter.published).getTime() : Date.now(),
        });
      }
    }
  }

  scan(POSTS_DIR);
  return posts;
}

// 2. Collect Moments
function collectMoments() {
  const moments = [];
  if (!fs.existsSync(MOMENTS_DIR)) return moments;

  const files = fs.readdirSync(MOMENTS_DIR);
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const fullPath = path.join(MOMENTS_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { frontmatter, body } = parseFrontmatterAndBody(raw);

    // parse images if present in frontmatter
    let images = [];
    if (raw.includes("images:")) {
      const imgSection = raw.split("images:")[1].split("---")[0];
      const srcMatches = [...imgSection.matchAll(/src:\s*([^\r\n]+)/g)];
      const altMatches = [...imgSection.matchAll(/alt:\s*([^\r\n]+)/g)];
      for (let i = 0; i < srcMatches.length; i++) {
        images.push({
          src: srcMatches[i][1].trim().replace(/^['"]|['"]$/g, ""),
          alt: altMatches[i] ? altMatches[i][1].trim().replace(/^['"]|['"]$/g, "") : "",
        });
      }
    }

    moments.push({
      content: body.trim(),
      location: frontmatter.location || "",
      mood: frontmatter.mood || "material-symbols:sentiment-satisfied-outline-rounded",
      images,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      pinned: frontmatter.pinned ? 1 : 0,
      createdAt: frontmatter.published ? new Date(frontmatter.published).getTime() : Date.now(),
    });
  }

  return moments.sort((a, b) => b.createdAt - a.createdAt);
}

// 3. Collect Albums
function collectAlbums() {
  const albums = [];
  if (!fs.existsSync(ALBUMS_DIR)) return albums;

  const entries = fs.readdirSync(ALBUMS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const albumPath = path.join(ALBUMS_DIR, slug);
    const infoFile = path.join(albumPath, "info.json");

    let info = {};
    if (fs.existsSync(infoFile)) {
      try {
        info = JSON.parse(fs.readFileSync(infoFile, "utf-8"));
      } catch (err) {
        console.warn(`[Seed Generator] Failed to parse ${infoFile}:`, err);
      }
    }

    const photos = [];
    if (Array.isArray(info.photos) && info.photos.length > 0) {
      info.photos.forEach((p, idx) => {
        photos.push({
          url: p.src || p.url,
          alt: p.alt || p.title || `Photo ${idx + 1}`,
          title: p.title || `Photo ${idx + 1}`,
          description: p.description || "",
          tags: Array.isArray(p.tags) ? p.tags : ["remote"],
          sortOrder: idx + 1,
        });
      });
    } else {
      // Scan directory for image files
      const dirFiles = fs.readdirSync(albumPath);
      const imgFiles = dirFiles
        .filter((f) => /\.(webp|png|jpg|jpeg|avif|gif)$/i.test(f) && !f.startsWith("cover."))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

      imgFiles.forEach((file, idx) => {
        photos.push({
          url: `/images/albums/${slug}/${file}`,
          alt: `${info.title || slug} ${idx + 1}`,
          title: `${info.title || slug} ${idx + 1}`,
          description: "",
          tags: Array.isArray(info.tags) ? info.tags : ["local"],
          sortOrder: idx + 1,
        });
      });
    }

    const isEncrypted = Boolean(info.encrypted || info.password);
    const draft = info.draft ? 1 : 0;
    const permissionType = info.permissionType || (isEncrypted ? "password" : "public");

    // Determine cover
    let cover = info.cover || "";
    if (!cover) {
      const potentialCover = path.join(albumPath, "cover.webp");
      if (fs.existsSync(potentialCover)) {
        cover = `/images/albums/${slug}/cover.webp`;
      } else if (photos.length > 0) {
        cover = photos[0].url;
      }
    }

    albums.push({
      slug,
      title: info.title || slug,
      description: info.description || "",
      cover,
      layout: info.layout || "masonry",
      columns: info.columns || 3,
      tags: Array.isArray(info.tags) ? info.tags : [],
      hidden: info.hidden ? 1 : 0,
      permissionType,
      requiredPoints: info.requiredPoints || 0,
      encrypted: isEncrypted ? 1 : 0,
      password: info.password || "",
      passwordHint: info.passwordHint || "",
      draft,
      photos,
    });
  }

  return albums;
}

// 4. Friends
const friends = [
  {
    name: "Mizuki",
    avatar: "https://avatars.githubusercontent.com/u/225602409?v=4&s=640",
    desc: "Another Fuwari-based blog theme with docs",
    url: "https://mizuki.mysqil.com",
    accepted: 1,
    sortOrder: 1,
  },
  {
    name: "Astro",
    avatar: "https://avatars.githubusercontent.com/u/44914786?v=4&s=640",
    desc: "The web framework for content-driven websites",
    url: "https://astro.build",
    accepted: 1,
    sortOrder: 2,
  },
  {
    name: "Material 3",
    avatar: "https://avatars.githubusercontent.com/u/19478152?v=4&s=640",
    desc: "Material Design 3 — the next generation of Material Design",
    url: "https://m3.material.io",
    accepted: 1,
    sortOrder: 3,
  },
];

console.log("Generating seed dataset...");
const posts = collectPosts();
const moments = collectMoments();
const albums = collectAlbums();

console.log(`Collected: ${posts.length} posts, ${moments.length} moments, ${albums.length} albums, ${friends.length} friends.`);

// Generate TypeScript seed module
const tsContent = `/**
 * Shirine Preset Seed Dataset
 * Auto-generated by scripts/generate-seeds.mjs
 */

export interface SeedPost {
  slug: string;
  alias?: string | null;
  permalink?: string | null;
  title: string;
  description: string;
  content: string;
  image: string;
  category: string;
  tags: string[];
  lang?: string;
  pinned: number;
  draft: number;
  commentEnabled: number;
  permissionType: "public" | "login_required" | "points_required" | "password";
  requiredPoints: number;
  encrypted?: number;
  password?: string;
  passwordHint?: string;
  hideHomeContent?: number;
  createdAt: number;
}

export interface SeedMoment {
  content: string;
  location: string;
  mood: string;
  images: Array<{ src: string; alt: string }>;
  tags: string[];
  pinned: number;
  createdAt: number;
}

export interface SeedAlbumPhoto {
  url: string;
  alt: string;
  title: string;
  description: string;
  tags: string[];
  sortOrder: number;
}

export interface SeedAlbum {
  slug: string;
  title: string;
  description: string;
  cover: string;
  layout: string;
  columns: number;
  tags: string[];
  hidden: number;
  permissionType: "public" | "login_required" | "points_required" | "password";
  requiredPoints: number;
  encrypted?: number;
  password?: string;
  passwordHint?: string;
  draft: number;
  photos: SeedAlbumPhoto[];
}

export interface SeedFriend {
  name: string;
  desc: string;
  avatar: string;
  url: string;
  accepted: number;
  sortOrder: number;
}

export const PRESET_POSTS: SeedPost[] = ${JSON.stringify(posts, null, 2)};

export const PRESET_MOMENTS: SeedMoment[] = ${JSON.stringify(moments, null, 2)};

export const PRESET_ALBUMS: SeedAlbum[] = ${JSON.stringify(albums, null, 2)};

export const PRESET_FRIENDS: SeedFriend[] = ${JSON.stringify(friends, null, 2)};
`;

fs.writeFileSync(OUTPUT_TS, tsContent, "utf-8");
console.log(`Saved ${OUTPUT_TS}`);

// Generate SQL Seed File
function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

let sql = `-- Shirine D1 Preset Seed SQL
-- Auto-generated by scripts/generate-seeds.mjs
-- Note: SuperAdmin user is initialized via /api/setup/admin wizard on first run.

-- 1. Friends
`;

for (const f of friends) {
  sql += `INSERT INTO friends (name, desc, avatar, url, accepted, sort_order, uid)
VALUES (${escapeSql(f.name)}, ${escapeSql(f.desc)}, ${escapeSql(f.avatar)}, ${escapeSql(f.url)}, ${f.accepted}, ${f.sortOrder}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1))
ON CONFLICT(url) DO NOTHING;\n`;
}

sql += `\n-- 2. Moments\n`;
for (const m of moments) {
  sql += `INSERT INTO moments (content, location, mood, images, tags, pinned, uid, created_at)
VALUES (${escapeSql(m.content)}, ${escapeSql(m.location)}, ${escapeSql(m.mood)}, ${escapeSql(JSON.stringify(m.images))}, ${escapeSql(JSON.stringify(m.tags))}, ${m.pinned}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1), ${Math.floor(m.createdAt / 1000)})
ON CONFLICT(content) DO NOTHING;\n`;
}

sql += `\n-- 3. Albums & Photos\n`;
for (const a of albums) {
  sql += `INSERT INTO albums (slug, title, description, cover, layout, columns, tags, hidden, permission_type, required_points, encrypted, password, password_hint, draft, uid)
VALUES (${escapeSql(a.slug)}, ${escapeSql(a.title)}, ${escapeSql(a.description)}, ${escapeSql(a.cover)}, ${escapeSql(a.layout)}, ${a.columns}, ${escapeSql(JSON.stringify(a.tags))}, ${a.hidden}, ${escapeSql(a.permissionType)}, ${a.requiredPoints}, ${a.encrypted || 0}, ${escapeSql(a.password || "")}, ${escapeSql(a.passwordHint || "")}, ${a.draft}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1))
ON CONFLICT(slug) DO UPDATE SET permission_type = excluded.permission_type, encrypted = excluded.encrypted, password = excluded.password, password_hint = excluded.password_hint, draft = excluded.draft;\n`;

  for (const p of a.photos) {
    sql += `INSERT INTO album_photos (album_id, url, alt, title, description, tags, sort_order)
SELECT id, ${escapeSql(p.url)}, ${escapeSql(p.alt)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(JSON.stringify(p.tags))}, ${p.sortOrder}
FROM albums WHERE slug = ${escapeSql(a.slug)}
ON CONFLICT(album_id, url) DO NOTHING;\n`;
  }
}

sql += `\n-- 4. Posts\n`;
for (const p of posts) {
  sql += `INSERT INTO posts (slug, alias, permalink, title, description, content, image, category, tags, lang, pinned, draft, comment_enabled, permission_type, required_points, encrypted, password, password_hint, hide_home_content, uid, created_at)
VALUES (${escapeSql(p.slug)}, ${escapeSql(p.alias)}, ${escapeSql(p.permalink)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(p.content)}, ${escapeSql(p.image)}, ${escapeSql(p.category)}, ${escapeSql(JSON.stringify(p.tags))}, ${escapeSql(p.lang)}, ${p.pinned}, ${p.draft}, ${p.commentEnabled}, ${escapeSql(p.permissionType)}, ${p.requiredPoints}, ${p.encrypted}, ${escapeSql(p.password)}, ${escapeSql(p.passwordHint)}, ${p.hideHomeContent}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1), ${Math.floor(p.createdAt / 1000)})
ON CONFLICT(slug) DO UPDATE SET draft = excluded.draft, encrypted = excluded.encrypted, password = excluded.password, password_hint = excluded.password_hint;\n`;
}

sql += `\n-- 5. Default Site Configurations\n`;
const defaultConfigs = {
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
      { name: "Twitter", icon: "fa6-brands:twitter", url: "https://twitter.com" },
      { name: "Steam", icon: "fa6-brands:steam", url: "https://store.steampowered.com" },
      { name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/yiran168/Shirine" },
    ],
  },
  announcement: {
    enable: true,
    title: "",
    content: "The only way to do great work is to love what you do",
    link: { enable: true, text: "GitHub", url: "https://github.com" },
  },
  music: {
    enable: true,
    provider: "mixed",
    defaultVolume: 0.7,
    defaultMode: "sequence",
    meting: { server: "netease", type: "playlist", id: "14164869977" },
    tracks: [
      { id: "dazbee", title: "口笛で愛は歌えない", artist: "Dazbee", cover: "/assets/images/music/dazbee.webp", source: "/assets/music/url/dazbee.mp3", duration: 241 },
      { id: "hitori", title: "ひとり上手", artist: "Kaya", cover: "/assets/images/music/hitori.webp", source: "/assets/music/url/hitori.mp3", duration: 253 },
      { id: "xryx", title: "眩耀夜行", artist: "スリーズブーケ", cover: "/assets/images/music/xryx.webp", source: "/assets/music/url/xryx.mp3", duration: 245 },
      { id: "cl", title: "春雷の頃", artist: "22/7", cover: "/assets/images/music/cl.webp", source: "/assets/music/url/cl.mp3", duration: 242 },
    ],
  },
  sidebar: {
    widgets: {
      profile: { enable: true, priority: 1 },
      announcement: { enable: true, priority: 2, title: "公告", content: "欢迎来到 Shirine！基于 Cloudflare 全栈架构的唯美动态博客。" },
      categories: { enable: true, priority: 3 },
      tags: { enable: true, priority: 4 },
      recentPosts: { enable: true, priority: 5, limit: 5 },
    },
  },
  footer: { startYear: 2026, enableHtmlInject: false, links: [] },
  compass: [
    {
      key: "dev",
      name: "Development",
      icon: "material-symbols:code-rounded",
      blurb: "Sites I keep open while writing code",
      entries: [
        { label: "GitHub", href: "https://github.com", note: "Code hosting & collaboration", icon: "fa6-brands:github" },
        { label: "MDN", href: "https://developer.mozilla.org", note: "Authoritative web docs", icon: "material-symbols:menu-book-rounded" },
        { label: "Stack Overflow", href: "https://stackoverflow.com", note: "Q&A and debugging", icon: "fa6-brands:stack-overflow" }
      ]
    },
    {
      key: "design",
      name: "Design",
      icon: "material-symbols:palette-outline-rounded",
      blurb: "Colors, icons and inspiration",
      entries: [
        { label: "Iconify", href: "https://icon-sets.iconify.design", note: "Searchable open-source icon sets" },
        { label: "Material Symbols", href: "https://fonts.google.com/icons", note: "Official M3 icon set", icon: "material-symbols:star-rounded" },
        { label: "Excalidraw", href: "https://excalidraw.com", note: "Hand-drawn whiteboard collaboration" }
      ]
    },
    {
      key: "tools",
      name: "Tools",
      icon: "material-symbols:build-outline-rounded",
      entries: [
        { label: "Squoosh", href: "https://squoosh.app", note: "Image compression & conversion" },
        { label: "Regex101", href: "https://regex101.com", note: "Regex testing & debugging" }
      ]
    },
    {
      key: "reads",
      name: "Reading",
      icon: "material-symbols:auto-stories-outline-rounded",
      entries: [
        { label: "Hacker News", href: "https://news.ycombinator.com" },
        { label: "V2EX", href: "https://www.v2ex.com" },
        { label: "Solidot", href: "https://www.solidot.org", note: "Tech and culture news" }
      ]
    }
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
      period: { start: "2022-07", end: "2022-09" }
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
      period: { start: "2015-07", end: "2015-09" }
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
      period: { start: "2020-01", end: "2020-03" }
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
      period: { start: "2014-04", end: "2014-06" }
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
      period: { start: "2025-07", end: "2025-10" }
    }
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
      enable: true
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
      enable: true
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
      enable: true
    }
  ],
  devices: [
    {
      id: "macbook-pro-16",
      name: "MacBook Pro 16\"",
      brand: "Apple",
      category: "desk",
      status: "active",
      specs: "M3 Max / 64GB / 2TB",
      description: "Primary workstation for development, design, and heavy rendering workloads.",
      icon: "material-symbols:laptop-mac-rounded",
      featured: true,
      year: "2024",
      link: "https://www.apple.com/macbook-pro/",
      enable: true
    },
    {
      id: "iphone-16-pro",
      name: "iPhone 16 Pro",
      brand: "Apple",
      category: "mobile",
      status: "active",
      specs: "A18 Pro / 256GB / Natural Titanium",
      description: "Daily mobile device, mobile photography and communication.",
      icon: "material-symbols:smartphone-rounded",
      featured: true,
      year: "2024",
      link: "https://www.apple.com/iphone/",
      enable: true
    }
  ],
  skills: [
    { id: "astro", name: "Astro", category: "frontend", proficiency: 95, level: "expert", icon: "simple-icons:astro", description: "Content-first framework powering this blog", featured: true, enable: true },
    { id: "svelte", name: "Svelte", category: "frontend", proficiency: 90, level: "advanced", icon: "simple-icons:svelte", description: "Reactive UI components and admin dashboard", featured: true, enable: true },
    { id: "typescript", name: "TypeScript", category: "frontend", proficiency: 92, level: "expert", icon: "simple-icons:typescript", description: "Type-safe application development across full stack", featured: true, enable: true },
    { id: "cloudflare", name: "Cloudflare Pages & Workers", category: "backend", proficiency: 90, level: "advanced", icon: "simple-icons:cloudflare", description: "Edge computing, D1 database, and R2 object storage", featured: true, enable: true }
  ],
  timeline: [
    {
      title: "Shirine 开源发布",
      date: "2026.03",
      category: "milestone",
      subtitle: "从概念到全栈架构落地",
      location: "GitHub",
      description: "发布 Shirine 动态博客系统，整合 Material 3 Expressive 设计规范与 Cloudflare 全栈能力。",
      highlights: [
        "实现 Cloudflare D1 + R2 原生动态架构",
        "引入 AES-256-GCM 本地离线文章与相册加密系统",
        "深度支持 20+ 种 Material 增强写作语法"
      ],
      tags: ["Astro", "Svelte", "Cloudflare", "M3E"],
      icon: "material-symbols:rocket-launch-rounded",
      featured: true,
      enable: true
    }
  ],
  system: {
    turnstile: { siteKey: "", secretKey: "" },
    live2d: {
      guestEnable: true,
      adminEnable: true,
      model: "/pio/models/NOIR/noir.model3.json",
      lang: "zh_CN",
      quotes: [
        "欢迎来到 Shirine！",
        "今天也是美好的一天～",
        "有什么想和我聊聊的吗？",
        "看文章累了就伸个懒腰吧！",
        "点击右下角按钮可以返回顶部哦～",
        "我会一直在这里陪着你的！"
      ],
      models: [
        { name: "NOIR (默认)", url: "/pio/models/NOIR/noir.model3.json" },
        { name: "Hiyori", url: "https://fastly.jsdelivr.net/gh/evpt/live2d-models/hiyori/hiyori.model3.json" }
      ]
    },
    ai: { apiUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
    checkin_rule: { enabled: true, fixedPoints: 10, rewardRange: 15 }
  },
};

for (const [key, value] of Object.entries(defaultConfigs)) {
  sql += `INSERT INTO site_configs (key, value, updated_at)
VALUES (${escapeSql(key)}, ${escapeSql(JSON.stringify(value))}, unixepoch())
ON CONFLICT(key) DO NOTHING;\n`;
}

fs.writeFileSync(OUTPUT_SQL, sql, "utf-8");
console.log(`Saved ${OUTPUT_SQL}`);
console.log("Done!");
