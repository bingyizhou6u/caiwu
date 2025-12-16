# 代码修复模板

**用途**: 标准化修复流程，确保修复一致性和质量

---

## 📋 修复模板

### 模板1：单个查询添加性能监控

#### 修复前
```typescript
async getById(id: string) {
  const employee = await this.db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .get()
  
  if (!employee) {
    throw Errors.NOT_FOUND('员工')
  }
  
  return employee
}
```

#### 修复后（方式1：使用 QueryHelpers - 推荐）
```typescript
import { query } from '../utils/query-helpers.js'

async getById(id: string, c?: Context) {
  const employee = await query(
    this.db,
    'EmployeeService.getById',
    () => this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .get(),
    c
  )
  
  if (!employee) {
    throw Errors.NOT_FOUND('员工')
  }
  
  return employee
}
```

#### 修复后（方式2：使用 DBPerformanceTracker）
```typescript
import { DBPerformanceTracker } from '../utils/db-performance.js'

async getById(id: string, c?: Context) {
  const employee = await DBPerformanceTracker.track(
    'EmployeeService.getById',
    () => this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .get(),
    c
  )
  
  if (!employee) {
    throw Errors.NOT_FOUND('员工')
  }
  
  return employee
}
```

---

### 模板2：批量查询优化

#### 修复前
```typescript
async getAssets(assetIds: string[]) {
  const assets = await this.db
    .select()
    .from(fixedAssets)
    .where(inArray(fixedAssets.id, assetIds))
    .all()
  
  return assets
}
```

#### 修复后（方式1：使用 QueryHelpers - 推荐）
```typescript
import { getByIds } from '../utils/query-helpers.js'

async getAssets(assetIds: string[], c?: Context) {
  const assets = await getByIds(
    this.db,
    fixedAssets,
    assetIds,
    'FixedAssetService.getAssets',
    {
      batchSize: 100,
      parallel: true,
    },
    c
  )
  
  return assets
}
```

#### 修复后（方式2：使用 BatchQuery + DBPerformanceTracker）
```typescript
import { BatchQuery } from '../utils/batch-query.js'
import { DBPerformanceTracker } from '../utils/db-performance.js'

async getAssets(assetIds: string[], c?: Context) {
  const assets = await DBPerformanceTracker.track(
    'FixedAssetService.getAssets',
    () => BatchQuery.getByIds(
      this.db,
      fixedAssets,
      assetIds,
      {
        batchSize: 100,
        parallel: true,
        queryName: 'getAssets',
      }
    ),
    c
  )
  
  return assets
}
```

---

### 模板3：事务中的查询

#### 修复前
```typescript
async create(data: any) {
  return await this.db.transaction(async tx => {
    const account = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, data.accountId))
      .get()
    
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }
    
    // ... 其他逻辑
  })
}
```

#### 修复后
```typescript
import { query } from '../utils/query-helpers.js'

async create(data: any, c?: Context) {
  return await this.db.transaction(async tx => {
    const account = await query(
      tx as any, // 事务对象可以作为 db 使用
      'FinanceService.create.getAccount',
      () => tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, data.accountId))
        .get(),
      c
    )
    
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }
    
    // ... 其他逻辑
  })
}
```

---

### 模板4：并行查询优化

#### 修复前
```typescript
async get(id: string) {
  const asset = await this.db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.id, id))
    .get()
  
  const [dept, site, vendor, currency, user] = await Promise.all([
    asset.departmentId
      ? this.db.select().from(departments).where(eq(departments.id, asset.departmentId)).get()
      : null,
    asset.siteId ? this.db.select().from(sites).where(eq(sites.id, asset.siteId)).get() : null,
    asset.vendorId ? this.db.select().from(vendors).where(eq(vendors.id, asset.vendorId)).get() : null,
    asset.currency ? this.db.select().from(currencies).where(eq(currencies.code, asset.currency)).get() : null,
    asset.createdBy ? this.db.select().from(employees).where(eq(employees.id, asset.createdBy)).get() : null,
  ])
  
  return { asset, dept, site, vendor, currency, user }
}
```

