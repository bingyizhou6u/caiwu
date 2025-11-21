# 财务管理系统 (Caiwu App)

一个基于 Cloudflare Workers 的现代化企业财务管理系统，支持多租户、权限控制和完整的财务流程管理。

## ✨ 核心功能

### 📊 财务管理
- **资金流水管理**：完整的收支记录和分类
- **账户管理**：多账户支持，实时余额追踪
- **应收应付**：供应商/客户账款管理
- **借贷管理**：借款记录和还款追踪
- **费用报销**：员工费用申请和审批

### 🏢 资产管理
- **固定资产**：资产采购、分配、出售全流程
- **租赁管理**：房屋租赁和员工宿舍分配

### 👥 人力资源
- **员工管理**：员工信息、部门、职位管理
- **工资管理**：工资发放记录和津贴管理
- **请假管理**：请假申请和审批流程

### 📈 报表分析
- **现金流报表**：实时现金流分析
- **费用报表**：部门费用统计和分析
- **工资报表**：员工工资明细和汇总
- **应收应付报表**：账款统计和账龄分析
- **借贷报表**：借款余额和还款记录

### 🔒 安全与权限
- **用户认证**：密码登录 + 双因素认证 (TOTP)
- **权限控制**：基于职位的权限管理 (RBAC)
- **数据权限**：部门级、项目级数据隔离
- **审计日志**：完整的操作记录和追踪
- **IP 白名单**：访问控制和安全防护

## 🛠️ 技术栈

### 后端
- **运行环境**：Cloudflare Workers（边缘计算）
- **Web 框架**：Hono（高性能、轻量级）
- **数据库**：Cloudflare D1（SQLite）
- **数据验证**：Zod
- **身份认证**：JWT + TOTP
- **测试框架**：Vitest

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件库**：Ant Design 5
- **状态管理**：React Context + Hooks
- **路由**：React Router v6
- **HTTP 客户端**：Fetch API

### 部署
- **后端部署**：Cloudflare Workers
- **前端部署**：Cloudflare Pages
- **数据库**：Cloudflare D1
- **CI/CD**：GitHub Actions（自动部署）

## 📦 项目结构

```
caiwu-app/
├── backend/                 # 后端 API
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   │   ├── auth.ts      # 认证相关
│   │   │   ├── employees.ts # 员工管理
│   │   │   ├── flows.ts     # 资金流水
│   │   │   ├── master-data/ # 基础数据
│   │   │   ├── reports/     # 报表模块
│   │   │   └── ...
│   │   ├── schemas/         # 数据验证模式
│   │   ├── services/        # 业务逻辑服务
│   │   ├── utils/           # 工具函数
│   │   ├── middleware.ts    # 中间件
│   │   ├── types.ts         # 类型定义
│   │   └── index.ts         # 入口文件
│   ├── wrangler.toml        # Cloudflare 配置
│   └── package.json
│
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── layouts/         # 布局组件
│   │   ├── router/          # 路由配置
│   │   ├── context/         # 状态管理
│   │   ├── api/             # API 调用
│   │   ├── config/          # 配置文件
│   │   ├── utils/           # 工具函数
│   │   └── main.tsx         # 入口文件
│   ├── functions/           # Cloudflare Pages Functions
│   ├── vite.config.ts
│   └── package.json
│
└── README.md
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 pnpm
- Cloudflare 账户
- Wrangler CLI

### 1. 克隆项目

```bash
git clone https://github.com/bingyizhou6u/caiwu.git
cd caiwu
```

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 3. 配置环境

#### 后端配置

编辑 `backend/wrangler.toml`：

```toml
name = "caiwu-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "caiwu-db"
database_id = "your-database-id"  # 替换为您的 D1 数据库 ID
```

#### 前端配置

创建 `frontend/.dev.vars`（开发环境）：

```bash
VITE_API_BASE=http://localhost:8787
```

### 4. 初始化数据库

```bash
cd backend

# 创建 D1 数据库
wrangler d1 create caiwu-db

# 执行数据库迁移
wrangler d1 execute caiwu-db --local --file=./src/db/schema.sql

# 或者在生产环境
wrangler d1 execute caiwu-db --remote --file=./src/db/schema.sql
```

### 5. 启动开发服务器

#### 启动后端

```bash
cd backend
npm run dev
# 后端运行在 http://localhost:8787
```

#### 启动前端

```bash
cd frontend
npm run dev
# 前端运行在 http://localhost:5173
```

### 6. 访问应用

打开浏览器访问 `http://localhost:5173`

