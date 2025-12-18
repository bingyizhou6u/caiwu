# 部署到 Cloudflare - 总部改造更新

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

### 2. 部署后端代码

```bash
cd backend

# 部署到 Cloudflare Workers
npm run deploy
```

### 3. 验证部署

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
