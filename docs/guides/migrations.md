# 数据库迁移指南

**最后更新**: 2025-01-27

---

## 概述

本项目使用 **Drizzle Kit** 管理数据库迁移，通过自定义脚本追踪和执行迁移。

---

## 迁移工作流

### 1. 修改 Schema

编辑 `backend/src/db/schema.ts`，添加或修改表结构。

### 2. 生成迁移文件

```bash
cd backend
npm run db:generate
```

**输出**:
- 迁移文件：`backend/drizzle/XXXXX_description.sql`
- 元数据：`backend/drizzle/meta/_journal.json`

### 3. 检查迁移文件

```bash
# 查看最新迁移文件
ls -lt backend/drizzle/*.sql | head -1
cat backend/drizzle/最新文件.sql
```

**检查要点**:
- SQL 语法正确
- 表结构变更符合预期
- 数据迁移逻辑正确（如需要）

### 4. 应用迁移

**本地开发环境**:
```bash
npm run migrate:up
```

**生产环境**:
```bash
npm run migrate:up:remote
```

**脚本功能**:
- 自动检查迁移是否已执行
- 使用事务确保原子性
- 记录执行日志

### 5. 验证迁移

```bash
# 查看迁移状态
npm run migrate:status        # 本地
npm run migrate:status:remote # 远程

# 检查迁移一致性
npm run migrate:check        # 本地
npm run migrate:check:remote # 远程
```

---

## 迁移文件类型

### Drizzle 自动生成

**位置**: `backend/drizzle/XXXXX_description.sql`

**特点**:
- 文件名包含时间戳和描述
- 由 Drizzle Kit 自动生成
- 包含完整的表结构变更

**示例**:
```sql
-- drizzle/0001_add_user_table.sql
CREATE TABLE `users` (
  `id` TEXT PRIMARY KEY,
  `email` TEXT NOT NULL UNIQUE,
  ...
);
```

### 手动迁移文件

**位置**: `backend/src/db/migration_YYYYMMDD_description.sql`

**使用场景**:
- 数据迁移（非结构变更）
- 特殊业务逻辑迁移
- 一次性修复脚本

**命名规范**:
- 格式：`migration_YYYYMMDD_description.sql`
- 示例：`migration_20250127_fix_hq_org_departments.sql`

---

## 迁移追踪

### schema_migrations 表

系统使用 `schema_migrations` 表追踪已执行的迁移：

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  executed_at INTEGER NOT NULL
);
```

**字段说明**:
- `version`: 迁移文件名
- `checksum`: 文件 SHA-256 校验和
- `executed_at`: 执行时间戳（Unix 时间）

### 迁移检查机制

迁移脚本会自动：
1. 检查迁移文件是否已执行（通过 `version`）
2. 验证文件完整性（通过 `checksum`）
3. 跳过已执行的迁移
4. 记录新执行的迁移

---

## 常用命令

| 命令 | 说明 | 环境 |
|------|------|------|
| `npm run db:generate` | 生成迁移文件 | - |
| `npm run migrate:up` | 执行未执行的迁移 | 本地 |
| `npm run migrate:up:remote` | 执行未执行的迁移 | 远程 |
| `npm run migrate:status` | 查看迁移状态 | 本地 |
| `npm run migrate:status:remote` | 查看迁移状态 | 远程 |
| `npm run migrate:check` | 检查迁移一致性 | 本地 |
| `npm run migrate:check:remote` | 检查迁移一致性 | 远程 |

---

## 最佳实践

### 1. 迁移前备份

**生产环境迁移前**:
```bash
# 导出数据库（可选）
wrangler d1 export caiwu-db --remote --output backup.sql
```

### 2. 小步迁移

- 每次迁移只做一件事
- 避免在一个迁移中包含多个不相关的变更
- 便于回滚和调试

### 3. 测试迁移

**本地测试**:
```bash
# 1. 在本地执行迁移
npm run migrate:up

# 2. 验证数据
npm run test

# 3. 检查迁移状态
npm run migrate:status
```

### 4. 生产环境迁移

**推荐流程**:
1. 在本地测试迁移
2. 检查迁移文件内容
3. 备份生产数据库（可选）
4. 执行迁移：`npm run migrate:up:remote`
5. 验证迁移状态：`npm run migrate:status:remote`
6. 测试应用功能

### 5. 迁移回滚

**当前不支持自动回滚**。如需回滚：

1. 编写回滚 SQL
2. 创建新的迁移文件执行回滚
3. 手动更新 `schema_migrations` 表（如需要）

**示例**:
```sql
-- migration_20250127_rollback_add_user_table.sql
DROP TABLE IF EXISTS users;
```

---

## 故障排查

### 迁移执行失败

**检查**:
1. 查看错误日志
2. 检查 SQL 语法
3. 验证表结构是否冲突

**解决**:
- 修复迁移文件
- 手动执行 SQL（如需要）
- 更新 `schema_migrations` 表

### 迁移状态不一致

**症状**: `migrate:check` 显示不一致

**原因**:
- 手动执行了迁移
- 迁移文件被修改
- 数据库状态异常

**解决**:
1. 检查 `schema_migrations` 表
2. 验证迁移文件校验和
3. 手动同步状态（如需要）

### 迁移文件冲突

**症状**: 多个开发者同时生成迁移

**解决**:
1. 合并 schema 变更
2. 重新生成迁移文件
3. 协调迁移执行顺序

---

## 注意事项

1. **不要手动修改 Drizzle 生成的迁移文件**
   - 如需修改，重新生成迁移

2. **不要跳过迁移追踪**
   - 所有迁移必须通过脚本执行
   - 确保迁移状态一致

3. **生产环境谨慎操作**
   - 迁移前备份数据
   - 在低峰期执行
   - 监控执行过程

4. **迁移文件版本控制**
   - 提交迁移文件到 Git
   - 不要删除已执行的迁移文件
   - 保持迁移历史完整

---

## 参考文档

- [Drizzle Kit 文档](https://orm.drizzle.team/kit-docs/overview)
- [开发规范 - 迁移管理](../standards/development.md#3-迁移管理规范)
- [部署指南](./deploy.md)

