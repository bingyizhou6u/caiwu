# AR Company Finance Management System - Knowledge Base Index
# AR公司财务管理系统 - 知识库索引

> **Note**: This file serves as the unified project knowledge entry point for AI assistants and developers.
> **说明**: 本文件为 AI 助手和开发者提供统一的项目知识入口。

## 📂 Core Documentation / 核心文档

| Document / 文档 | Path / 路径 | Description / 说明 |
|----------------|-------------|-------------------|
| **Global Rules / 全局规则** | [MEMORY[user_global]](memory://user_global) | Architecture, Tech Stack, User Preferences / 核心架构、技术栈、用户偏好 |
| **Docs Index / 文档索引** | [DOCS_INDEX.md](../DOCS_INDEX.md) | Original Index (Legacy) / 原有文档总索引 (含旧版引用) |
| **Deploy Guide / 部署指南** | [DEPLOY.md](../DEPLOY.md) | Deployment Manual / 生产环境部署手册 |
| **Test Guide / 测试指南** | [TESTING.md](../TESTING.md) | Testing Strategy & Commands / 完整测试策略与命令 |

## 🚀 Workflows / 工作流

| Workflow / 工作流 | English Path | Chinese Path / 中文路径 | Description / 描述 |
|------------------|--------------|------------------------|-------------------|
| **Deployment / 部署** | [deploy.en.md](workflows/deploy.en.md) | [deploy.zh.md](workflows/deploy.zh.md) | Migration + Deploy + Verify / 数据库迁移 + 部署 + 验证 |
| **Testing / 测试** | [test.en.md](workflows/test.en.md) | [test.zh.md](workflows/test.zh.md) | Unit, E2E, Coverage / 单元测试、E2E测试、覆盖率 |
| **Development / 开发** | [development.en.md](workflows/development.en.md) | [development.zh.md](workflows/development.zh.md) | Start Local Env / 启动本地开发环境 |

## 🏗️ Architecture & Stack / 架构与技术栈

### Backend / 后端 (Hono + Workers)
- **Entry / 入口**: `backend/src/index.ts`
- **Routes / 路由**: `backend/src/routes/v2/` (Preferred / 推荐 V2)
- **DB Schema**: `backend/src/db/schema.ts` (Drizzle)
- **Config / 配置**: `backend/wrangler.toml`

### Frontend / 前端 (React + Vite)
- **Pages / 页面**: `frontend/src/pages/`
- **Components / 组件**: `frontend/src/components/`
- **API Integration / 集成**: `frontend/src/api/`

## 📚 Key Knowledge / 关键知识点

### 1. Database / 数据库 (D1 + SQLite)
- **Money / 金额**: Integer (cents) / 整数 (分), NO Floats / 禁止浮点数.
- **User / 用户**: `employees` table only / 仅 `employees` 表, NO `users` table / 无 `users` 表.
- **Foreign Keys / 外键**: Not enforced by SQLite / SQLite 不强制, maintain in code / 代码层保证.

### 2. Permissions / 权限体系 (5 Layers)
1. **IP Whitelist**: Cloudflare WAF / Worker
2. **Auth**: JWT + TOTP (2FA)
3. **RBAC**: Role-based / 基于角色 (`hasPermission()`)
4. **DataScope**: **Scope-based Data Isolation / 基于范围的数据隔离** (Dec 2025 Refactored)
   - `ALL`: Full system access / 全系统访问
   - `PROJECT`: Department-level / 部门级别 (`departmentId`)
   - `GROUP`: Team-level / 团队级别 (`orgDepartmentId`)
   - `SELF`: Owner-only / 仅限本人 (`employeeId`)
   - **⚠️ NO hardcoded codes**: Never use `position.code === 'xxx'` / 禁止硬编码职位代码
5. **Approval**: Workflow / 审批流

### 3. Standards / 规范
- **ORM**: Drizzle ORM (Must / 必须).
- **State / 状态**: TanStack Query (React Query).
- **Language / 语言**: Chinese comments & commits / 中文注释与提交信息.
