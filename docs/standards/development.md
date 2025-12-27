# 开发规范与标准

**文档版本**: 1.1  
**最后更新**: 2025-12-26  
**开发阶段**: 开发中（不考虑向后兼容）

---

## 🎯 核心原则

### 1. 新功能必须完整推广

**原则**: 如果增加了新的优化工具或功能，必须在所有相关位置完整推广使用，不允许部分使用或保留旧实现。

**原因**:
- 开发阶段不需要考虑向后兼容
- 统一使用新工具，避免代码不一致
- 便于后续维护和开发

**示例**:
```typescript
// ❌ 错误：部分使用新工具
async getEmployees() {
  // 旧方式
  return this.db.select().from(employees).all()
}

async getEmployeesByIds(ids: string[]) {
  // 新方式
  return BatchQuery.getByIds(this.db, employees, ids)
}

// ✅ 正确：完整推广新工具
async getEmployees() {
  return DBPerformanceTracker.track(
    'getEmployees',
    () => this.db.select().from(employees).all()
  )
}

async getEmployeesByIds(ids: string[]) {
  return DBPerformanceTracker.track(
    'getEmployeesByIds',
    () => BatchQuery.getByIds(this.db, employees, ids, {
      batchSize: 100,
      parallel: true,
      queryName: 'getEmployeesByIds'
    })
  )
}
```

---

## 📋 开发规范

### 1. 数据库查询规范

#### 必须使用批量查询工具

**规则**: 所有涉及批量操作（获取、更新、插入）的数据库查询，必须使用 `BatchQuery` 工具。

**适用场景**:
- 批量获取数据（`inArray` 查询）
- 批量更新数据
- 批量插入数据

**模板**:
```typescript
import { BatchQuery } from '../utils/batch-query.js'
import { DBPerformanceTracker } from '../utils/db-performance.js'

// 批量获取
const items = await DBPerformanceTracker.track(
  'ServiceName.methodName.getItems',
  () => BatchQuery.getByIds(
    this.db,
    table,
    ids,
    {
      batchSize: 100,
      parallel: true,
      queryName: 'getItems'
    }
  )
)

// 批量更新
await DBPerformanceTracker.track(
  'ServiceName.methodName.updateItems',
  () => BatchQuery.updateBatch(
    this.db,
    table,
    updates,
    {
      batchSize: 50,
      parallel: false,
      queryName: 'updateItems'
    }
  )
)
```

#### 必须添加性能监控

**规则**: 所有数据库查询操作必须使用 `DBPerformanceTracker.track()` 进行性能追踪。

**模板**:
```typescript
import { DBPerformanceTracker } from '../utils/db-performance.js'

const result = await DBPerformanceTracker.track(
  'ServiceName.methodName.queryName',  // 查询名称：Service.方法.查询
  () => this.db.select().from(table).all(),
  c // Context（如果有）
)
```

#### 禁止在 D1 中使用复杂 JOIN 查询 (Dec 2025)

**规则**: Cloudflare D1 对复杂 JOIN 查询支持不稳定，生产环境会随机返回 500 错误。**必须使用顺序查询模式**代替复杂 JOIN。

**禁止**:
- 超过 1 个 JOIN 的查询
- INNER JOIN + LEFT JOIN 组合
- 多表 JOIN 查询

**模板**:
```typescript
// ❌ 禁止：复杂 JOIN 查询（D1 不稳定）
const result = await db
  .select({ ... })
  .from(tableA)
  .innerJoin(tableB, eq(tableB.id, tableA.bId))
  .leftJoin(tableC, eq(tableC.id, tableB.cId))
  .where(...)
  .get()

// ✅ 正确：顺序查询模式
// 1. 查询主表
const itemA = await db.select().from(tableA).where(...).get()
if (!itemA) return null

// 2. 查询关联表
const itemB = itemA.bId 
  ? await db.select().from(tableB).where(eq(tableB.id, itemA.bId)).get()
  : null

// 3. 组装结果
return { ...itemA, b: itemB }
```

