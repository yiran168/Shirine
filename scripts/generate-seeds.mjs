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
      } else if (file.name.endsWith(".md") || file.name.endsWith(".mdx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const { frontmatter, body } = parseFrontmatterAndBody(content);

        let slug = path.relative(POSTS_DIR, fullPath).replace(/\\/g, "/").replace(/\.(md|mdx)$/, "");
        if (slug.endsWith("/index")) {
          slug = slug.replace(/\/index$/, "");
        }

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
          pinned: frontmatter.pinned ? 1 : 0,
          draft: frontmatter.draft ? 1 : 0,
          commentEnabled: frontmatter.comment !== false ? 1 : 0,
          permissionType: frontmatter.permissionType || "public",
          requiredPoints: frontmatter.requiredPoints || 0,
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

  // AcgExample
  const acgDir = path.join(ALBUMS_DIR, "AcgExample");
  if (fs.existsSync(acgDir)) {
    const info = JSON.parse(fs.readFileSync(path.join(acgDir, "info.json"), "utf-8"));
    const photos = [];
    for (let i = 1; i <= 22; i++) {
      const numStr = String(i).padStart(2, "0");
      photos.push({
        url: `/images/albums/AcgExample/${numStr}.webp`,
        alt: `ACG Artwork ${numStr}`,
        title: `ACG Artwork ${numStr}`,
        description: "",
        tags: ["acg", "illustration"],
        sortOrder: i,
      });
    }

    albums.push({
      slug: "AcgExample",
      title: info.title || "Some lovely pictures",
      description: info.description || "A local album scanned from this directory.",
      cover: "/images/albums/AcgExample/cover.webp",
      layout: info.layout || "masonry",
      columns: info.columns || 3,
      tags: info.tags || ["local", "webp", "example"],
      permissionType: "public",
      photos,
    });
  }

  // ExternalExample
  const extDir = path.join(ALBUMS_DIR, "ExternalExample");
  if (fs.existsSync(extDir)) {
    const info = JSON.parse(fs.readFileSync(path.join(extDir, "info.json"), "utf-8"));
    const photos = (info.photos || []).map((p, idx) => ({
      url: p.src,
      alt: p.alt || p.title || "External photo",
      title: p.title || `Photo ${idx + 1}`,
      description: "",
      tags: p.tags || ["remote"],
      sortOrder: idx + 1,
    }));

    albums.push({
      slug: "ExternalExample",
      title: info.title || "External image set",
      description: info.description || "A remote album using explicit photo metadata and thumbnails.",
      cover: info.cover || "https://picsum.photos/seed/shirine-cover/800/600",
      layout: info.layout || "masonry",
      columns: info.columns || 3,
      tags: info.tags || ["external", "remote", "example"],
      permissionType: "public",
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
  pinned: number;
  draft: number;
  commentEnabled: number;
  permissionType: "public" | "login_required" | "points_required";
  requiredPoints: number;
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
  permissionType: "public" | "login_required" | "points_required";
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

-- 1. Ensure SuperAdmin user exists (id: 1, password: admin)
INSERT OR IGNORE INTO users (id, username, password_hash, salt, role, nickname, points, status)
VALUES (
  1,
  'admin',
  '749e89182d447e42ad71b2f9ef82dd42a89a14b3b9e827a0039ac22ae78509b5',
  '4c9f13e738d9b15d290fb43292415174',
  'superadmin',
  'Shirine Admin',
  100,
  'active'
);

-- 2. Friends
`;

for (const f of friends) {
  sql += `INSERT INTO friends (name, desc, avatar, url, accepted, sort_order, uid)
VALUES (${escapeSql(f.name)}, ${escapeSql(f.desc)}, ${escapeSql(f.avatar)}, ${escapeSql(f.url)}, ${f.accepted}, ${f.sortOrder}, 1)
ON CONFLICT(url) DO UPDATE SET
  name = excluded.name,
  desc = excluded.desc,
  avatar = excluded.avatar,
  accepted = excluded.accepted,
  sort_order = excluded.sort_order;\n`;
}

sql += `\n-- 3. Moments\n`;
for (const m of moments) {
  sql += `INSERT INTO moments (content, location, mood, images, tags, pinned, uid, created_at)
VALUES (${escapeSql(m.content)}, ${escapeSql(m.location)}, ${escapeSql(m.mood)}, ${escapeSql(JSON.stringify(m.images))}, ${escapeSql(JSON.stringify(m.tags))}, ${m.pinned}, 1, ${Math.floor(m.createdAt / 1000)})
ON CONFLICT(content) DO UPDATE SET
  location = excluded.location,
  mood = excluded.mood,
  images = excluded.images,
  tags = excluded.tags,
  pinned = excluded.pinned;\n`;
}

sql += `\n-- 4. Albums & Photos\n`;
for (const a of albums) {
  sql += `INSERT INTO albums (slug, title, description, cover, layout, columns, permission_type, uid)
VALUES (${escapeSql(a.slug)}, ${escapeSql(a.title)}, ${escapeSql(a.description)}, ${escapeSql(a.cover)}, ${escapeSql(a.layout)}, ${a.columns}, ${escapeSql(a.permissionType)}, 1)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  cover = excluded.cover,
  layout = excluded.layout,
  columns = excluded.columns,
  permission_type = excluded.permission_type;\n`;
}

sql += `\n-- 5. Posts\n`;
for (const p of posts) {
  sql += `INSERT INTO posts (slug, alias, permalink, title, description, content, image, category, tags, pinned, draft, comment_enabled, permission_type, required_points, uid, created_at)
VALUES (${escapeSql(p.slug)}, ${escapeSql(p.alias)}, ${escapeSql(p.permalink)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(p.content)}, ${escapeSql(p.image)}, ${escapeSql(p.category)}, ${escapeSql(JSON.stringify(p.tags))}, ${p.pinned}, ${p.draft}, ${p.commentEnabled}, ${escapeSql(p.permissionType)}, ${p.requiredPoints}, 1, ${Math.floor(p.createdAt / 1000)})
ON CONFLICT(slug) DO UPDATE SET
  alias = excluded.alias,
  permalink = excluded.permalink,
  title = excluded.title,
  description = excluded.description,
  content = excluded.content,
  image = excluded.image,
  category = excluded.category,
  tags = excluded.tags,
  pinned = excluded.pinned,
  draft = excluded.draft,
  comment_enabled = excluded.comment_enabled,
  permission_type = excluded.permission_type,
  required_points = excluded.required_points;\n`;
}

fs.writeFileSync(OUTPUT_SQL, sql, "utf-8");
console.log(`Saved ${OUTPUT_SQL}`);
console.log("Done!");
