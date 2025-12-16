# 开发规范与标准

**文档版本**: 1.0  
**最后更新**: 2025-01-27  
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

### 5. API 版本规范

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

---

## 📚 参考文档

- [使用指南](./USAGE_GUIDE.md) - 工具使用说明
- [服务层组织](./backend/src/services/SERVICE_ORGANIZATION.md) - 服务组织说明
- [API 版本管理](./API_VERSIONING.md) - API 版本规范

---

## 🔄 更新记录

- 2025-01-27: 初始版本，建立开发规范

---

**维护者**: 开发团队  
**审核周期**: 随项目发展更新
