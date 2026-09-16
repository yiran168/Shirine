# Original User Request

## Initial Request — 2026-09-16T10:49:19Z

全面核查并完善基于 Astro + Cloudflare Workers + D1 数据库架构的 Shirine 动态博客系统，确保满足所有功能模块、安全标准、品牌约束与代码规范。

Working directory: `d:\MiMo Desktop\项目\1\Shirine`
Integrity mode: development

## Reference Repositories & Docs
- `D:\MiMo Desktop\项目\1\live2d-widget-master` (https://github.com/stevenjoezhang/live2d-widget)
- `D:\MiMo Desktop\项目\1\Mizuki-master` (https://github.com/LyraVoid/Mizuki)
- `D:\MiMo Desktop\项目\1\Rin-main` (https://github.com/openRin/Rin)
- `D:\MiMo Desktop\项目\1\Shirone-main` (https://github.com/LyraVoid/Shirone)
- Rin 官方指南 (https://docs.openrin.org/guide/)
- 原 Shirone 官方指南 (https://docs.shirone.mysqil.com/guide/)

## Requirements

### R1. 品牌唯一性与工作区边界约束
全项目品牌标识严格且唯一为 `Shirine`，全工程代码、注释、文档、配置中严禁残留 `Shirone` 等旧名称。所有源码文件、构建产物、静态资源严格保存在 `d:\MiMo Desktop\项目\1\Shirine` 文件夹内，禁止在 C 盘或项目外创建、放置任何文件。

### R2. 核心前后端分离架构改造
100% 保留原生视觉风格、组件体系、交互动效、排版体验与内容渲染。前端（Cloudflare Pages + Astro SSR）数据源从静态本地 Markdown 完全替换为运行时调用后端 API；后端（Cloudflare Workers + D1 数据库）提供完整 RESTful API，杜绝 O(N) 全量文章扫描，实现 O(1) 单篇按需直查与 Astro SSR 透明代理。

### R3. 用户体系与积分签到系统
支持用户注册与登录，系统初始化时首个管理员账号通过安全 Setup 创建为超级管理员，后续常规注册用户均为普通用户。普通用户登录后支持每日签到并获取积分（当日已签到按钮置灰防重）；管理员可在后台可视化配置固定积分模式或随机积分区间规则，保存即时生效。

### R4. 三级内容权限控制与视觉标识
博客文章与相册统一支持三级权限设置（公开、登录可见、积分购买可见），可在发布时及发布后随时修改。在列表卡片封面图居中叠加半透明毛玻璃锁定遮罩（`CoverLockOverlay`），并在标题正上方显示权限徽章（`PermissionBadge`）；积分解锁采用 D1 原子事务扣减与独立 `point_transactions` 账本记录，未授权或未购买用户无法获取正文及私有原图。

### R5. 全量后台可视化 CMS 管理
所有原生支持的内容类型（文章、独立页面、相册、导航菜单、友情链接、侧边栏、横幅、页脚模块）全部支持可视化管理，包括增删改查与上下架。前台所有示例数据在后台均可自由编辑或删除。支持站点基础信息、主题配色、明暗模式、布局调整、组件开关、SEO 设置等可视化修改，实时生效。

### R6. Cloudflare Turnstile 人机安全验证
后台支持一键开关登录/注册页面的 Turnstile 人机验证，支持安全配置 Site Key 与环境变量优先的 Secret Key。服务端完成校验逻辑，前端非侵入式加载并在验证失败时自动重置防锁死，后台内嵌登录提供安全弹窗入口。

### R7. 四语言国际化（i18n）
前台访客端与后台管理端均完整支持 4 种语言切换：简体中文（zh_CN）、英文（en）、繁体中文（zh_TW）、日文（ja）。后台可配置站点默认语言，系统自动记忆用户本地语言偏好。

### R8. Live2D 看板娘组件双端集成
前台访客端与后台管理页面均集成 Live2D 看板娘挂件，使用 iframe 沙盒隔离。管理员可在后台独立配置是否对访客开启、是否对管理员开启；用户端提供悬浮控制按钮（🌸/✨），可手动切换显示/隐藏并本地持久化记忆。

### R9. 全局导航栏头像菜单与 20 张二次元预设头像库
- **导航栏集成**：在右上角深色/浅色切换按钮旁挂载正圆形头像按钮，点击展开下拉菜单，点击外部自动收起。
- **三态动态渲染**：
  1. 未登录：显示默认访客图标，下拉显示「登录」/「注册账号」；
  2. 普通用户：显示当前头像，下拉显示「每日签到」（含获得积分弹窗与当日已签到置灰）、「更换头像」、「退出登录」，不暴露后台管理入口；
  3. 管理员：显示管理员头像，下拉显示「管理后台」（跳转 `/admin`）、「更换头像」、「退出登录」，隐藏签到与积分选项。
- **20 张预设 WebP 头像库**：提供 20 张不同发色、发型、服饰、形象的居中二次元动漫 WebP 头像（含完整尺寸与缩略图），点击「更换头像」呼出 20 宫格选择面板，点击即刻通过 `PUT /api/user/profile` 实时生效，并附带完整可用访问路径与 AI 批量生成提示词清单。
- **多语言文案规范**：4 语言文案严格匹配（登录/登入/Sign in/ログイン、注册账号/註冊帳號/Sign up/新規登録、每日签到/每日簽到/Daily check-in/毎日チェックイン、今日已签到/今日已簽到/Checked in today/チェックイン済み、更换头像/更換頭像/Change avatar/アバター変更、退出登录/退出登入/Sign out/ログアウト、管理后台/管理後台/Admin panel/管理画面）。

---

## Acceptance Criteria

### 1. 规范与边界检查
- [ ] 全工程检索 `shirone` 严格为 0 处匹配，品牌名称仅为 `Shirine`。
- [ ] 检查文件存储路径，全工程所有新增与修改文件均在 `d:\MiMo Desktop\项目\1\Shirine` 内，无 C 盘文件写入。

### 2. 构建与类型安全
- [ ] `cd server && bun run tsc --noEmit` 执行无报错，退出码为 0。
- [ ] `cd client && bun run build` 执行无报错，生产构建成功，退出码为 0。

### 3. API 与数据库完整性
- [ ] `schema.sql`、`schema.ts` 完整定义并对齐用户表、文章表、相册表、签到表、解锁表、流水表、配置表与撤权表。
- [ ] 积分解锁、签到加分与管理员调分均采用原子事务并写入 `point_transactions` 账本。
- [ ] 前台所有示例数据（文章、相册、Moments、友链）均可通过后台管理中心直接修改或删除。

### 4. 权限与安全防护
- [ ] 受密码保护的文章必须通过 `POST /api/posts/:id/password/verify` 校验，禁止通过 URL Query 传递明文密码，解锁接口无法绕过密码闸门。
- [ ] 受保护媒体（Blob）先鉴权后读取 R2，未关联新上传资源默认私有封存，D1 异常时 Fail-closed 拦截。
- [ ] 图片上传自动剥离 JPEG APP1 与 WebP EXIF/XMP 元数据，清除 GPS 与设备隐私。
- [ ] JSON-LD 包含 `< > &` 转义处理，阻断 `</script>` 提前闭合 XSS。

### 5. 导航栏用户头像与预设头像库
- [ ] 导航栏右上角圆形头像下拉菜单在未登录、普通用户、管理员三种状态下精准切换。
- [ ] 4 种语言文案与多语言规范表 100% 严格一致。
- [ ] 20 张二次元 WebP 头像资源齐全，网格面板支持实时切换并持久化保存。
