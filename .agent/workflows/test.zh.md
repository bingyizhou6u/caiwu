---
description: Run tests for backend and frontend
---
# 测试工作流

本工作流基于 `TESTING.md`，用于运行项目的各类测试。

## 后端测试

```bash
cd backend

# 运行所有测试
// turbo
npm test

# 运行特定测试 (示例)
# npm test test/routes/auth.test.ts
```

### 覆盖率检查

```bash
cd backend
npm run test:coverage
```

## 前端测试

```bash
cd frontend

# 运行单元测试
npm run test:unit
```

##  E2E 测试

```bash
cd frontend
npm run test:e2e
```
