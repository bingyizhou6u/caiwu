# 权限系统文档

> **架构**：5 层权限体系  
> **核心文件**：
> - `backend/src/utils/permission-context.ts` - 权限上下文
> - `backend/src/utils/data-access-filter.ts` - 数据访问过滤
> - `backend/src/middleware/permission.ts` - 权限守卫中间件
> - `backend/src/constants/permissions.ts` - 权限常量定义

---

## 🔐 权限层次架构

```
┌─────────────────────────────────────────────────┐
│ Layer 1: IP Whitelist (Cloudflare WAF/Worker)   │
├─────────────────────────────────────────────────┤
│ Layer 2: Authentication (JWT + TOTP 2FA)        │
├─────────────────────────────────────────────────┤
│ Layer 3: RBAC (Role-Based Access Control)       │
├─────────────────────────────────────────────────┤
│ Layer 4: DataScope (Data Isolation)             │
├─────────────────────────────────────────────────┤
│ Layer 5: Approval Workflow                      │
└─────────────────────────────────────────────────┘
```

---

## 📊 DataScope（数据范围）

| Scope | 说明 | 典型角色 |
|-------|------|---------|
| `all` | 全系统访问 | 总部/CEO/财务总监 |
| `project` | 本项目数据 | 项目经理/项目财务 |
| `group` | 本组数据 | 组长 |
| `self` | 仅本人数据 | 普通员工 |

---

## 🛡️ 权限检查 API

### 1. PermissionContext（推荐）

使用 `createPermissionContext` 创建权限上下文，提供统一的权限检查接口：

```typescript
import { createPermissionContext } from '../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../constants/permissions.js'

// 在路由处理器中
const permCtx = createPermissionContext(c)
if (!permCtx) {
  throw Errors.UNAUTHORIZED()
}

// 检查单个权限
if (!permCtx.hasPermission(PermissionModule.FINANCE, 'flow', PermissionAction.CREATE)) {
  throw Errors.FORBIDDEN()
}

// 检查数据访问范围
if (!permCtx.canAccessData('project', targetProjectId)) {
  throw Errors.FORBIDDEN()
}

// 检查审批权限
if (!permCtx.canApprove()) {
  throw Errors.FORBIDDEN('没有审批权限')
}

// 获取权限信息供前端使用
const permissionInfo = permCtx.toJSON()
```

### 2. 权限守卫中间件

使用 `createPermissionGuard` 创建中间件进行路由级权限检查：

```typescript
import { createPermissionGuard } from '../middleware/permission.js'

// 单个权限检查
app.post('/api/flows', 
  createPermissionGuard({ 
    permissions: { module: 'finance', subModule: 'flow', action: 'create' } 
  }),
  handler
)

// 多个权限 AND 逻辑（必须同时满足）
app.post('/api/sensitive-operation',
  createPermissionGuard({
    permissions: [
      { module: 'finance', subModule: 'flow', action: 'create' },
      { module: 'finance', subModule: 'flow', action: 'approve' }
    ],
    logic: 'AND'
  }),
  handler
)

// 多个权限 OR 逻辑（满足任一即可）
app.get('/api/reports',
  createPermissionGuard({
    permissions: [
      { module: 'report', subModule: 'finance', action: 'view' },
      { module: 'report', subModule: 'hr', action: 'view' }
    ],
    logic: 'OR'
  }),
  handler
)

// 跳过权限检查（公开接口）
app.get('/api/public',
  createPermissionGuard({ permissions: [], skip: true }),
  handler
)
```

### 3. 数据访问过滤

使用 `createDataAccessFilterSQL` 生成数据范围过滤 SQL：

```typescript
import { createDataAccessFilterSQL } from '../utils/data-access-filter.js'

// 基本用法
const filter = createDataAccessFilterSQL(c)
const employees = await db
  .select()
  .from(employeesTable)
  .where(filter)

// 自定义字段映射
const filter = createDataAccessFilterSQL(c, {
  projectColumn: 'department_id',  // 项目字段
  groupColumn: 'team_id',          // 组字段
  ownerColumn: 'created_by',       // 所有者字段
  tableAlias: 'e'                  // 表别名
})

// 跳过组级别检查（用于没有 group 字段的表）
const filter = createDataAccessFilterSQL(c, {
  skipGroup: true
})
```

---

## 🔑 权限模块和操作

### 权限模块 (PermissionModule)

| 模块 | 说明 |
|------|------|
| `finance` | 财务模块 |
| `hr` | 人事模块 |
| `asset` | 资产模块 |
| `site` | 站点模块 |
| `report` | 报表模块 |
| `system` | 系统模块 |
| `pm` | 项目管理模块 |
| `self` | 个人模块 |

