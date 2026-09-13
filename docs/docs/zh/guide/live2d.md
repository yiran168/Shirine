# Live2D 看板娘集成

Shirine 集成了基于 **Pio 看板娘组件**的二次元交互系统。

---

## 一、架构设计：iframe 沙箱隔离

传统博客在全局引入 Live2D 看板娘时，经常遇到脚本污染、全局 CSS 冲突（如 Tailwind 类名覆盖）、页面无刷新跳转导致动画重复初始化等棘手问题。

Shirine 采用 **iframe 沙箱隔离方案**：
- 在 `client/public/pio/live2d-host.html` 中运行看板娘独立沙箱；
- 沙箱内部完整隔离了模型资源、Canvas 渲染与提示气泡脚本；
- 前端通过 `client/src/components/features/pio/Live2DControl.svelte` 挂载；
- 博客主页面与看板娘互不影响，页面路由切换时依然平滑稳定。

---

## 二、双端独立控制与访客悬浮按钮

1. **后台独立控制**：
   管理员可在后台 **系统与设置** 中独立控制：
   - **前台博客页面是否展示看板娘** (`live2dGuestEnable`)；
   - **后台管理页面是否展示看板娘** (`live2dAdminEnable`)。

2. **访客端快捷开关**：
   在前台页面右下角，常驻一枚精美的悬浮猫耳图标按钮。访客可随时点击收起或展开看板娘，偏好自动保存在本地 `localStorage`，尊重每位访客的浏览习惯。

---

## 三、模型与资源存放

看板娘资源统一存放在客户端静态目录：
```
client/public/pio/
├── live2d-host.html    # 沙箱宿主页面
├── live2d.min.js       # Live2D 核心解析引擎
├── pio.js              # 交互逻辑脚本
├── pio.css             # 看板娘样式表
└── models/             # 模型资源文件夹 (包含 model.json, 纹理与动作文件)
```
你可以通过将新的 Live2D 2.0 模型放入 `models/` 目录，轻松为 Shirine 替换任意喜爱的动漫角色！
