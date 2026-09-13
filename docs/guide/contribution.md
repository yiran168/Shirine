# 贡献指南 (Contribution Guide)

感谢你关注并有意向为 Shirine 做出贡献！

---

## 一、贡献流程

1. **Fork 本仓库** 到你个人的 GitHub 账号；
2. **克隆你的 Fork 分支** 到本地进行开发；
3. **创建新特性分支**：
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. **进行开发与本地验证**：确保格式规范、测试通过；
5. **遵循提交规范** 提交代码；
6. **推送到你的 GitHub 仓库** 并向 `yiran168/Shirine` 的 `main` 分支发起 Pull Request (PR)；
7. 维护者将对你的 PR 进行审查并合并。

---

## 二、代码风格与规范

- 使用 TypeScript 保持严格类型安全；
- 前端组件遵循 Svelte 5 与 Astro 规范；
- 严禁硬编码敏感信息（如 JWT 密钥、密码、API 私钥）；
- 保持 Material 3 Expressive 的优雅二次元视觉调性。
