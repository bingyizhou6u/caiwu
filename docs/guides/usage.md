# 优化工具使用指南

**文档版本**: 1.0  
**最后更新**: 2025-01-27

---

## 📋 目录

1. [KV 缓存使用](#kv-缓存使用)
2. [批量查询优化](#批量查询优化)
3. [数据库性能监控](#数据库性能监控)
4. [最佳实践](#最佳实践)

---

## � cache KV 缓存使用

### 概述

KV 缓存用于持久化缓存主数据等热点数据，减少数据库查询。

### 已启用

✅ **主数据服务已自动启用 KV 缓存**

在 `middleware/di.ts` 中：
```typescript
const masterDataService = new KVCachedMasterDataService(db, c.env.SESSIONS_KV)
```

### 自动缓存失效

✅ **缓存自动失效已实现**

当创建/更新/删除主数据时，缓存会自动失效：
- `createDepartment()` → 自动失效缓存
- `updateDepartment()` → 自动失效缓存
- `deleteDepartment()` → 自动失效缓存
- 其他主数据操作同样支持

### 手动缓存失效

如果需要手动失效缓存：

```typescript
await masterDataService.invalidateMasterDataCache()
```

### 缓存键规则

```typescript
// 主数据缓存键
kv:master-data:currencies
kv:master-data:departments
kv:master-data:sites
kv:master-data:categories
kv:master-data:vendors
kv:master-data:accounts
kv:master-data:headquarters
kv:business:positions
```

---

## 📦 批量查询优化

### 概述

批量查询工具用于优化批量操作，自动分批处理，避免单次查询过大。

### 已应用位置

✅ **以下服务已使用批量查询优化**：

1. **ApprovalService** - 获取待审批员工列表
2. **BorrowingService** - 批量获取员工和账户
3. **SalaryPaymentGenerationService** - 批量获取员工信息

### 使用示例

#### 批量获取数据

```typescript
import { BatchQuery } from '../utils/batch-query.js'

// 批量获取员工
const employees = await BatchQuery.getByIds(
  db,
  employeesTable,
  employeeIds,
  {
    batchSize: 100,        // 每批100条
    parallel: true,        // 并行执行
    queryName: 'getEmployees' // 用于性能追踪
  }
)
```

#### 批量更新数据

```typescript
const updates = [
  { id: '1', name: 'New Name 1' },
  { id: '2', name: 'New Name 2' },
  // ...
]

await BatchQuery.updateBatch(
  db,
  employeesTable,
  updates,
  {
    batchSize: 50,         // 每批50条
    parallel: false,       // 串行执行（更新建议串行）
    queryName: 'updateEmployees'
  }
)
```

#### 批量插入数据

```typescript
const newEmployees = [
  { id: '1', name: 'Employee 1' },
  { id: '2', name: 'Employee 2' },
  // ...
]

await BatchQuery.insertBatch(
  db,
  employeesTable,
  newEmployees,
  {
    batchSize: 100,
    parallel: false,       // 插入建议串行
    queryName: 'insertEmployees'
  }
)
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `batchSize` | number | 100 | 每批处理的数量 |
| `parallel` | boolean | true | 是否并行执行 |
| `queryName` | string | - | 查询名称（用于性能追踪） |

### 最佳实践

1. **查询操作**: 使用 `parallel: true` 提升性能
2. **更新操作**: 使用 `parallel: false` 避免并发冲突
3. **插入操作**: 使用 `parallel: false` 保证数据一致性
4. **批量大小**: 根据数据量调整，建议 50-200 之间

---

## 📊 数据库性能监控

### 概述

数据库性能监控自动追踪查询执行时间，发现慢查询。

### 已应用位置

✅ **以下服务已添加性能监控**：

1. **ApprovalService** - 员工查询性能追踪
2. **BorrowingService** - 批量查询性能追踪
3. **SalaryPaymentGenerationService** - 员工查询性能追踪

### 使用示例

#### 单个查询追踪

```typescript
import { DBPerformanceTracker } from '../utils/db-performance.js'

const result = await DBPerformanceTracker.track(
  'getEmployees',                    // 查询名称
  () => db.select().from(employees).all(), // 查询函数
  c                                  // Context（可选）
)
```

#### 批量查询追踪

```typescript
const results = await DBPerformanceTracker.trackBatch(
  'batchGetEmployees',
  [
    () => db.select().from(employees).where(eq(employees.id, '1')).all(),
    () => db.select().from(employees).where(eq(employees.id, '2')).all(),
    // ...
  ],
  c // Context（可选）
)
```

### 监控指标

监控系统自动记录以下指标：

- `db.query.duration` - 查询执行时间（毫秒）
- `db.query.slow` - 慢查询（>1秒）
- `db.query.batch.duration` - 批量查询时间

### 慢查询告警

当查询执行时间超过 1 秒时，会自动：
1. 记录慢查询指标
2. 输出警告日志
3. 记录查询上下文信息

### 查看监控数据

通过健康检查端点查看：

```bash
GET /api/health
```

响应包含性能指标：
```json
{
  "metrics": {
    "performance": {
      "dbQueryDuration": {
        "avg": 45,
        "p95": 120,
        "p99": 250
      }
    }
  }
}
```

---

## 🎯 最佳实践

### 1. 缓存使用

✅ **推荐**:
- 主数据查询使用 KV 缓存
- 缓存时间：1小时（主数据变化少）
- 更新时自动失效缓存

❌ **避免**:
- 缓存频繁变化的数据
- 缓存过大的数据（注意 KV 限制）
- 手动管理缓存键（使用工具类）

### 2. 批量查询

✅ **推荐**:
- 批量操作使用 `BatchQuery` 工具
- 根据数据量调整 `batchSize`
- 查询操作使用并行，更新操作使用串行

❌ **避免**:
- 单次查询超过 1000 条
- 在事务中并行更新
- 忽略错误处理

### 3. 性能监控

✅ **推荐**:
- 在关键查询处添加性能追踪
- 使用有意义的查询名称
- 定期检查慢查询日志

❌ **避免**:
- 追踪所有查询（只追踪关键查询）
- 忽略慢查询告警
- 在生产环境输出过多日志

### 4. 代码示例

#### 完整的服务方法示例

```typescript
import { BatchQuery } from '../utils/batch-query.js'
import { DBPerformanceTracker } from '../utils/db-performance.js'

export class MyService {
  async getEmployeesByIds(employeeIds: string[], c?: Context) {
    // 使用批量查询和性能监控
    return DBPerformanceTracker.track(
      'MyService.getEmployeesByIds',
      () =>
        BatchQuery.getByIds(
          this.db,
          employeesTable,
          employeeIds,
          {
            batchSize: 100,
            parallel: true,
            queryName: 'getEmployeesByIds',
          }
        ),
      c
    )
  }
}
```

---

## 🔍 故障排查

### 缓存问题

**问题**: 缓存数据过期或不一致

**解决**:
1. 检查缓存 TTL 设置
2. 确认更新操作调用了 `invalidateMasterDataCache()`
3. 查看 KV 存储使用情况

### 批量查询问题

**问题**: 批量查询超时或失败

**解决**:
1. 减小 `batchSize`
2. 检查数据库连接数限制
3. 使用串行执行（`parallel: false`）

### 性能监控问题

**问题**: 监控数据不准确

**解决**:
1. 确认查询名称唯一
2. 检查 Context 传递是否正确
3. 查看监控服务初始化

---

## 📚 相关文档

- [架构优化总结](./OPTIMIZATION_COMPLETE.md)
- [API 版本管理](./API_VERSIONING.md)
- [服务层组织](./backend/src/services/SERVICE_ORGANIZATION.md)

---

**维护者**: 开发团队  
**更新频率**: 随代码更新
