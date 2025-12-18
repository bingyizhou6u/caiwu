# AR公司财务管理系统 - 后端服务

> 基于 Cloudflare Workers + Hono + Drizzle ORM 构建的企业财务管理系统后端

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- npm 或 yarn
- Cloudflare 账户（用于部署）
- Wrangler CLI（用于本地开发和部署）

### 安装依赖

```bash
npm install
```

### 环境配置

1. **登录 Cloudflare**

```bash
npx wrangler login
```

2. **配置环境变量**

创建 `wrangler.toml` 文件（如果不存在），配置必要的环境变量：

```toml
[vars]
CF_ACCOUNT_ID = "your-account-id"
CF_ZONE_ID = "your-zone-id"
CF_IP_LIST_ID = "your-ip-list-id"
```

3. **设置 Secret**

```bash
# JWT 密钥
wrangler secret put AUTH_JWT_SECRET

# 初始化管理员密码哈希（必需）
# 首先生成密码哈希
npm run gen:password-hash "your-secure-password"
# 然后设置 Secret（生产环境）
wrangler secret put INIT_ADMIN_PASSWORD_HASH
# 或者在 wrangler.toml 的 [env.dev.vars] 中设置（开发环境）

# 邮件服务 Token（如果使用）
wrangler secret put EMAIL_TOKEN
```

**重要**: `INIT_ADMIN_PASSWORD_HASH` 是必需的，用于系统初始化时创建第一个管理员账户。如果未设置，系统初始化将失败。

### 本地开发

```bash
# 启动开发服务器（端口 8787）
npm run dev

# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 数据库迁移

```bash
# 检查迁移状态
npm run migrate:check

# 应用所有迁移
npm run migrate:up

# 查看迁移历史
npm run migrate:status

# 记录已存在的迁移文件
npm run migrate:existing
```

### 数据库管理

```bash
# 打开 Drizzle Studio（数据库可视化工具）
npm run db:studio

# 生成迁移文件（基于 schema 变更）
npm run db:generate

# 推送 schema 变更到数据库
npm run db:push
```

## 📁 项目结构

```
backend/
├── src/
│   ├── routes/          # API 路由
│   │   └── v2/          # V2 API 路由
│   ├── services/        # 业务逻辑层
│   ├── db/              # 数据库相关
│   │   ├── schema.ts    # 数据库表定义
│   │   └── migration_*.sql  # 迁移文件
│   ├── middleware/      # 中间件
│   ├── utils/           # 工具函数
│   ├── schemas/         # Zod Schema 定义
│   └── index.ts         # 应用入口
├── test/                # 测试文件
├── scripts/             # 工具脚本
└── wrangler.toml        # Cloudflare Workers 配置
```

## 🔧 开发工具

### 代码质量

项目使用 ESLint 和 Prettier 确保代码质量：

- **ESLint**: 代码检查和错误检测
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查

### Git Hooks

项目配置了 Git Hooks，在提交代码前自动：

1. 运行 ESLint 检查和修复
2. 运行 Prettier 格式化
3. 运行 TypeScript 类型检查

### 常用命令

```bash
# 开发相关
npm run dev              # 启动开发服务器
npm run typecheck        # 类型检查
npm run lint             # 代码检查
npm run lint:fix         # 自动修复代码问题
npm run format           # 格式化代码
npm run format:check     # 检查代码格式

# 测试相关
npm test                 # 运行测试
npm run test:coverage    # 测试覆盖率
npm run test:coverage:ui # 测试覆盖率 UI

# 数据库相关
npm run migrate:check    # 检查迁移状态
npm run migrate:up       # 应用迁移
npm run db:studio        # 打开数据库可视化工具

# 部署相关
npm run deploy           # 部署到 Cloudflare Workers
npm run gen:openapi      # 生成 OpenAPI 文档
```

## 📚 API 文档

### Swagger UI

启动开发服务器后，访问：

```
http://localhost:8787/docs
```

### OpenAPI 规范

生成 OpenAPI 规范文件：

```bash
npm run gen:openapi
```

生成的文件位于 `openapi.json`

## 🔐 认证与权限

### 认证流程

1. 用户登录获取 JWT Token
2. Token 包含用户信息和权限
3. 每个请求需要在 Header 中携带 Token

### 权限系统

系统采用基于角色的权限控制（RBAC）：

- **职位层级**: 1-5 级，数字越小权限越高
- **功能权限**: `module.subModule.action` 格式
- **数据范围**: 总部、项目、团队、个人

## 🗄️ 数据库

### 数据库类型

使用 Cloudflare D1（基于 SQLite）

### Schema 定义

所有表定义在 `src/db/schema.ts` 中，使用 Drizzle ORM 定义。

### 迁移管理

迁移文件命名规范：`migration_YYYYMMDD_HHMMSS_description.sql`

迁移追踪表：`schema_migrations`

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test test/routes/auth.test.ts

# 监听模式
npm test -- --watch
```

### 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率 UI
npm run test:coverage:ui
```

## 🚢 部署

### 部署到 Cloudflare Workers

```bash
# 部署到生产环境
npm run deploy

# 部署到预览环境
wrangler deploy --env preview
```

### 环境变量

生产环境的环境变量通过 `wrangler secret` 设置：

```bash
# JWT 密钥（必需）
wrangler secret put AUTH_JWT_SECRET

# 初始化管理员密码哈希（必需）
# 首先生成密码哈希
npm run gen:password-hash "your-secure-password"
# 然后设置 Secret
wrangler secret put INIT_ADMIN_PASSWORD_HASH

# 邮件服务 Token（可选）
wrangler secret put EMAIL_TOKEN
```

**必需的环境变量**:
- `AUTH_JWT_SECRET`: JWT 签名密钥
- `INIT_ADMIN_PASSWORD_HASH`: 初始化管理员密码哈希（用于数据库初始化）

**开发环境配置**:
开发环境的环境变量在 `wrangler.toml` 的 `[env.dev.vars]` 中配置。请确保设置了 `INIT_ADMIN_PASSWORD_HASH`。

## 📖 更多文档

- [API 参考文档](../.qoder/repowiki/zh/content/API参考/API参考.md)
- [数据库设计文档](../.qoder/repowiki/zh/content/数据库设计/)
- [架构文档](../.qoder/repowiki/zh/content/技术栈与架构/)

## 🐛 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 `wrangler.toml` 中的数据库配置
   - 确认已运行 `wrangler login`

2. **迁移失败**
   - 检查迁移文件语法
   - 查看 `schema_migrations` 表确认已执行的迁移

3. **类型错误**
   - 运行 `npm run typecheck` 查看详细错误
   - 确保所有依赖已正确安装

## 📝 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 函数和类使用中文注释

### 提交规范

- 提交前会自动运行 lint 和 typecheck
- 提交信息使用中文，清晰描述改动内容

### 测试规范

- 新功能需要添加测试
- 测试覆盖率目标：70%+
- 使用 Vitest 作为测试框架

## 📄 许可证

私有项目，未经授权不得使用。

