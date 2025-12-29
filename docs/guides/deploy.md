# 部署到 Cloudflare

## 部署架构概览

| 服务 | 类型 | 项目名称 | Git 自动部署 |
|------|------|----------|-------------|
| **前端** | Cloudflare Pages | `manager` | ✅ main 分支 |
| **后端 API** | Cloudflare Workers | `caiwu-backend` | ✅ main 分支 |
| **邮件服务** | Cloudflare Workers | `caiwu-email` | ✅ main 分支 |

### 服务调用方式

| 服务 | 调用方式 | 说明 |
|------|----------|------|
| **前端** | 外部访问 | https://manager.pages.dev (或自定义域名) |
| **后端 API** | Service Binding | 前端通过 Pages Workers 内部调用 |
| **邮件服务** | Service Binding | 后端内部调用（绑定名: `EMAIL_SERVICE`） |

### CI/CD 流程

推送到 `main` 分支后，Cloudflare 自动：
1. 拉取代码
2. 安装依赖
3. 构建部署

**前端构建配置** (Pages: manager):
- 根目录: `frontend`
- 构建命令: `npm install && npm run build`
- 输出目录: `dist`

**后端部署配置** (Workers: caiwu-backend):
- 根目录: `/backend`
- 部署命令: `npx wrangler deploy src/index.ts`

**邮件服务配置** (Workers: caiwu-email):
- 根目录: `/email-worker`
- 配置文件: `wrangler.jsonc`

---

## 数据库迁移管理

### 迁移流程概述

项目使用 **Drizzle Kit** 生成迁移文件，并通过自定义脚本管理迁移执行。

**迁移文件位置**:
- Drizzle 生成的迁移：`backend/drizzle/XXXXX_description.sql`
- 手动迁移（如需要）：`backend/src/db/migration_YYYYMMDD_description.sql`

### 标准迁移流程

#### 1. 生成迁移文件

修改 `backend/src/db/schema.ts` 后，运行：

```bash
cd backend
npm run db:generate
```

这会：
- 分析 schema.ts 的变更
- 在 `backend/drizzle/` 目录生成迁移文件
- 更新 `backend/drizzle/meta/_journal.json`

#### 2. 检查迁移文件

生成后，检查迁移文件内容：

```bash
# 查看最新生成的迁移文件
ls -lt backend/drizzle/*.sql | head -1
cat backend/drizzle/最新文件.sql
```

#### 3. 应用迁移

**本地环境**:
```bash
npm run migrate:up
```

**远程环境（生产）**:
```bash
npm run migrate:up:remote
```

#### 4. 验证迁移状态

```bash
# 查看迁移状态
npm run migrate:status        # 本地
npm run migrate:status:remote # 远程

# 检查迁移一致性
npm run migrate:check        # 本地
npm run migrate:check:remote # 远程
```

### 迁移追踪机制

项目使用 `schema_migrations` 表追踪已执行的迁移：

- **表结构**: `version` (迁移文件名), `checksum` (文件校验和), `executed_at` (执行时间)
- **自动检查**: 迁移脚本会自动检查迁移是否已执行，避免重复执行
- **校验和验证**: 通过文件校验和确保迁移文件未被修改

### 特殊情况处理

#### 手动迁移文件

如果需要在 Drizzle 生成的迁移之外添加手动 SQL，请遵循以下规范：

1. **文件命名**: `migration_YYYYMMDD_description.sql`
2. **文件位置**: `backend/src/db/`
3. **执行方式**: 使用 `migrate:up` 脚本自动执行

#### 迁移回滚

当前版本**不支持自动回滚**。如需回滚：

1. 手动编写回滚 SQL
2. 创建新的迁移文件执行回滚
3. 记录回滚操作到 `schema_migrations` 表

---

## 部署步骤

### 1. 执行数据库迁移（重要！）

首先需要将生产数据库中 `project_id IS NULL` 的 org_departments 更新为总部的 department ID：

```bash
cd backend

# 执行迁移脚本（会自动检查并迁移）
npm run migrate:hq-org:remote
```

或者手动执行 SQL：

```bash
# 检查需要迁移的记录数
npx wrangler d1 execute caiwu-db --remote --command "SELECT COUNT(*) as count FROM org_departments WHERE project_id IS NULL"

# 执行迁移（确保总部部门存在）
npx wrangler d1 execute caiwu-db --remote --file src/db/migration_update_hq_org_departments.sql

# 验证迁移结果
npx wrangler d1 execute caiwu-db --remote --command "SELECT COUNT(*) as count FROM org_departments WHERE project_id IS NULL"
```

### 2. 设置必需的环境变量

在部署前，确保已设置所有必需的环境变量：

```bash
cd backend

# JWT 密钥（如果尚未设置）
wrangler secret put AUTH_JWT_SECRET



# 邮件服务 Token（如果使用）
wrangler secret put EMAIL_TOKEN
```



### 3. 部署后端代码

```bash
cd backend

# 部署到 Cloudflare Workers
npm run deploy
```

### 4. 验证部署

部署完成后，测试以下功能：

1. **新建员工时选择总部**：
   - 应该能看到总部的组织部门列表
   - 如果列表为空，系统会自动创建默认组织部门

2. **检查日志**：
   - 查看 Cloudflare Dashboard 中的 Workers 日志
   - 确认没有错误

## 主要变更

### 代码变更
- ✅ `OrgDepartmentService`: 移除对 `projectId IS NULL` 的特殊处理，统一使用 department ID
- ✅ `DepartmentService`: 创建总部组织部门时使用总部 department ID
- ✅ `PositionService`: 通过 department 名称判断是否为总部
- ✅ `ProjectDepartmentService`: 新增获取/创建总部 department ID 的方法
- ✅ `OrgDepartmentService`: 自动创建总部的默认组织部门（如果不存在）

### 数据库变更
- 将所有 `project_id IS NULL` 的 `org_departments` 更新为总部的 `department_id`
- 总部现在完全作为普通 department 处理

## 回滚方案

如果出现问题，可以回滚：

```bash
# 回滚代码（使用 git）
git revert <commit-hash>

# 重新部署
npm run deploy
```

## 注意事项

1. **迁移前备份**：建议先备份生产数据库
2. **测试环境**：建议先在测试环境验证
3. **监控**：部署后密切关注错误日志
4. **数据一致性**：确保总部部门存在且名称正确（"总部"）
