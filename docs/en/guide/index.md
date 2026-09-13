# Introduction to Shirine

**Shirine** is an exquisite, dynamic anime-styled full-stack blog system designed for tech enthusiasts, otaku culture lovers, and creators.

It combines the aesthetic Google Material 3 Expressive (2025) design system with the modern serverless architecture of Cloudflare Workers and D1 database.

---

## 🌟 Highlights

- **Visuals & UX**:
  - Material 3 Expressive large rounded corners, elevation shadows, and smooth micro-interactions.
  - HCT dynamic color palette with dynamic theme hue (0-360°).
  - Rich Markdown extensions: Admonitions, Steps, Collapse panels, Mermaid diagrams, KaTeX formulas, and Bilibili/Audio players.
- **Dynamic Full-Stack**:
  - Frontend: Astro 5 SSR + Svelte 5 + Tailwind CSS 4.
  - Backend: Cloudflare Workers + Hono + Drizzle ORM.
  - Storage: Cloudflare D1 for SQL data, Cloudflare R2 for images.
  - Instant updates: Modify in admin panel, refresh frontend to see changes immediately.
- **Points & Permissions**:
  - Automatic Superadmin for the first registered user.
  - Daily check-in system with configurable fixed or random points range.
  - 3-tier content permissions: Public, Login Required, Points Unlock.
- **Global Nav Avatar Menu**:
  - 3-state adaptive avatar dropdown (Guest, Normal User, Admin).
  - 20 preset anime WebP avatars switcher modal.
- **Live2D Pio Widget**:
  - Sandboxed inside an isolated iframe, eliminating CSS and script collisions.
  - Independent switches for guest frontend and admin dashboard.
