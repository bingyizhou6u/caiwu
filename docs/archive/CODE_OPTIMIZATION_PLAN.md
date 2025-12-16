# 代码精简优化方案

## 📊 当前代码规模分析

- **后端服务层**: 36个文件, 11,585行 (平均322行/文件)
- **后端路由层**: 32个文件, 11,918行 (平均372行/文件)
- **前端功能模块**: 66个文件, 16,144行 (平均245行/文件)
- **总计**: 134个文件, 39,647行

## 🎯 优化目标

预计可精简 **15-25%** 的代码量，提升可维护性和代码复用性。

---

## 1. 提取通用查询构建器 (预计减少 800-1200行)

### 问题
多个服务中重复出现类似的关联查询模式：
- 员工 + 部门 + 组织部门 + 职位的关联查询
- 条件构建模式重复
- 批量获取关联数据的模式重复

### 解决方案
创建 `QueryBuilder` 工具类，封装常用查询模式：

```typescript
// backend/src/utils/query-builder.ts
export class QueryBuilder {
  // 员工关联查询构建器
  static buildEmployeeJoinQuery(db: DrizzleD1Database, baseTable: any, employeeIdField: any) {
    return db
      .select({
        // 基础表字段
        ...baseTable,
        // 员工信息
        employeeName: employees.name,
        employeeEmail: employees.email,
        // 部门信息
        departmentName: departments.name,
        orgDepartmentName: orgDepartments.name,
        // 职位信息
        positionName: positions.name,
      })
      .from(baseTable)
      .leftJoin(employees, eq(employees.id, employeeIdField))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(orgDepartments, eq(orgDepartments.id, employees.orgDepartmentId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
  }

  // 批量获取关联数据
  static async fetchRelatedData(db: DrizzleD1Database, ids: {
    departmentIds?: string[]
    employeeIds?: string[]
    currencyIds?: string[]
    vendorIds?: string[]
  }) {
    const [departments, employees, currencies, vendors] = await Promise.all([
      ids.departmentIds?.length
        ? db.select().from(departments).where(inArray(departments.id, ids.departmentIds)).execute()
        : Promise.resolve([]),
      ids.employeeIds?.length
        ? db.select().from(employees).where(inArray(employees.id, ids.employeeIds)).execute()
        : Promise.resolve([]),
      ids.currencyIds?.length
        ? db.select().from(currencies).where(inArray(currencies.code, ids.currencyIds)).execute()
        : Promise.resolve([]),
      ids.vendorIds?.length
        ? db.select().from(vendors).where(inArray(vendors.id, ids.vendorIds)).execute()
        : Promise.resolve([]),
    ])
    return { departments, employees, currencies, vendors }
  }
}
```

**影响文件**: 
- `ApprovalService.ts` (减少 ~150行)
- `FixedAssetService.ts` (减少 ~200行)
- `SalaryPaymentService.ts` (减少 ~150行)
- `ReportService.ts` (减少 ~100行)
- 其他10+个服务文件 (减少 ~400行)

**预计减少**: 800-1200行

---

## 2. 统一审批流程抽象 (预计减少 400-600行)

### 问题
`ApprovalService.ts` 中 `approveLeave`、`rejectLeave`、`approveReimbursement`、`rejectReimbursement`、`approveBorrowing`、`rejectBorrowing` 等方法有大量重复代码。

### 解决方案
创建通用审批处理器：

