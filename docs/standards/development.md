# 开发规范与标准

**文档版本**: 1.2  
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

#### 必须使用事务而非批量操作（Jan 2025）

**规则**: 所有需要原子性的数据库操作必须使用 `db.transaction()`，而不是 `db.batch()`。

**原因**:
- `transaction()` 语义更清晰，明确表示事务操作
- 统一事务管理，便于维护和调试
- 确保操作的原子性和一致性

**模板**:
```typescript
// ❌ 错误：使用 batch（语义不清晰）
const result = await db.batch([
  db.update(table).set({ ... }),
  db.insert(table).values({ ... }),
])

// ✅ 正确：使用 transaction（语义清晰）
await db.transaction(async tx => {
  await tx.update(table).set({ ... }).execute()
  await tx.insert(table).values({ ... }).execute()
})
```

**注意事项**:
- 如果方法已经接收 `tx` 参数，说明已经在事务中，直接使用 `tx` 而不是创建新事务
- 事务中的操作必须使用 `tx` 而不是 `db`

**示例**:
```typescript
async createCashFlow(data: any, tx?: any) {
  const db = tx || this.db
  
  const executeInTransaction = async (transactionDb: any) => {
    // 使用 transactionDb 执行操作
    await transactionDb.update(...).execute()
    await transactionDb.insert(...).execute()
  }
  
  // 如果已经传入 tx，直接执行；否则创建新事务
  if (tx) {
    await executeInTransaction(tx)
  } else {
    await db.transaction(executeInTransaction)
  }
}
```

#### 禁止在 D1 中使用复杂 JOIN 查询 (Dec 2025)

**规则**: Cloudflare D1 对复杂 JOIN 查询支持不稳定，生产环境会随机返回 500 错误。**必须使用顺序查询模式**代替复杂 JOIN。

**禁止**:
- 超过 1 个 JOIN 的查询
- INNER JOIN + LEFT JOIN 组合
- 多表 JOIN 查询
- 链式 JOIN（如 `leftJoin(...).leftJoin(...).leftJoin(...)`）

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
- `ApprovalService.ts` - `getPendingApprovals()`, `getApprovalHistory()`
- `EmployeeLeaveService.ts` - `listLeaves()`, `getLeavesWithApprover()`
- `ExpenseReimbursementService.ts` - `listReimbursements()`, `getReimbursementsWithApprover()`
- `EmployeeService.ts` - `getById()`
- `FinanceService.ts` - `createCashFlow()` (使用 transaction), `listCashFlows()`
- `SalaryPaymentService.ts` - `list()`, `get()`
- `OrgDepartmentService.ts` - `getOrgDepartments()`
- `FinancialReportService.ts` - `getExpenseDetail()`
- `DashboardReportService.ts` - `getRecentFlows()`
- `QueryBuilder.ts` - `buildEmployeeJoinQuery()` (已废弃，使用 `buildEmployeeRelatedData()`)

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

### 3. 迁移管理规范

#### 统一使用 Drizzle Kit 生成迁移

**规则**: 所有数据库结构变更必须通过 Drizzle Kit 生成迁移文件，禁止手动编写 SQL。

**流程**:
1. 修改 `backend/src/db/schema.ts`
2. 运行 `npm run db:generate` 生成迁移文件
3. 检查生成的迁移文件（位于 `backend/drizzle/` 目录）
4. 运行 `npm run migrate:up` 应用迁移（本地）或 `npm run migrate:up:remote`（远程）

**禁止**:
- 手动编写 SQL 迁移文件（除非特殊情况）
- 直接在生产环境执行 SQL
- 跳过迁移追踪

**迁移文件命名**:
- Drizzle 自动生成：`XXXXX_description.sql`
- 手动迁移（如需要）：`migration_YYYYMMDD_description.sql`

**迁移追踪**:
- 使用 `schema_migrations` 表追踪已执行的迁移
- 运行 `npm run migrate:status` 查看迁移状态
- 运行 `npm run migrate:check` 检查迁移一致性

---

### 4. 服务层组织规范

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

### 7. 时间处理规范

#### 必须使用统一业务时间

**规则**: 后端禁止直接使用 `new Date()` 或 `Date.now()` 获取当前时间进行业务计算。必须使用 `getBusinessDate()` 工具函数。

**原因**: 系统统一运行在迪拜时间 (UTC+4)，使用原生 Date 对象会受服务器容器时区（通常是 UTC+0）影响，导致跨日结算或报表错误。

**模板**:
```typescript
import { getBusinessDate } from '../utils/date.js'

// ❌ 禁止
const today = new Date().toISOString().split('T')[0]
const now = new Date()

// ✅ 正确
const today = getBusinessDate() // 返回 'YYYY-MM-DD' (UTC+4)
// 如需完整时间对象，请参考 utils/date.js 中的具体实现
```

### 8. 金额处理规范

#### 数据库存储最小单位

**规则**: 涉及金额的字段，数据库**必须**存储整数（分/Cents），禁止存储小数。

