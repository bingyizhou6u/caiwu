# AR公司财务管理系统 - AI 配置

> 项目特定上下文，配合全局规则使用  
> 📚 完整文档: [知识库索引](docs/README.md)

## 核心架构

| 层级 | 技术栈 |
|------|--------|
| Frontend | React + Vite + Pages |
| Backend | Hono + Workers |
| Database | D1 (SQLite) |
| Storage | R2 + KV |

## 关键决策

| 决策 | 说明 |
|------|------|
| ORM | Drizzle (非 Prisma) |
| 状态管理 | React Query (非 Redux) |
| 用户数据 | `employees` 表 (无单独 `users` 表) |
| 金额存储 | 整数 (cents) |
| 权限架构 | IP → JWT+TOTP → RBAC → DataScope → Approval |
| 时区标准 | UTC+4 (迪拜时间)，使用 `getBusinessDate()` |

## 快速索引

| 资源 | 路径 |
|------|------|
| 知识库索引 | [docs/README.md](docs/README.md) |
| 数据库 Schema | [backend/src/db/schema.ts](backend/src/db/schema.ts) |
| API 路由 | `backend/src/routes/v2/` |
| 前端功能 | `frontend/src/features/` |
| 开发规范 | [docs/standards/development.md](docs/standards/development.md) |
| 权限系统 | [docs/backend/permissions.md](docs/backend/permissions.md) |

## 常用命令

```bash
# 开发 (并行运行)
cd backend && npm run dev    # :8787
cd frontend && npm run dev   # :5173

# 数据库迁移
cd backend && npm run migrate:up

# 部署
cd backend && npm run deploy
cd frontend && npm run build
```

## 项目约定

- API 响应格式: `{ success, data, message?, error? }`
- 日期字符串使用 `getBusinessDate()` 而非 `new Date()`
- 金额计算使用整数 (cents)，显示时除以 100
- 权限判断使用 `dataScope` 而非硬编码职位代码

---

**最后更新**: 2025-12-30
