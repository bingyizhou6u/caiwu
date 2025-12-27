---
description: Start local development environment
---
# 开发环境启动工作流

用于启动本地全栈开发环境。

## 1. 启动后端

后端运行在 `http://localhost:8787`。

```bash
cd backend
// turbo
npm run dev
```

## 2. 启动前端

前端运行在 `http://localhost:5173`。

```bash
cd frontend
// turbo
npm run dev
```

## 3. 数据库管理 (可选)

如果需要查看或管理本地 D1 数据库：

```bash
cd backend
npm run db:studio
```
