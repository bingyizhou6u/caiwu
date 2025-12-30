# Project Structure

> 详细文档: [知识库索引](../../docs/README.md)

## Monorepo Layout

```
/
├── backend/           # Cloudflare Workers API
├── frontend/          # React SPA
├── email-worker/      # Email service worker
└── docs/              # 📚 知识库文档
```

## Backend (`/backend/src`)

| 目录 | 说明 | 文档 |
|------|------|------|
| `routes/v2/` | API 路由 (OpenAPI) | [API 参考](../../docs/backend/api-reference.md) |
| `services/` | 业务逻辑（按域分组） | [服务架构](../../docs/backend/services.md) |
| `middleware/` | 认证、权限、监控 | [权限系统](../../docs/backend/permissions.md) |
| `db/` | Schema + 迁移 | [数据库设计](../../docs/backend/database.md) |
| `schemas/` | Zod 验证 | - |
| `utils/` | 工具函数 | - |

服务按域分组: `assets/`, `auth/`, `common/`, `finance/`, `hr/`, `pm/`, `reports/`, `system/`

## Frontend (`/frontend/src`)

| 目录 | 说明 | 文档 |
|------|------|------|
| `features/` | 业务模块（按域划分） | - |
| `components/` | 公共组件 | [表单组件](../../docs/frontend/form-components.md) |
| `hooks/` | 自定义 Hooks | [Hooks 文档](../../docs/frontend/hooks.md) |
| `router/` | 路由配置 | [路由配置](../../docs/frontend/router.md) |
| `store/` | Zustand 状态 | - |
| `types/` | TypeScript 类型 | - |

## Key Patterns

- **Services**: 一个服务对应一个业务实体，按域分组
- **Routes**: OpenAPI-first，zod-openapi 验证
- **Features**: 自包含模块（pages, hooks, components）
- **Hooks**: 业务逻辑在 `hooks/business/`，表单在 `hooks/forms/`

详见 [开发规范](../../docs/standards/development.md) | [架构评审](../../docs/architecture/review.md)
