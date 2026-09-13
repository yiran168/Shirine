# Webhook 通知与同步

Shirine 支持在发生关键业务事件（如新博文发布、新用户注册、新友链申请）时触发外部 Webhook，方便博主通过 Discord、Telegram、飞书、企业微信或自定义 API 获取即时通知。

---

## 一、支持触发的事件

- `post.created`：当发布新博文时触发；
- `post.updated`：当博文内容更新时触发；
- `user.registered`：新用户注册通知；
- `friend.applied`：访客提交新友链申请时通知审核。

---

## 二、Webhook 负载格式 (Payload)

Webhook 请求统一使用 `POST` 方法，Content-Type 为 `application/json`：

```json
{
  "event": "post.created",
  "timestamp": 1726243200000,
  "data": {
    "id": 12,
    "title": "Shirine 博客系统正式上线！",
    "slug": "hello-shirine",
    "category": "Announcement",
    "url": "https://shirine.example.com/posts/hello-shirine/"
  }
}
```

---

## 三、签名校验 (Security Signature)

为防止请求伪造，每个 Webhook 请求的请求头中均包含基于 HMAC-SHA256 计算的签名：

```http
X-Shirine-Signature: sha256=5d41402abc4b2a76b9719d911017c592...
```

接收端使用相同的秘钥对接收到的请求体原始数据执行 HMAC-SHA256 计算，对比是否一致即可完成合法性校验。