```typescript
// backend/src/services/ApprovalService.ts
private async processApproval<T extends { id: string; status: string; employeeId: string }>(params: {
  table: any
  id: string
  userId: string
  action: 'approve' | 'reject'
  stateMachine: StateMachine
  memo?: string
}) {
  const { table, id, userId, action, stateMachine, memo } = params
  
  await this.db.transaction(async tx => {
    const record = await tx.select().from(table).where(eq(table.id, id)).get()
    if (!record) throw Errors.NOT_FOUND('记录')
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    stateMachine.validateTransition(record.status || 'pending', newStatus)
    
    const canApprove = await this.permissionService.canApprove(userId, record.employeeId)
    if (!canApprove) throw Errors.FORBIDDEN('无权审批')
    
    const beforeData = { status: record.status }
    const now = Date.now()
    await tx
      .update(table)
      .set({
        status: newStatus,
        approvedBy: userId,
        approvedAt: now,
        memo: memo || record.memo,
        updatedAt: now,
      })
      .where(eq(table.id, id))
      .execute()
    
    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          this.getEntityType(table),
          id,
          newStatus,
          userId,
          beforeData,
          { status: newStatus },
          memo
        )
        .catch(err => console.error('Failed to record operation history:', err))
    }
    
    // 发送通知
    this.notificationService
      .notifyApprovalResult(this.getEntityType(table), id, newStatus, userId)
      .catch(err => console.error('Failed to send notification:', err))
  })
}

async approveLeave(id: string, userId: string, memo?: string) {
  return this.processApproval({
    table: schema.employeeLeaves,
    id,
    userId,
    action: 'approve',
    stateMachine: leaveStateMachine,
    memo,
  })
}
```

**影响文件**: 
- `ApprovalService.ts` (减少 ~400行)

**预计减少**: 400-600行

---

## 3. 拆分超大文件 (预计减少 500-800行重复)

### 问题
部分服务文件过大，职责不清晰：
- `FixedAssetService.ts` (999行) - 可拆分为：资产CRUD、资产分配、资产变更、折旧管理
- `ReportService.ts` (962行) - 可拆分为：仪表盘统计、财务报表、业务报表
- `SalaryPaymentService.ts` (874行) - 可拆分为：薪资生成、薪资审批、薪资支付

### 解决方案

#### 3.1 拆分 FixedAssetService
```
FixedAssetService.ts (核心CRUD)
├── FixedAssetAllocationService.ts (分配管理)
├── FixedAssetChangeService.ts (变更记录)
└── FixedAssetDepreciationService.ts (折旧计算)
```

#### 3.2 拆分 ReportService
```
ReportService.ts (核心接口)
├── DashboardReportService.ts (仪表盘统计)
├── FinancialReportService.ts (财务报表)
└── BusinessReportService.ts (业务报表)
```

#### 3.3 拆分 SalaryPaymentService
```
SalaryPaymentService.ts (核心流程)
├── SalaryGenerationService.ts (薪资生成)
└── SalaryPaymentProcessService.ts (支付流程)
```

**影响文件**: 
- 3个大文件拆分为 9个文件
- 通过接口抽象减少重复代码

**预计减少**: 500-800行 (主要是减少重复的导入和初始化代码)

---

## 4. 统一错误处理和响应格式 (预计减少 200-300行)

### 问题
路由层有大量重复的错误处理和响应格式化代码。

### 解决方案
创建路由辅助函数：

```typescript
// backend/src/utils/route-helpers.ts
export function createRouteHandler<T>(
  handler: (c: Context) => Promise<T>
) {
  return async (c: Context) => {
    try {
      const result = await handler(c)
      return c.json({ success: true, data: result })
    } catch (error) {
      throw error // 由全局错误处理中间件处理
    }
  }
}

export function createPaginatedHandler<T>(
  handler: (c: Context) => Promise<{ items: T[]; total: number }>
) {
  return createRouteHandler(async (c) => {
    const result = await handler(c)
    return {
      items: result.items,
      pagination: {
        total: result.total,
        page: parseInt(c.req.query('page') || '1'),
        limit: parseInt(c.req.query('limit') || '20'),
      }
    }
  })
}
```

**影响文件**: 
- 所有路由文件 (减少 ~200-300行)

**预计减少**: 200-300行

---

## 5. 前端组件复用优化 (预计减少 800-1200行)

### 问题
前端页面有大量重复的表格、表单、模态框代码。

### 解决方案

#### 5.1 创建通用表格组件
```typescript
// frontend/src/components/common/DataTable.tsx
export function DataTable<T>({
  columns,
  data,
  loading,
  pagination,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  // 统一的表格实现
}
```

#### 5.2 创建通用表单组件
```typescript
// frontend/src/components/common/FormModal.tsx
export function FormModal<T>({
  formSchema,
  initialValues,
  onSubmit,
  onCancel,
}: FormModalProps<T>) {
  // 统一的表单模态框实现
}
```