**批量查询优化**:
```typescript
// 1. 查询主记录
const items = await db.select().from(tableA).where(...).execute()

// 2. 收集关联 ID
const relatedIds = [...new Set(items.map(i => i.relatedId).filter(Boolean))]

// 3. 批量查询关联数据
const relatedMap = new Map<string, RelatedType>()
if (relatedIds.length > 0) {
  const related = await db
    .select()
    .from(tableB)
    .where(sql`${tableB.id} IN (${sql.join(relatedIds.map(id => sql`${id}`), sql`, `)})`)
    .execute()
  related.forEach(r => relatedMap.set(r.id, r))
}

// 4. 组装结果
return items.map(i => ({
  ...i,
  relatedName: i.relatedId ? relatedMap.get(i.relatedId)?.name : null
}))
```

**已修复的服务**（可作为参考）:
- `db.ts` - `getSessionWithUserAndPosition()`
- `ApprovalService.ts` - `getPendingApprovals()`
- `EmployeeLeaveService.ts` - `listLeaves()`, `getLeavesWithApprover()`
- `ExpenseReimbursementService.ts` - `listReimbursements()`, `getReimbursementsWithApprover()`
- `EmployeeService.ts` - `getById()`

---

### 2. 缓存使用规范

#### 主数据必须使用缓存

**规则**: 所有主数据查询必须使用缓存版本的服务。

**当前实现**:
- ✅ 已在 `middleware/di.ts` 中统一使用 `KVCachedMasterDataService`
- ✅ 所有主数据操作自动缓存

**新增主数据时**:
1. 在 `MasterDataService` 中添加方法
2. 在 `KVCachedMasterDataService` 中添加缓存版本
3. 在更新/删除方法中自动失效缓存

**模板**:
```typescript
// MasterDataService.ts
async getNewMasterData() {
  return this.newService.getNewMasterData()
}

async createNewMasterData(data: any) {
  return this.newService.createNewMasterData(data)
}

// KVCachedMasterDataService.ts
async getNewMasterData() {
  const cacheKey = `kv:master-data:new-master-data`
  const cached = await this.kvCache.get(cacheKey)
  if (cached) return cached
  
  const result = await super.getNewMasterData()
  await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
  return result
}

async createNewMasterData(data: any) {
  const result = await super.createNewMasterData(data)
  await this.invalidateMasterDataCache() // 自动失效缓存
  return result
}
```

---

### 3. 服务层组织规范

#### 必须按业务域分组

**规则**: 所有新服务必须放在对应的业务域目录下。

**目录结构**:
```
services/
├── hr/              # 人事相关
├── finance/         # 财务相关
├── assets/          # 资产管理
├── reports/         # 报表
├── system/         # 系统管理
├── auth/           # 认证
└── common/         # 通用服务
```

**新增服务时**:
1. 确定业务域
2. 在对应目录创建服务文件
3. 在 `middleware/di.ts` 中正确导入和注册

---

### 4. 错误处理规范

#### 必须使用统一错误处理

**规则**: 所有错误必须使用 `Errors` 对象抛出，路由层使用 `errorHandlerV2`。

**模板**:
```typescript
import { Errors } from '../utils/errors.js'

// 业务错误
throw Errors.BUSINESS_ERROR('错误消息')

// 资源不存在
throw Errors.NOT_FOUND('资源名称')

// 验证错误
throw Errors.VALIDATION_ERROR('验证失败', { details })
```

---

### 6. 权限与数据隔离规范 (Dec 2025)

#### 必须使用 DataScope 进行数据隔离

**规则**: 所有涉及数据可见性的业务逻辑，必须使用 `dataScope` 字段判断，**禁止使用硬编码的职位代码**。

