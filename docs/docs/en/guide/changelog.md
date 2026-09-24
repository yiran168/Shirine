# Changelog

### v1.0.0 2026-09-24 Official Release

#### Full-Stack Architecture Evolution

- **Astro 5 + Cloudflare Ecosystem**:
  - Frontend built with Astro 5 SSR and Svelte 5 islands, delivered globally via Cloudflare Pages.
  - Backend engineered with Cloudflare Workers + Hono + Drizzle ORM, with fast edge cold starts and bundle size strictly under 25MB.
  - Relational persistence in Cloudflare D1 distributed SQLite database, and media assets in Cloudflare R2 bucket.

#### Key Features & Enhancements

- **Material 3 Expressive (M3E) Design System**:
  - Full adherence to Google M3E design tokens, fluid container layouts, and responsive state layers.
  - HCT dynamic color palette generator deriving compliant tonal palettes from single hue inputs (0-360°).
  - Brand-new Chibi Genshin Impact Furina hydro-themed seamless looping loading SVG animation.
- **3-Tier Content Permissions & Points Engine**:
  - Public, Login Required, and Points Required access tiers with frosted glass locking cards and celebratory confetti particles.
  - Daily check-in system supporting fixed rewards and randomized reward ranges with streak tracking.
- **50 Unique Anime WebP Avatars**:
  - 50 uniquely crafted anime avatars and high-definition thumbnails with intuitive grid switcher modal.
- **Sandboxed Pio Live2D Companion**:
  - Enhanced iframe sandbox preventing stylesheet pollution, featuring floating summon controls and persistent multilingual dialogues.
- **Dynamic Multi-Source Music Player**:
  - Native support for local presets, custom R2 audio streams, and Meting remote playlists (NetEase, QQ Music, Kugou).
  - Instant duration loading with `preload="metadata"` and automatic runtime synchronization.
- **Integrated AI Writing Assistant**:
  - Real-time streaming generation with collapsible thinking/reasoning chain inspection and graceful timeout recovery.
- **Admin Markdown Handbook & Sticky TOC Jump Navigation**:
  - Comprehensive Markdown reference manual with copyable templates and sticky right-hand quick jump navigation.
- **Frictionless Security & 4-Language i18n**:
  - Seamless Cloudflare Turnstile anti-bot integration.
  - Full localization in English, Simplified Chinese, Traditional Chinese, and Japanese across all components.