**前端显示**:
- 后端返回数据保持整数（如 `10000` 表示 100元）。
- 前端显示时统一除以 100。
- 前端提交时统一乘以 100 转为整数。

**变量命名**:
- 推荐使用后缀明确单位，例如 `amountCents` 或 `priceCents`，避免歧义。

**计算**:
- 所有加减乘除必须在整数层面完成，最后一步再进行格式化。

### 9. API 交互规范

#### 严格的 Zod Schema 校验

**规则**:
1. 所有**写操作** (POST/PUT/PATCH) 的 Request Body 必须通过 `zodValidator` 中间件校验。
2. 禁止在 Controller 内部手动判断 `if (!body.name) ...`。
3. Schema 定义文件应放在 `src/schemas/` 目录下复用。

**模板**:
```typescript
// ❌ 禁止：手动校验
app.post('/create', async (c) => {
  const body = await c.req.json()
  if (!body.title) return c.json({ error: 'Title required' })
})

// ✅ 正确：Zod 中间件
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const createSchema = z.object({
  title: z.string().min(1),
  amountCents: z.number().int().positive()
})

app.post('/create', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json') // 类型安全
})
```

### 10. 代码整洁规范

#### 明确的废弃流程

**规则**:
- **重构时**: 如果彻底替换了某个实现（如 SQL Join 改为顺序查询），旧代码应直接删除，**不要**注释保留（Git 历史已有记录）。
- **暂时停用**: 如果是业务暂时下线但未来可能恢复，可以使用注释，但必须加上 `TODO: [DATE] [REASON]` 标记。
- **YAGNI**: 不要预留“未来可能会用到”的接口参数或空方法。

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
- [ ] **时间处理是否使用了 `getBusinessDate()` (UTC+4)？**
- [ ] **金额是否以整数(Cents)存储和计算？**
- [ ] **写接口是否使用了 Zod Schema 校验？**

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

## 🖥️ 前端开发规范 (Dec 2025)

### 1. Hooks 规范

#### 单实体查询使用专用 Hook

**规则**: 列表查询和单个实体查询必须使用不同的 Hook，不要从列表中 find。

```tsx
// ❌ 错误：从列表中查找单个实体
const { data: tasks = [] } = useTasks(projectId)
const task = tasks.find(t => t.id === taskId)  // 列表可能未加载完

// ✅ 正确：使用专用 Hook
const { data: task, isLoading } = useTask(taskId)  // 专门获取单个任务
```

### 2. 页面标题规范

#### PageContainer 必须设置 documentTitle

**规则**: 动态页面必须设置 `documentTitle` 属性，确保 MultiTabs 和浏览器标签显示正确标题。

```tsx
// ❌ 错误：只设置 React 标题，浏览器标签显示"未命名页面"
<PageContainer title={project?.name || '项目详情'}>

// ✅ 正确：同时设置 documentTitle
<PageContainer 
  title={project?.name || '项目详情'}
  documentTitle={project?.name || '项目详情'}
>
```

### 3. 表单多选规范

#### JSON 数组字段使用多选 Select

**规则**: 后端存储为 JSON 数组的字段，前端表单必须使用 `mode="multiple"` 的 Select。

```tsx
// 支持多人选择
<Form.Item name="assigneeIds" label="开发人员">
  <Select
    mode="multiple"
    placeholder="选择开发人员（可多选）"
    options={employeeOptions}
  />
</Form.Item>
```

### 4. 任务卡片交互规范

#### 悬停和点击反馈

**规则**: 可点击的卡片必须有明显的悬停效果。

```css
/* 任务卡片悬停效果 */
.task-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.task-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px -8px rgba(99, 102, 241, 0.25);
  border-color: var(--color-primary);
}
```

### 5. 状态配置规范

#### 集中管理状态映射

**规则**: 任务/审批等状态必须在页面顶部集中定义配置对象。

```tsx
// 集中定义状态配置
const TASK_STATUS_CONFIG = {
  todo: { label: '待办', color: 'default' },
  design_review: { label: '需求评审', color: 'orange' },
  in_progress: { label: '开发中', color: 'processing' },
  code_review: { label: '代码评审', color: 'warning' },
  testing: { label: '测试中', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
}

// 使用配置
<Tag color={TASK_STATUS_CONFIG[status]?.color}>
  {TASK_STATUS_CONFIG[status]?.label || status}
</Tag>
```

---

## 🔄 更新记录

- 2025-12-29: 补充业务一致性规范（时间、金额、Zod校验、YAGNI）
- 2025-12-28: 添加前端开发规范（Hooks、页面标题、多选表单、卡片交互）
- 2025-12-26: 添加 D1 顺序查询规范（禁止复杂 JOIN）
- 2025-12-25: 添加权限与数据隔离规范 (DataScope)
- 2025-01-27: 初始版本，建立开发规范

---

**维护者**: 开发团队  
**审核周期**: 随项目发展更新
