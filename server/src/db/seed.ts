import { eq, sql } from "drizzle-orm";
import type { getDb } from "./index";
import { schema } from "./index";
import {
  PRESET_POSTS,
  PRESET_MOMENTS,
  PRESET_ALBUMS,
  PRESET_FRIENDS,
} from "./seed-data";
import { ensureD1Schema } from "./migrate";
import { defaultSiteConfig } from "../routes/config";

export const PRESET_PAGES = [
  {
    slug: "about",
    title: "关于",
    content: `# 关于 Shirine (About Shirine)

欢迎来到 **Shirine**（白音）— 基于 Material 3 Expressive (M3E) 设计规范的唯美二次元个人博客。

::github{repo="yiran168/Shirine"}

## ✦ 设计理念 (Design & Philosophy)

- **Dynamic Chromatic Spell**: 全动态色彩体系，完美自适应深浅色模式与个性色彩。
- **Seamless Shell Navigation**: 全站持久化应用壳与平滑页面过渡，音乐持续播放不中断。
- **Rich Story Grimoire**: 支持丰富 Markdown/MDX 扩展、KaTeX 公式与自适应图文混排。
- **Zero Extra Burden**: 极致性能与零额外负担架构。

## ✦ 友链申请 (Friend Links Application)

本站欢迎符合条件的博主与开发者交换友情链接！申请前请先添加本站链接：

### 本站信息：
- **站点名称**：Shirine
- **站点地址**：https://github.com/yiran168/Shirine
- **站点头像**：/assets/images/demo-avatar.webp
- **站点描述**：The rain remembers what the sky forgot to say.

### 申请要求：
1. 网站支持 HTTPS 访问，内容积极健康，无违法违规信息；
2. 网站保持稳定更新（建议有原创技术、生活或二次元相关博文）；
3. 申请前请先添加本站友链；
4. 申请入口：可直接前往 [友链页面](/friends/) 点击「申请友链」按钮提交，管理员审核后即可在前台展示。`,
  },
  {
    slug: "projects",
    title: "精选项目",
    content: `# 精选项目 (Featured Projects)

这里展示了站长参与或独立维护的开源项目与实践作品。

- **Shirine Blog Theme**: 基于 Material 3 Expressive 设计规范的唯美二次元博客主题。
- **M3E Component Library**: 深度整合 Tailwind 与 Svelte 5 的设计系统组件库。
- **Cloudflare D1/R2 Serverless Engine**: 极速低延迟的全栈无服务器后端架构。`,
  },
  {
    slug: "devices",
    title: "我的设备",
    content: `# 我的设备与工作台 (My Devices & Setup)

记录日常使用的数字装备、开发工作台与生产力工具：

- **主力电脑**: MacBook Pro 16" (M-Series / 32GB RAM / 1TB SSD)
- **显示外设**: 27" 4K IPS HDR 专业色彩显示器 + 机械键盘与无线人体工学鼠标
- **移动设备**: iPhone 15 Pro Max & iPad Pro (Apple Pencil 随手记与草稿设计)
- **影音娱乐**: Sony WH-1000XM5 无线降噪耳机 + Nintendo Switch OLED`,
  },
  {
    slug: "skills",
    title: "技能清单",
    content: `# 技能清单与技术栈 (Skills & Technologies)

- **前端技术**: TypeScript / Astro 7 / Svelte 5 (Runes) / Tailwind CSS 4 / Vue / React
- **后端架构**: Cloudflare Workers / D1 (SQLite) / R2 Storage / Hono / Node.js
- **设计工具**: Figma / Material Design 3 / Adobe Creative Cloud
- **开发运维**: Git / GitHub Actions CI/CD / Docker / Linux`,
  },
];