**模板**:
```typescript
import { getDataAccessFilterSQL, getUserPosition } from '../utils/permissions.js'

// ✅ 正确：使用 DataScope 判断
const position = getUserPosition(c)
if (position?.dataScope === 'all') {
  // 全局访问
} else if (position?.dataScope === 'project') {
  // 部门级别访问
} else if (position?.dataScope === 'group') {
  // 团队级别访问
} else {
  // 默认: 仅个人数据
}

// ✅ 正确：使用 SQL 过滤器
const accessFilter = getDataAccessFilterSQL(c, 'table_name', {
  ownerColumn: 'created_by',
  deptColumn: 'department_id',
})
const results = await db.select().from(table).where(accessFilter).all()

// ❌ 禁止：硬编码职位代码
if (position?.code === 'team_leader') { ... }  // 永远不要这样做
if (position?.code === 'hq_manager') { ... }   // 永远不要这样做
```

**可用的数据范围**:
| DataScope | 描述 | 过滤字段 |
|-----------|------|----------|
| `all` | 全系统访问 | 无过滤 |
| `project` | 部门级别 | `departmentId` |
| `group` | 团队级别 | `orgDepartmentId` |
| `self` | 仅个人 | `employeeId` |

#### 必须使用版本检测中间件

**规则**: 所有 API 路由必须通过版本检测中间件。

**当前实现**:
- ✅ 已在 `index.ts` 中添加版本检测中间件
- ✅ 自动设置 `apiVersion` 到 context

**新增路由时**:
- 路由会自动获得版本信息
- 通过 `c.get('apiVersion')` 获取版本

---

## ✅ 开发检查清单

### 新增功能时

- [ ] 是否使用了批量查询工具（如适用）？
- [ ] 是否添加了性能监控？
- [ ] 是否使用了缓存（如适用）？
- [ ] 服务是否放在正确的业务域目录？
- [ ] 是否使用了统一的错误处理？
- [ ] 是否更新了依赖注入？
- [ ] **数据权限是否使用 `dataScope` 判断，而非硬编码职位代码？**

### 新增服务时

- [ ] 服务文件是否放在正确的业务域目录？
- [ ] 是否在 `middleware/di.ts` 中注册？
- [ ] 是否使用了性能监控？
- [ ] 是否使用了批量查询（如适用）？

### 新增主数据时

- [ ] 是否在 `MasterDataService` 中添加了方法？
- [ ] 是否在 `KVCachedMasterDataService` 中添加了缓存版本？
- [ ] 更新/删除操作是否自动失效缓存？
- [ ] 是否更新了 `invalidateMasterDataCache()` 方法？

---

## 🚫 禁止事项

### 1. 禁止部分使用新工具

```typescript
// ❌ 禁止：部分方法使用新工具，部分使用旧方式
class Service {
  async method1() {
    // 旧方式
    return this.db.select().from(table).all()
  }
  
  async method2() {
    // 新方式
    return BatchQuery.getByIds(...)
  }
}
```

### 2. 禁止跳过性能监控

```typescript
// ❌ 禁止：直接查询，不添加性能监控
const result = await this.db.select().from(table).all()

// ✅ 必须：添加性能监控
const result = await DBPerformanceTracker.track(
  'Service.method',
  () => this.db.select().from(table).all()
)
```

### 3. 禁止在根目录创建服务

```typescript
// ❌ 禁止：在 services/ 根目录创建服务
services/NewService.ts

// ✅ 必须：放在对应的业务域目录
services/hr/NewService.ts
```

### 4. 禁止硬编码职位代码 (Dec 2025)

```typescript
// ❌ 禁止：使用硬编码的职位代码
if (position.code === 'team_leader') { ... }
if (position.code === 'hq_manager') { ... }
if (position.code === 'project_manager') { ... }

// ✅ 必须：使用 DataScope 判断
if (position.dataScope === 'group') { ... }
if (position.dataScope === 'all') { ... }
if (position.dataScope === 'project') { ... }
```

---

## 📚 参考文档

- [使用指南](./USAGE_GUIDE.md) - 工具使用说明
- [API 版本管理](./API_VERSIONING.md) - API 版本规范

---

## 🔄 更新记录

- 2025-12-26: 添加 D1 顺序查询规范（禁止复杂 JOIN）
- 2025-12-25: 添加权限与数据隔离规范 (DataScope)
- 2025-01-27: 初始版本，建立开发规范

---

**维护者**: 开发团队  
**审核周期**: 随项目发展更新
