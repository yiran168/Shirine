# 版本发布流程 (Release Guide)

Shirine 遵循 [语义化版本规范 (Semantic Versioning)](https://semver.org/)：`主版本号.次版本号.修订号` (`MAJOR.MINOR.PATCH`)。

---

## 一、版本号规则

- **MAJOR (主版本)**：当引入不兼容的 API 变动或数据库颠覆性升级时增加；
- **MINOR (次版本)**：以向后兼容的方式添加新功能时增加；
- **PATCH (修订号)**：以向后兼容的方式进行问题修复时增加。

---

## 二、发布步骤

1. **准备更新日志 (Changelog)**：整理当前版本的所有新增特性与缺陷修复；
2. **打标签 (Git Tag)**：
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0: Initial stable release of Shirine"
   ```
3. **推送标签到远程**：
   ```bash
   git push origin v1.0.0
   ```
4. **触发 GitHub Actions Release**：
   - 自动在 GitHub Releases 页面创建新发布，并附带源码归档与编译产物；
   - 触发 Cloudflare Pages、Workers 以及 GitHub Pages 文档站点的自动部署。