export async function seedPresetData(
  db: ReturnType<typeof getDb>,
  overwrite = false,
  d1?: D1Database
) {
  // 0. Ensure schema migrations and missing columns are created
  await ensureD1Schema(d1, db);

  const summary = {
    posts: 0,
    moments: 0,
    albums: 0,
    photos: 0,
    friends: 0,
    pages: 0,
  };

  // 1. Resolve SuperAdmin if already registered via /setup/admin
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.role, "superadmin"),
  });
  const adminUid = existingAdmin ? existingAdmin.id : null;

  // 2. Friends
  for (const f of PRESET_FRIENDS) {
    const existing = await db.query.friends.findFirst({
      where: eq(schema.friends.url, f.url),
    });
    if (!existing) {
      await db.insert(schema.friends).values({
        name: f.name,
        desc: f.desc,
        avatar: f.avatar,
        url: f.url,
        accepted: f.accepted,
        sortOrder: f.sortOrder,
        uid: adminUid,
      });
      summary.friends++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.friends)
        .set({
          ...(overwrite ? {
            name: f.name,
            desc: f.desc,
            avatar: f.avatar,
            accepted: f.accepted,
            sortOrder: f.sortOrder,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.friends.id, existing.id));
      summary.friends++;
    }
  }

  // 3. Moments
  for (const m of PRESET_MOMENTS) {
    const existing = await db.query.moments.findFirst({
      where: eq(schema.moments.content, m.content),
    });
    if (!existing) {
      await db.insert(schema.moments).values({
        content: m.content,
        location: m.location,
        mood: m.mood,
        images: JSON.stringify(m.images),
        tags: JSON.stringify(m.tags),
        pinned: m.pinned,
        uid: adminUid,
        createdAt: new Date(m.createdAt),
      });
      summary.moments++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.moments)
        .set({
          ...(overwrite ? {
            location: m.location,
            mood: m.mood,
            images: JSON.stringify(m.images),
            tags: JSON.stringify(m.tags),
            pinned: m.pinned,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.moments.id, existing.id));
      summary.moments++;
    }
  }

  // 4. Albums & Photos
  for (const a of PRESET_ALBUMS) {
    let albumId: number | null = null;
    const existing = await db.query.albums.findFirst({
      where: eq(schema.albums.slug, a.slug),
    });

    if (!existing) {
      const inserted = await db
        .insert(schema.albums)
        .values({
          slug: a.slug,
          title: a.title,
          description: a.description,
          cover: a.cover,
          layout: a.layout,
          columns: a.columns,
          tags: JSON.stringify(a.tags),
          hidden: a.hidden,
          permissionType: a.permissionType,
          requiredPoints: a.requiredPoints,
          draft: a.draft,
          uid: adminUid,
        })
        .returning();
      albumId = inserted[0]?.id;
      summary.albums++;
    } else {
      albumId = existing.id;
      if (overwrite || (existing.uid === null && adminUid !== null)) {
        await db
          .update(schema.albums)
          .set({
            ...(overwrite ? {
              title: a.title,
              description: a.description,
              cover: a.cover,
              layout: a.layout,
              columns: a.columns,
              tags: JSON.stringify(a.tags),
              hidden: a.hidden,
              permissionType: a.permissionType,
              requiredPoints: a.requiredPoints,
              draft: a.draft,
            } : {}),
            uid: existing.uid ?? adminUid,
            updatedAt: new Date(),
          })
          .where(eq(schema.albums.id, existing.id));
        summary.albums++;
      }
    }

    if (albumId && (overwrite || !existing)) {
      if (overwrite) {
        await db.delete(schema.albumPhotos).where(eq(schema.albumPhotos.albumId, albumId));
      }
      for (const p of a.photos) {
        await db
          .insert(schema.albumPhotos)
          .values({
            albumId,
            url: p.url,
            alt: p.alt,
            title: p.title,
            description: p.description,
            tags: JSON.stringify(p.tags),
            sortOrder: p.sortOrder,
          })
          .onConflictDoUpdate({
            target: [schema.albumPhotos.albumId, schema.albumPhotos.url],
            set: {
              alt: p.alt,
              title: p.title,
              description: p.description,
              tags: JSON.stringify(p.tags),
              sortOrder: p.sortOrder,
            },
          });
        summary.photos++;
      }
    }
  }

  // 5. Posts
  for (const p of PRESET_POSTS) {
    const existing = await db.query.posts.findFirst({
      where: eq(schema.posts.slug, p.slug),
    });

    if (!existing) {
      await db.insert(schema.posts).values({
        slug: p.slug,
        alias: p.alias,
        permalink: p.permalink,
        title: p.title,
        description: p.description,
        content: p.content,
        image: p.image,
        category: p.category,
        tags: JSON.stringify(p.tags),
        lang: p.lang || "zh_CN",
        pinned: p.pinned,
        draft: p.draft,
        commentEnabled: p.commentEnabled,
        permissionType: p.permissionType,
        requiredPoints: p.requiredPoints,
        encrypted: p.encrypted || 0,
        password: p.password || "",
        passwordHint: p.passwordHint || "",
        hideHomeContent: p.hideHomeContent ?? 1,
        uid: adminUid,
        createdAt: new Date(p.createdAt),
      });
      summary.posts++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.posts)
        .set({
          ...(overwrite ? {
            alias: p.alias,
            permalink: p.permalink,
            title: p.title,
            description: p.description,
            content: p.content,
            image: p.image,
            category: p.category,
            tags: JSON.stringify(p.tags),
            lang: p.lang || "zh_CN",
            pinned: p.pinned,
            draft: p.draft,
            commentEnabled: p.commentEnabled,
            permissionType: p.permissionType,
            requiredPoints: p.requiredPoints,
            encrypted: p.encrypted || 0,
            password: p.password || "",
            passwordHint: p.passwordHint || "",
            hideHomeContent: p.hideHomeContent ?? 1,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.posts.id, existing.id));
      summary.posts++;
    }
  }

  // 6. Custom Pages
  for (const page of PRESET_PAGES) {
    const existing = await db.query.pages.findFirst({
      where: eq(schema.pages.slug, page.slug),
    });
    if (!existing) {
      await db.insert(schema.pages).values({
        slug: page.slug,
        title: page.title,
        content: page.content,
        draft: 0,
        uid: adminUid,
      });
      summary.pages++;
    } else if (overwrite || (existing.uid === null && adminUid !== null)) {
      await db
        .update(schema.pages)
        .set({
          ...(overwrite ? {
            title: page.title,
            content: page.content,
            draft: 0,
          } : {}),
          uid: existing.uid ?? adminUid,
          updatedAt: new Date(),
        })
        .where(eq(schema.pages.id, existing.id));
      summary.pages++;
    }
  }

  // 7. Default Site Configs (if empty)
  for (const [key, value] of Object.entries(defaultSiteConfig)) {
    const existing = await db.query.siteConfigs.findFirst({
      where: eq(schema.siteConfigs.key, key),
    });
    if (!existing) {
      await db.insert(schema.siteConfigs).values({
        key,
        value: JSON.stringify(value),
      });
    }
  }

  return summary;
}