**默认管理员账号**：
- 邮箱：`bingyizhou6u@gmail.com`
- 密码：首次登录时会自动创建账号，需要设置密码

## 📤 部署到 Cloudflare

### 部署后端

```bash
cd backend

# 登录 Cloudflare
wrangler login

# 部署到生产环境
npm run deploy
```

### 部署前端

#### 方式 1：通过 Cloudflare Dashboard（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** > **Create a project**
3. 连接 GitHub 仓库 `bingyizhou6u/caiwu`
4. 配置构建设置：
   - **Framework preset**: Vite
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/`（默认）
5. 添加环境变量：
   - `VITE_API_BASE`: `https://your-backend.workers.dev`
6. 点击 **Save and Deploy**

#### 方式 2：通过命令行

```bash
cd frontend

# 构建生产版本
npm run build

# 使用 Wrangler 部署
wrangler pages deploy dist --project-name=caiwu-frontend
```

### 配置自动部署

在 GitHub 仓库中配置 GitHub Actions，每次推送代码自动部署：

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Deploy Backend
        working-directory: ./backend
        run: |
          npm install
          npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Build and Deploy Frontend
        working-directory: ./frontend
        run: |
          npm install
          npm run build
          npx wrangler pages deploy dist --project-name=caiwu-frontend
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

在 GitHub 仓库设置中添加 Secret：
- `CLOUDFLARE_API_TOKEN`: 从 Cloudflare Dashboard 获取 API Token

## 🔧 开发指南

### 添加新的 API 路由

1. 在 `backend/src/routes/` 创建新的路由文件
2. 在 `backend/src/index.ts` 中注册路由

```typescript
import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'

export const myRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

myRoutes.get('/my-endpoint', async (c) => {
  // 业务逻辑
  return c.json({ message: 'Hello' })
})
```

### 添加新的前端页面

1. 在 `frontend/src/pages/` 创建页面组件
2. 在 `frontend/src/router/AppRouter.tsx` 中添加路由
3. 在 `frontend/src/config/menu.ts` 中添加菜单项

### 数据库迁移

```bash
cd backend

# 本地测试迁移
wrangler d1 execute caiwu-db --local --file=./src/db/migration.sql

# 应用到生产环境
wrangler d1 execute caiwu-db --remote --file=./src/db/migration.sql
```

## 🧪 测试

```bash
# 运行后端测试
cd backend
npm test

# 运行测试覆盖率
npm run test:coverage
```

## 📝 API 文档

主要 API 端点：

### 认证
- `POST /api/auth/login-password` - 密码登录
- `POST /api/auth/verify-totp` - 验证双因素认证
- `POST /api/auth/logout` - 退出登录

### 员工管理
- `GET /api/employees` - 获取员工列表
- `POST /api/employees` - 创建员工
- `PUT /api/employees/:id` - 更新员工
- `DELETE /api/employees/:id` - 删除员工

### 资金流水
- `GET /api/flows` - 获取流水列表
- `POST /api/flows` - 创建流水
- `PUT /api/flows/:id` - 更新流水
- `DELETE /api/flows/:id` - 删除流水

### 报表
- `GET /api/reports/cash-flow` - 现金流报表
- `GET /api/reports/employee-salary` - 工资报表
- `GET /api/reports/expense-summary` - 费用汇总
- `GET /api/reports/ar-summary` - 应收账款汇总
- `GET /api/reports/ap-summary` - 应付账款汇总

完整 API 文档请参考后端代码注释。

## 🔐 权限说明

系统采用基于职位的权限控制（RBAC），支持以下权限范围：

- **全部权限**：可查看和操作所有数据
- **本部门权限**：只能查看和操作本部门数据
- **本项目权限**：只能查看和操作分配的项目数据
- **仅查看**：只能查看相关数据，不能修改

权限配置路径：**系统管理 > 职位权限管理**

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 👨‍💻 作者

- GitHub: [@bingyizhou6u](https://github.com/bingyizhou6u)

## 🙏 致谢

- [Hono](https://hono.dev/) - 高性能 Web 框架
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Ant Design](https://ant.design/) - 企业级 UI 组件库
- [React](https://react.dev/) - 前端框架

## 📞 支持

如有问题或建议，请：
- 提交 [Issue](https://github.com/bingyizhou6u/caiwu/issues)
- 发送邮件到：bingyizhou6u@gmail.com

---

⭐ 如果这个项目对您有帮助，请给它一个 Star！

