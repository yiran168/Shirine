# Git 提交规范 (Commit Convention)

Shirine 遵循 [Conventional Commits (常规提交规范)](https://www.conventionalcommits.org/)，以便自动化生成清晰的更新日志 (Changelog) 与版本发布说明。

---

## 一、提交格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

---

## 二、常用类型 (Type)

- `feat`: 新增功能 (Feature)
- `fix`: 修复 Bug
- `docs`: 文档变更
- `style`: 代码格式调整（不影响逻辑的变动）
- `refactor`: 重构代码（既不修复 bug 也不新增功能的变动）
- `perf`: 性能优化
- `test`: 增加或修改测试用例
- `chore`: 构建系统或外部依赖的维护
- `ci`: CI/CD 自动化流水线修改

---

## 三、常用作用域 (Scope)

- `client`: 前端组件与页面
- `server`: 后端 API 与路由
- `db`: 数据库迁移与 Schema
- `docs`: 文档系统
- `auth`: 用户认证与权限体系
- `live2d`: 看板娘相关

---

## 四、良好示例

```bash
git commit -m "feat(auth): add 20 anime avatars switcher and daily checkin engine"
git commit -m "fix(server): handle negative points adjustment in admin route"
git commit -m "docs(deploy): add Cloudflare Pages and Workers setup walkthrough"
```
