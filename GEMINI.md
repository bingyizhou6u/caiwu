# AR公司财务管理系统 - AI 配置

> 项目特定上下文，配合全局规则使用

## 核心架构

| 层级 | 技术栈 |
|------|--------|
| **Frontend** | React + Vite + Pages |
| **Backend** | Hono + Workers |
| **Database** | D1 (SQLite) |
| **Storage** | R2 + KV |

### 关键决策

- **ORM**: Drizzle (非 Prisma)
- **状态管理**: React Query (非 Redux)
- **用户数据**: `employees` 表 (无单独 `users` 表)
- **金额存储**: 整数 (cents)
- **权限架构**: IP → JWT+TOTP → RBAC → DataScope → Approval
- **时区标准**: UTC+4 (迪拜时间)，使用 `getBusinessDate()`

## 快速索引

| 资源 | 路径 |
|------|------|
| 知识库索引 | [`.agent/KNOWLEDGE_INDEX.md`](.agent/KNOWLEDGE_INDEX.md) |
| 数据库 Schema | [`backend/src/db/schema.ts`](backend/src/db/schema.ts) |
| API 路由 | `backend/src/routes/v2/` |
| 前端功能 | `frontend/src/features/` |
| 部署配置 | [`backend/wrangler.toml`](backend/wrangler.toml) |

## 常用命令

```bash
# 开发 (并行运行)
cd backend && npm run dev    # :8787
cd frontend && npm run dev   # :5173

# 数据库迁移
cd backend && npm run migrate:all

# 部署
cd backend && npm run deploy
cd frontend && npm run build
```

## 项目约定

- API 响应格式: `{ success, data, message?, error? }`
- 日期字符串使用 `getBusinessDate()` 而非 `new Date()`
- 金额计算使用整数 (cents)，显示时除以 100
