import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Shirine",
  description: "Material 3 Expressive Dynamic Anime Blog System on Cloudflare Pages + Workers + D1 + R2",
  head: [["link", { rel: "icon", href: "/logo/icon.webp" }]],
  locales: {
    root: {
      label: "简体中文",
      lang: "zh-CN",
      themeConfig: {
        nav: [
          { text: "指南", link: "/guide/" },
          { text: "部署", link: "/guide/deploy" },
          { text: "管理后台", link: "/guide/admin" },
          { text: "API", link: "/guide/api" },
        ],
        sidebar: [
          {
            text: "开始使用",
            items: [
              { text: "介绍", link: "/guide/" },
              { text: "部署指南", link: "/guide/deploy" },
              { text: "本地开发", link: "/guide/development" },
            ],
          },
          {
            text: "核心功能与架构",
            items: [
              { text: "用户、权限与积分体系", link: "/guide/permissions" },
              { text: "管理后台与实时更新", link: "/guide/admin" },
              { text: "Live2D 看板娘集成", link: "/guide/live2d" },
              { text: "Cloudflare Turnstile 人机防护", link: "/guide/turnstile" },
              { text: "Webhook 通知与同步", link: "/guide/webhook" },
              { text: "RSS 与 Atom 订阅", link: "/guide/rss" },
            ],
          },
          {
            text: "工程化与规范",
            items: [
              { text: "自动化测试", link: "/guide/testing" },
              { text: "Git 提交规范", link: "/guide/commit-convention" },
              { text: "贡献指南", link: "/guide/contribution" },
              { text: "版本发布", link: "/guide/release" },
            ],
          },
          {
            text: "接口参考",
            items: [{ text: "API 接口文档", link: "/guide/api" }],
          },
        ],
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      link: "/en/",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/guide/" },
          { text: "Deploy", link: "/en/guide/deploy" },
          { text: "Admin", link: "/en/guide/admin" },
          { text: "API", link: "/en/guide/api" },
        ],
        sidebar: [
          {
            text: "Getting Started",
            items: [
              { text: "Introduction", link: "/en/guide/" },
              { text: "Deployment", link: "/en/guide/deploy" },
              { text: "Development", link: "/en/guide/development" },
            ],
          },
          {
            text: "Core Features",
            items: [
              { text: "Users, Permissions & Points", link: "/en/guide/permissions" },
              { text: "Admin Console & Real-time Updates", link: "/en/guide/admin" },
              { text: "Live2D Widget Integration", link: "/en/guide/live2d" },
              { text: "Cloudflare Turnstile", link: "/en/guide/turnstile" },
              { text: "Webhook", link: "/en/guide/webhook" },
              { text: "RSS & Atom", link: "/en/guide/rss" },
            ],
          },
          {
            text: "Engineering",
            items: [
              { text: "Testing", link: "/en/guide/testing" },
              { text: "Commit Convention", link: "/en/guide/commit-convention" },
              { text: "Contribution", link: "/en/guide/contribution" },
              { text: "Release", link: "/en/guide/release" },
            ],
          },
          {
            text: "Reference",
            items: [{ text: "API Reference", link: "/en/guide/api" }],
          },
        ],
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/yiran168/Shirine" }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Shirine Team",
    },
  },
});
