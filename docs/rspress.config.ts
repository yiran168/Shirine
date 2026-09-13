import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: process.env.BASE_PATH || '/Shirine/',
  lang: 'zh',
  title: 'Shirine',
  description: 'Shirine 是一个基于 Material 3 Expressive 设计与 Cloudflare 全家桶的现代二次元动态全栈博客系统。',
  icon: '/shirine-icon.png',
  logo: '/shirine-logo.png',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Shirine',
      description: 'Material 3 Expressive dynamic blog based on Cloudflare',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Shirine',
      description: '基于 Material 3 Expressive 与 Cloudflare 的二次元动态博客系统',
    },
  ],
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/yiran168/Shirine' },
    ],
  },
  i18nSource: {
    outlineTitle: {
      zh: '大纲',
      en: 'ON THIS PAGE',
    },
  },
});
