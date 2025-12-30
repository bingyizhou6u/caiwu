# Tech Stack

> 详细文档: [知识库索引](../../docs/README.md)

## Backend (`/backend`)

| 技术 | 说明 | 文档 |
|------|------|------|
| Runtime | Cloudflare Workers | [部署指南](../../docs/guides/deploy.md) |
| Framework | Hono + OpenAPI | [API 参考](../../docs/backend/api-reference.md) |
| Database | D1 (SQLite) + Drizzle | [数据库设计](../../docs/backend/database.md) |
| Storage | R2 (文件), KV (缓存) | - |
| Validation | Zod schemas | - |

## Frontend (`/frontend`)

| 技术 | 说明 | 文档 |
|------|------|------|
| Framework | React 18 + TypeScript | [路由配置](../../docs/frontend/router.md) |
| Build | Vite | - |
| UI | Ant Design 5 | [表单组件](../../docs/frontend/form-components.md) |
| State | Zustand + React Query | [Hooks](../../docs/frontend/hooks.md) |
| Testing | Vitest + Playwright | [测试指南](../../docs/guides/testing.md) |

## Quick Commands

```bash
# 开发
cd backend && npm run dev    # :8787
cd frontend && npm run dev   # :5173

# 测试
npm test                     # 单元测试
npm run test:coverage        # 覆盖率

# 数据库
npm run migrate:up           # 本地迁移
npm run migrate:up:remote    # 远程迁移

# 部署
npm run deploy               # 部署 Workers
```

详见 [开发规范](../../docs/standards/development.md) | [测试指南](../../docs/guides/testing.md)
