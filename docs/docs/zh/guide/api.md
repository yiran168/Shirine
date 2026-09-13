# REST API 接口文档

Shirine 后端基于 Cloudflare Workers + Hono 构建，所有接口响应均遵循标准 JSON 格式。

---

## 统一响应格式

```json
{
  "success": true,
  "data": { ... },
  "error": "若失败时返回错误描述"
}
```

---

## 一、用户与认证接口 (`/api/auth`, `/api/user`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | 公开 | 用户注册（首位注册者自动成为超级管理员） |
| `/api/auth/login` | `POST` | 公开 | 用户登录，返回 JWT Token |
| `/api/auth/me` | `GET` | 登录用户 | 获取当前登录用户的详细信息与积分 |
| `/api/auth/logout` | `POST` | 登录用户 | 退出登录 |
| `/api/user/checkin` | `POST` | 登录用户 | 每日打卡签到，计算积分奖励与连签天数 |
| `/api/user/history` | `GET` | 登录用户 | 获取个人签到记录历史 |
| `/api/user/profile` | `PUT` | 登录用户 | 更新个人昵称、头像或密码 |

---

## 二、博文接口 (`/api/posts`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/posts` | `GET` | 公开 | 获取博文列表（支持分页、分类与标签筛选） |
| `/api/posts/:slugOrId` | `GET` | 智能权限 | 获取单篇博文详情（未满足权限时脱敏） |
| `/api/posts/:id/unlock` | `POST` | 登录用户 | 使用账户积分永久解锁指定文章 |
| `/api/posts` | `POST` | 管理员 | 发布新博文 |
| `/api/posts/:id` | `PUT` | 管理员 | 更新博文内容与权限设定 |
| `/api/posts/:id` | `DELETE` | 管理员 | 删除指定博文 |

---

## 三、相册图库接口 (`/api/albums`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/albums` | `GET` | 公开 | 获取相册列表 |
| `/api/albums/:id` | `GET` | 智能权限 | 获取相册详情及照片列表 |
| `/api/albums/:id/unlock` | `POST` | 登录用户 | 使用账户积分永久解锁相册 |
| `/api/albums` | `POST` | 管理员 | 新建相册 |
| `/api/albums/:id` | `PUT` | 管理员 | 更新相册信息 |
| `/api/albums/:id` | `DELETE` | 管理员 | 删除指定相册 |

---

## 四、动态日记接口 (`/api/moments`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/moments` | `GET` | 公开 | 获取动态日记列表 |
| `/api/moments` | `POST` | 管理员 | 发布新动态日记（支持心情、位置与图片） |
| `/api/moments/:id` | `DELETE` | 管理员 | 删除动态日记 |

---

## 五、友链申请与管理 (`/api/friends`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/friends` | `GET` | 公开 | 获取已批准友链列表 |
| `/api/friends/apply` | `POST` | 公开 | 访客提交友链申请 |
| `/api/friends/:id` | `PUT` | 管理员 | 更新友链或批准状态 (`status: approved`) |
| `/api/friends/:id` | `DELETE` | 管理员 | 删除友链 |

---

## 六、全站与系统管理 (`/api/admin`, `/api/config`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/admin/stats` | `GET` | 管理员 | 获取全站概览统计数据 |
| `/api/admin/users` | `GET` | 管理员 | 分页获取所有注册用户列表 |
| `/api/admin/users/:id/points` | `PUT` | 管理员 | 调整指定用户的积分余额（支持正负增减） |
| `/api/admin/users/:id/role` | `PUT` | 超级管理员 | 变更用户角色 (`superadmin`/`admin`/`user`) |
| `/api/admin/users/:id/status` | `PUT` | 管理员 | 封禁或解封用户 |
| `/api/config/site` | `GET` | 公开 | 获取全站视觉与基础配置 |
| `/api/config/site` | `PUT` | 管理员 | 更新全站视觉配置 |
| `/api/config/system` | `GET` | 公开 | 获取公开系统配置 (Turnstile 开关等) |
| `/api/config/system/admin` | `GET` | 管理员 | 获取包含密钥与签到模式的完整配置 |
| `/api/config/system` | `PUT` | 管理员 | 保存签到规则、Turnstile 密钥及看板娘配置 |

---

## 七、文件上传 (`/api/upload`)

| 路径 | 方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/upload` | `POST` | 管理员 | 上传图片到 Cloudflare R2，返回公开访问 URL |