#### 5.3 创建通用搜索过滤器
```typescript
// frontend/src/components/common/SearchFilters.tsx
export function SearchFilters({
  filters,
  onSearch,
  onReset,
}: SearchFiltersProps) {
  // 统一的搜索过滤器实现
}
```

**影响文件**: 
- 所有前端页面文件 (减少 ~800-1200行)

**预计减少**: 800-1200行

---

## 6. 数据库查询优化 (预计减少 300-500行)

### 问题
多处使用原生 SQL，可以统一使用 Drizzle ORM。

### 解决方案
将 `MasterDataService.ts` 中的原生 SQL 迁移到 Drizzle ORM：

```typescript
// 替换原生 SQL
async getOrgDepartments(projectId?: string) {
  const conditions = [eq(orgDepartments.active, 1)]
  if (projectId === 'hq') {
    conditions.push(sql`${orgDepartments.projectId} IS NULL`)
  } else if (projectId) {
    conditions.push(eq(orgDepartments.projectId, projectId))
  }
  
  return await this.db
    .select({
      ...orgDepartments,
      defaultPositionName: positions.name,
      parentName: sql<string>`parent.name`,
      projectName: departments.name,
    })
    .from(orgDepartments)
    .leftJoin(positions, eq(positions.id, orgDepartments.defaultPositionId))
    .leftJoin(sql`org_departments parent`, sql`parent.id = ${orgDepartments.parentId}`)
    .leftJoin(departments, eq(departments.id, orgDepartments.projectId))
    .where(and(...conditions))
    .orderBy(
      desc(sql`${orgDepartments.projectId} IS NULL`),
      asc(orgDepartments.sortOrder),
      asc(orgDepartments.name)
    )
    .execute()
}
```

**影响文件**: 
- `MasterDataService.ts` (减少 ~200行)
- `ReportService.ts` (减少 ~100行)
- 其他使用原生 SQL 的文件 (减少 ~100行)

**预计减少**: 300-500行

---

## 📈 优化效果预估

| 优化项 | 预计减少行数 | 优先级 |
|--------|-------------|--------|
| 1. 提取通用查询构建器 | 800-1200行 | ⭐⭐⭐⭐⭐ |
| 2. 统一审批流程抽象 | 400-600行 | ⭐⭐⭐⭐⭐ |
| 3. 拆分超大文件 | 500-800行 | ⭐⭐⭐⭐ |
| 4. 统一错误处理 | 200-300行 | ⭐⭐⭐ |
| 5. 前端组件复用 | 800-1200行 | ⭐⭐⭐⭐ |
| 6. 数据库查询优化 | 300-500行 | ⭐⭐⭐ |
| **总计** | **3000-4600行** | **约 8-12%** |

---

## 🚀 实施建议

### 第一阶段 (高优先级)
1. ✅ 提取通用查询构建器
2. ✅ 统一审批流程抽象
3. ✅ 前端通用组件提取

### 第二阶段 (中优先级)
4. ✅ 拆分超大文件
5. ✅ 统一错误处理

### 第三阶段 (低优先级)
6. ✅ 数据库查询优化

---

## ⚠️ 注意事项

1. **保持向后兼容**: 所有优化都要保持 API 接口不变
2. **充分测试**: 每个优化都要有对应的测试覆盖
3. **渐进式重构**: 不要一次性重构所有代码，按模块逐步进行
4. **代码审查**: 重构后的代码需要经过代码审查
5. **文档更新**: 更新相关技术文档和注释

---

## 📝 实施检查清单

- [ ] 创建 `QueryBuilder` 工具类
- [ ] 重构 `ApprovalService` 使用通用审批处理器
- [ ] 拆分 `FixedAssetService` 为多个服务
- [ ] 拆分 `ReportService` 为多个服务
- [ ] 拆分 `SalaryPaymentService` 为多个服务
- [ ] 创建路由辅助函数
- [ ] 创建前端通用表格组件
- [ ] 创建前端通用表单组件
- [ ] 创建前端通用搜索过滤器
- [ ] 迁移原生 SQL 到 Drizzle ORM
- [ ] 更新所有相关测试
- [ ] 更新技术文档

