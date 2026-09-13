# 自动化测试 (Testing)

Shirine 遵循高品质开源软件工程标准，包含单元测试、API 集成测试与端到端测试覆盖。

---

## 一、测试工具链

- **服务端测试**：基于 `vitest` 与 `@cloudflare/workers-types`，模拟 Cloudflare Workers 与 D1 内存数据库环境；
- **客户端测试**：基于 `astro check` 进行强类型与模板语法验证。

---

## 二、运行测试命令

### 1. 运行服务端测试
```bash
cd server
npm test
```

### 2. 运行客户端类型与模板检查
```bash
cd client
npx astro check
```

---

## 三、CI 流水线中的测试

在每次提交代码或向 `main` 分支发起 Pull Request 时，GitHub Actions 会自动运行构建与测试矩阵，确保代码质量稳定可控。
