# 代码规范快速参考

**用途**: 快速查找修复方法和规范要求

---

## 🚀 快速开始

### 1. 修复单个查询

```typescript
import { query } from '../utils/query-helpers.js'

// 修复前
const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()

// 修复后
const employee = await query(
  this.db,
  'EmployeeService.getById',
  () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
  c // Context（可选）
)
```

### 2. 修复批量查询

```typescript
import { getByIds } from '../utils/query-helpers.js'

// 修复前
const assets = await this.db
  .select()
  .from(fixedAssets)
  .where(inArray(fixedAssets.id, assetIds))
  .all()

// 修复后
const assets = await getByIds(
  this.db,
  fixedAssets,
  assetIds,
  'FixedAssetService.getAssets',
  { batchSize: 100, parallel: true },
  c
)
```

---

## 📋 查询名称规范

### 格式

```
ServiceName.methodName.queryName
```

### 示例

- `EmployeeService.getById` - 简单查询
- `EmployeeService.create.checkEmail` - 创建方法中的检查
- `FixedAssetService.get.getAsset` - get 方法中的主查询
- `FixedAssetService.get.getDepartment` - get 方法中的关联查询

---

## ✅ 修复检查清单

### 修复前
- [ ] 备份文件
- [ ] 理解代码逻辑
- [ ] 确认 Context 可用性

### 修复中
- [ ] 添加导入：`import { query } from '../utils/query-helpers.js'`
- [ ] 使用 `query()` 或 `getByIds()`
- [ ] 查询名称符合规范
- [ ] 保持原有逻辑

### 修复后
- [ ] 类型检查通过：`npm run typecheck`
- [ ] 运行测试
- [ ] 检查性能监控

---

## 🛠️ 常用工具

### QueryHelpers（推荐）

```typescript
import { query, getByIds, updateBatch, insertBatch } from '../utils/query-helpers.js'

// 单个查询
query(db, 'Service.method', () => queryFn(), c)

// 批量获取
getByIds(db, table, ids, 'Service.method', options, c)

// 批量更新
updateBatch(db, table, updates, 'Service.method', options, c)

// 批量插入
insertBatch(db, table, data, 'Service.method', options, c)
```

### DBPerformanceTracker + BatchQuery

```typescript
import { DBPerformanceTracker } from '../utils/db-performance.js'
import { BatchQuery } from '../utils/batch-query.js'

DBPerformanceTracker.track('Service.method', () => queryFn(), c)
BatchQuery.getByIds(db, table, ids, options)
```

---

## 📊 批量查询参数

### 推荐配置

| 操作类型 | batchSize | parallel | 说明 |
|---------|-----------|----------|------|
| 查询 | 100 | true | 并行查询提升性能 |
| 更新 | 50 | false | 串行避免并发冲突 |
| 插入 | 100 | false | 串行保证数据一致性 |

---

## 🔍 检查命令

```bash
# 检查代码规范
cd backend && npm run check:standards

# 类型检查
cd backend && npm run typecheck

# 运行测试
cd backend && npm test
```

---

## 📚 详细文档

- [修复模板](./FIX_TEMPLATES.md) - 详细修复示例
- [模块修复清单](./MODULE_FIX_CHECKLIST.md) - 具体修复位置
- [优化计划](./OPTIMIZATION_PLAN.md) - 完整优化计划
- [开发规范](./DEVELOPMENT_STANDARDS.md) - 开发规范

---

**最后更新**: 2025-01-27