#### 修复后
```typescript
import { query } from '../utils/query-helpers.js'

async get(id: string, c?: Context) {
  const asset = await query(
    this.db,
    'FixedAssetService.get.getAsset',
    () => this.db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.id, id))
      .get(),
    c
  )
  
  if (!asset) {
    return null
  }
  
  // 使用批量查询优化并行查询
  const ids = {
    departments: asset.departmentId ? [asset.departmentId] : [],
    sites: asset.siteId ? [asset.siteId] : [],
    vendors: asset.vendorId ? [asset.vendorId] : [],
    currencies: asset.currency ? [asset.currency] : [],
    employees: asset.createdBy ? [asset.createdBy] : [],
  }
  
  const [deptList, siteList, vendorList, currencyList, userList] = await Promise.all([
    ids.departments.length > 0
      ? query(this.db, 'FixedAssetService.get.getDepartment', 
          () => this.db.select().from(departments).where(eq(departments.id, ids.departments[0])).get(), c)
      : Promise.resolve(null),
    ids.sites.length > 0
      ? query(this.db, 'FixedAssetService.get.getSite',
          () => this.db.select().from(sites).where(eq(sites.id, ids.sites[0])).get(), c)
      : Promise.resolve(null),
    ids.vendors.length > 0
      ? query(this.db, 'FixedAssetService.get.getVendor',
          () => this.db.select().from(vendors).where(eq(vendors.id, ids.vendors[0])).get(), c)
      : Promise.resolve(null),
    ids.currencies.length > 0
      ? query(this.db, 'FixedAssetService.get.getCurrency',
          () => this.db.select().from(currencies).where(eq(currencies.code, ids.currencies[0])).get(), c)
      : Promise.resolve(null),
    ids.employees.length > 0
      ? query(this.db, 'FixedAssetService.get.getEmployee',
          () => this.db.select().from(employees).where(eq(employees.id, ids.employees[0])).get(), c)
      : Promise.resolve(null),
  ])
  
  return {
    asset,
    dept: deptList,
    site: siteList,
    vendor: vendorList,
    currency: currencyList,
    user: userList,
  }
}
```

---

## 📝 修复检查清单

### 修复前
- [ ] 确认需要修复的代码位置
- [ ] 理解代码逻辑和上下文
- [ ] 确认是否有 Context 可用

### 修复中
- [ ] 添加正确的导入语句
- [ ] 使用 QueryHelpers 或 DBPerformanceTracker
- [ ] 查询名称符合规范：`ServiceName.methodName.queryName`
- [ ] 保持原有逻辑不变
- [ ] 处理 Context 参数（可选）

### 修复后
- [ ] 代码通过类型检查
- [ ] 代码通过测试
- [ ] 性能监控正常工作
- [ ] 更新相关文档（如需要）

---

## 🎯 命名规范

### 查询名称格式

```
ServiceName.methodName.queryName
```

**示例**:
- `EmployeeService.getById` - 简单查询
- `EmployeeService.create.checkEmail` - 创建方法中的邮箱检查
- `FixedAssetService.get.getAsset` - get 方法中的资产查询
- `FixedAssetService.get.getDepartment` - get 方法中的部门查询

### 命名原则

1. **ServiceName**: 服务类名（如 EmployeeService）
2. **methodName**: 当前方法名（如 getById, create）
3. **queryName**: 查询的具体用途（如 getAsset, checkEmail）

---

## ⚠️ 注意事项

### 1. Context 参数

- Context 是可选的，如果没有 Context，传递 `undefined`
- 如果有 Context，尽量传递以获取更好的监控数据

### 2. 事务处理

- 事务对象（tx）可以作为 db 使用
- 使用 `tx as any` 类型断言（QueryHelpers 接受 DrizzleD1Database）

### 3. 批量大小

- 查询操作：`batchSize: 100`, `parallel: true`
- 更新操作：`batchSize: 50`, `parallel: false`
- 插入操作：`batchSize: 100`, `parallel: false`

### 4. 错误处理

- 保持原有的错误处理逻辑
- 不要改变错误消息和错误代码

---

## 📚 参考

- [开发规范](./DEVELOPMENT_STANDARDS.md)
- [使用指南](./USAGE_GUIDE.md)
- [优化计划](./OPTIMIZATION_PLAN.md)
