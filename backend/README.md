# AR公司财务管理系统 - 后端服务

> 基于 Cloudflare Workers + Hono + Drizzle ORM 构建的企业财务管理系统后端  
> 📚 完整文档: [知识库索引](../docs/README.md)

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账户
- Wrangler CLI

### 安装与运行

```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 启动开发服务器 (端口 8787)
npm run dev
```

### 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run typecheck        # 类型检查
npm run lint             # 代码检查
npm run format           # 格式化代码

# 测试
npm test                 # 运行测试
npm run test:coverage    # 测试覆盖率

# 数据库
npm run migrate:up       # 应用迁移（本地）
npm run migrate:up:remote # 应用迁移（远程）
npm run db:studio        # 打开数据库可视化

# 部署
npm run deploy           # 部署到 Workers
npm run gen:openapi      # 生成 OpenAPI 文档
```

## 📁 项目结构

```
backend/
├── src/
│   ├── routes/v2/       # API 路由
│   ├── services/        # 业务逻辑（按域分组）
│   ├── middleware/      # 中间件
│   ├── db/              # 数据库 Schema + 迁移
│   ├── schemas/         # Zod 验证
│   └── utils/           # 工具函数
├── test/                # 测试文件
└── wrangler.toml        # Workers 配置
```

## 📚 详细文档

| 主题 | 文档 |
|------|------|
| 数据库设计 | [docs/backend/database.md](../docs/backend/database.md) |
| 权限系统 | [docs/backend/permissions.md](../docs/backend/permissions.md) |
| API 参考 | [docs/backend/api-reference.md](../docs/backend/api-reference.md) |
| 服务架构 | [docs/backend/services.md](../docs/backend/services.md) |
| 安全架构 | [docs/backend/security.md](../docs/backend/security.md) |
| 部署指南 | [docs/guides/deploy.md](../docs/guides/deploy.md) |
| 测试指南 | [docs/guides/testing.md](../docs/guides/testing.md) |
| 开发规范 | [docs/standards/development.md](../docs/standards/development.md) |

## 🔐 环境配置

```bash
# 设置 JWT 密钥
wrangler secret put AUTH_JWT_SECRET

# 设置邮件服务 Token（可选）
wrangler secret put EMAIL_TOKEN
```

## 📖 API 文档

启动开发服务器后访问: `http://localhost:8787/docs`

---

**最后更新**: 2025-12-30