### 权限操作 (PermissionAction)

| 操作 | 说明 |
|------|------|
| `view` | 查看 |
| `create` | 创建 |
| `update` | 更新 |
| `delete` | 删除 |
| `approve` | 审批 |
| `export` | 导出 |
| `reverse` | 冲正 |

### 子模块示例

| 模块 | 子模块 |
|------|--------|
| **finance** | flow, transfer, ar, ap, salary, allowance, site_bill, reimbursement |
| **hr** | employee, salary, leave, reimbursement |
| **asset** | fixed, rental |
| **site** | info, bill |
| **report** | finance, salary, hr, dashboard |
| **system** | user, position, department, audit, config, currency, account, vendor, category |

---

## 🏢 部门模块限制

部门可配置 `allowedModules` 字段限制可访问的模块：

```json
{
  "allowedModules": ["hr", "finance.flow", "asset.*"]
}
```

- `*` = 允许所有模块
- `hr` = 仅 hr 模块
- `finance.flow` = 仅 finance 的 flow 子模块
- `asset.*` = asset 的所有子模块

---

## 📝 路由权限检查示例

### 推荐模式：辅助函数

```typescript
import { createPermissionContext } from '../../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { Errors } from '../../utils/errors.js'

// 创建辅助函数
function requireFlowPermission(c: any, action: string) {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission(PermissionModule.FINANCE, 'flow', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

// 在路由中使用
flowRoutes.openapi(createFlowRoute, createRouteHandler(async (c) => {
  requireFlowPermission(c, PermissionAction.CREATE)
  // ... 业务逻辑
}))

flowRoutes.openapi(listFlowsRoute, createRouteHandler(async (c) => {
  requireFlowPermission(c, PermissionAction.VIEW)
  
  // 应用数据范围过滤
  const filter = createDataAccessFilterSQL(c, { projectColumn: 'projectId' })
  const flows = await db.select().from(cashFlows).where(filter)
  // ...
}))
```

---

## ⚠️ 重要规范

> [!CAUTION]
> **禁止硬编码职位代码**  
> 永远不要使用 `position.code === 'ceo'` 这样的判断。  
> 应使用 `permCtx.dataScope === 'all'` 或 `permCtx.hasPermission()` 方法。

### ✅ 正确

```typescript
const permCtx = createPermissionContext(c)
if (permCtx?.dataScope === 'all') { ... }
if (permCtx?.hasPermission('hr', 'employee', 'view')) { ... }
```

### ❌ 错误

```typescript
if (position.code === 'ceo') { ... }
if (position.code === 'finance_director') { ... }
```

---

## 🔄 权限缓存

权限信息通过 KV 缓存优化性能：

- 缓存键：`perm:session:{sessionId}`
- 缓存 TTL：5 分钟
- 失效时机：
  - 用户登出
  - 职位权限变更
  - 员工职位变更
  - 部门模块权限变更

```typescript
import { PermissionCache } from '../utils/permission-cache.js'

// 权限变更时清除缓存
await PermissionCache.invalidateByEmployeeId(kv, employeeId)
await PermissionCache.invalidateByPositionId(kv, db, positionId)
await PermissionCache.invalidateByDepartmentId(kv, db, departmentId)
```

---

## 📊 权限审计

权限变更会自动记录到审计日志：

```typescript
import { PermissionAuditService } from '../services/system/PermissionAuditService.js'

// 记录权限变更
await permissionAuditService.logPermissionChange({
  entityType: 'position',
  entityId: positionId,
  changeType: 'update',
  oldValue: oldPermissions,
  newValue: newPermissions,
  operatorId: currentUserId,
  reason: '更新职位权限'
})

// 查询权限变更历史
const history = await permissionAuditService.getPermissionHistory({
  entityType: 'position',
  entityId: positionId,
  limit: 10
})
```

---

## 🌐 前端权限接口

### GET /api/v2/my/permissions

返回当前用户的完整权限信息：

```json
{
  "success": true,
  "data": {
    "permissions": {
      "finance": {
        "flow": ["view", "create", "update"]
      },
      "hr": {
        "employee": ["view"]
      }
    },
    "dataScope": "project",
    "canManageSubordinates": true,
    "allowedModules": ["finance.*", "hr.*"],
    "employee": {
      "id": "emp-123",
      "projectId": "proj-456",
      "orgDepartmentId": "dept-789"
    }
  }
}
```

---

**最后更新**: 2025-12-30
