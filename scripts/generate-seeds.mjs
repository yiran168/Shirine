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
        const draft = isEncrypted ? 1 : (frontmatter.draft ? 1 : 0);
        const permissionType = isEncrypted
          ? "login_required"
          : (frontmatter.permissionType === "login_required" || frontmatter.permissionType === "points_required"
              ? frontmatter.permissionType
              : "public");

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

    const isEncrypted = Boolean(info.password);
    const draft = isEncrypted ? 1 : (info.draft ? 1 : 0);
    const permissionType = isEncrypted
      ? "login_required"
      : (info.permissionType === "login_required" || info.permissionType === "points_required"
          ? info.permissionType
          : "public");

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
  permissionType: "public" | "login_required" | "points_required";
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
  permissionType: "public" | "login_required" | "points_required";
  requiredPoints: number;
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
ON CONFLICT(url) DO UPDATE SET
  name = excluded.name,
  desc = excluded.desc,
  avatar = excluded.avatar,
  accepted = excluded.accepted,
  sort_order = excluded.sort_order;\n`;
}

sql += `\n-- 2. Moments\n`;
for (const m of moments) {
  sql += `INSERT INTO moments (content, location, mood, images, tags, pinned, uid, created_at)
VALUES (${escapeSql(m.content)}, ${escapeSql(m.location)}, ${escapeSql(m.mood)}, ${escapeSql(JSON.stringify(m.images))}, ${escapeSql(JSON.stringify(m.tags))}, ${m.pinned}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1), ${Math.floor(m.createdAt / 1000)})
ON CONFLICT(content) DO UPDATE SET
  location = excluded.location,
  mood = excluded.mood,
  images = excluded.images,
  tags = excluded.tags,
  pinned = excluded.pinned;\n`;
}

sql += `\n-- 3. Albums & Photos\n`;
for (const a of albums) {
  sql += `INSERT INTO albums (slug, title, description, cover, layout, columns, tags, hidden, permission_type, required_points, draft, uid)
VALUES (${escapeSql(a.slug)}, ${escapeSql(a.title)}, ${escapeSql(a.description)}, ${escapeSql(a.cover)}, ${escapeSql(a.layout)}, ${a.columns}, ${escapeSql(JSON.stringify(a.tags))}, ${a.hidden}, ${escapeSql(a.permissionType)}, ${a.requiredPoints}, ${a.draft}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  cover = excluded.cover,
  layout = excluded.layout,
  columns = excluded.columns,
  tags = excluded.tags,
  hidden = excluded.hidden,
  permission_type = excluded.permission_type,
  required_points = excluded.required_points,
  draft = excluded.draft;\n`;

  for (const p of a.photos) {
    sql += `INSERT INTO album_photos (album_id, url, alt, title, description, tags, sort_order)
SELECT id, ${escapeSql(p.url)}, ${escapeSql(p.alt)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(JSON.stringify(p.tags))}, ${p.sortOrder}
FROM albums WHERE slug = ${escapeSql(a.slug)};\n`;
  }
}

sql += `\n-- 4. Posts\n`;
for (const p of posts) {
  sql += `INSERT INTO posts (slug, alias, permalink, title, description, content, image, category, tags, lang, pinned, draft, comment_enabled, permission_type, required_points, encrypted, password, password_hint, hide_home_content, uid, created_at)
VALUES (${escapeSql(p.slug)}, ${escapeSql(p.alias)}, ${escapeSql(p.permalink)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(p.content)}, ${escapeSql(p.image)}, ${escapeSql(p.category)}, ${escapeSql(JSON.stringify(p.tags))}, ${escapeSql(p.lang)}, ${p.pinned}, ${p.draft}, ${p.commentEnabled}, ${escapeSql(p.permissionType)}, ${p.requiredPoints}, ${p.encrypted}, ${escapeSql(p.password)}, ${escapeSql(p.passwordHint)}, ${p.hideHomeContent}, (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1), ${Math.floor(p.createdAt / 1000)})
ON CONFLICT(slug) DO UPDATE SET
  alias = excluded.alias,
  permalink = excluded.permalink,
  title = excluded.title,
  description = excluded.description,
  content = excluded.content,
  image = excluded.image,
  category = excluded.category,
  tags = excluded.tags,
  lang = excluded.lang,
  pinned = excluded.pinned,
  draft = excluded.draft,
  comment_enabled = excluded.comment_enabled,
  permission_type = excluded.permission_type,
  required_points = excluded.required_points,
  encrypted = excluded.encrypted,
  password = excluded.password,
  password_hint = excluded.password_hint,
  hide_home_content = excluded.hide_home_content;\n`;
}

fs.writeFileSync(OUTPUT_SQL, sql, "utf-8");
console.log(`Saved ${OUTPUT_SQL}`);
console.log("Done!");
