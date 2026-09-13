# RSS 与 Atom 订阅

Shirine 原生支持符合 RSS 2.0 与 Atom 1.0 标准的全文订阅功能，方便读者通过 NetNewsWire、Inoreader、Feedly、Follow 等阅读器第一时间获取文章更新。

---

## 一、订阅地址

- **RSS 2.0 地址**：
  ```
  https://your-domain.com/rss.xml
  ```
- **Atom 1.0 地址**：
  ```
  https://your-domain.com/atom.xml
  ```

---

## 二、权限过滤机制

为保护博主的私密与会员内容，Shirine 的 Feed 生成器内置了智能权限过滤：
- **完全公开 (`public`)** 的博文会完整输出标题、描述、分类、标签与正文；
- **需要登录 (`login_required`)** 与 **积分解锁 (`points_required`)** 的博文仅输出标题与受限提示，正文不会在公共订阅源中泄露，兼顾传播与隐私保护。
