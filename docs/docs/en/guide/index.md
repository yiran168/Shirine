# Introduction

Shirine is a modern anime dynamic blog system built on Astro 5 and the Cloudflare full-stack ecosystem (Cloudflare Pages SSR + Workers + D1 distributed database + R2 object storage), deeply following the Material 3 Expressive (M3E) design standard.

## Repository

- GitHub: [https://github.com/yiran168/Shirine](https://github.com/yiran168/Shirine)

## Key Features

1. **Material 3 Expressive Design**: 100% compliant with Google M3E design tokens, fluid layouts, and expressive spring animations. Features HCT dynamic color extraction to automatically derive compliant tonal palettes across 0-360° hues.
2. **Instant Dynamic Publishing**: Frontend powered by Astro 5 SSR on Cloudflare Pages; backend powered by Cloudflare Workers + Hono + Drizzle ORM. Content persists in Cloudflare D1 and assets in Cloudflare R2. Published articles, albums, and moments appear immediately on refresh.
3. **3-Tier Content Permissions & Points Store**: Supports Public, Login Required (frosted glass lock card), and Points Required (configurable points to unlock permanently with celebratory confetti animation).
4. **Daily Check-in & Rewards Engine**: Offers fixed points and random range modes, tracking consecutive streaks and transaction ledgers.
5. **50 Preset Anime WebP Avatars**: Includes 50 curated high-res anime avatars with optimized thumbnails and responsive modal picker.
6. **Sandboxed Pio Live2D Widget**: Embedded inside an isolated iframe to prevent style leakage, with independent toggles for visitors and admin, customizable multilingual quotes, and non-obscured top z-index.
7. **Multi-Source Music Player**: Seamlessly supports local presets, custom R2 audio URLs, and Meting remote playlists (NetEase Cloud Music, QQ Music, Kugou), with metadata preloading to eliminate duration delay.
8. **Rich Markdown Extension Ecosystem**: Admonitions, Steps containers, Collapsible panels, Code tabs, Mermaid diagrams, KaTeX math expressions, and media embeds.
9. **Integrated AI Writing Assistant**: Streaming content generation with foldable reasoning/thought process display and request timeout handling.
10. **Cloudflare Turnstile Anti-Bot Security**: Frictionless bot verification to protect sensitive actions against automated attacks.
11. **Comprehensive Internationalization (i18n)**: Full 4-language support across frontend and admin dashboard (Simplified Chinese, Traditional Chinese, English, Japanese).
12. **RSS 2.0 & Atom 1.0 Feeds**: Built-in permission filtration preventing protected content from leaking into public feeds.
