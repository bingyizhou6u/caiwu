# 权限系统文档

> **架构**：5 层权限体系  
> **核心文件**：`backend/src/utils/permissions.ts`、`backend/src/constants/permissions.ts`

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

### 使用示例

```typescript
import { getDataAccessFilterSQL } from '../utils/permissions.js'

// 在查询中应用数据范围过滤
const filter = getDataAccessFilterSQL(c, 'e', {
  deptColumn: 'departmentId',
  ownerColumn: 'employeeId'
})

const employees = await db
  .select()
  .from(employees)
  .where(filter)
```

---

## 🛡️ RBAC 权限配置

### 权限模块

| 模块 | 子模块 | 操作 |
|------|--------|------|
| **finance** | flow, transfer, ar, ap, salary, allowance, site_bill | view, create, update, delete, export |
| **hr** | employee, salary, leave, reimbursement | view, create, update, delete, approve, view_sensitive |
| **asset** | fixed, rental | view, create, update, delete, allocate |
| **site** | info, bill | view, create, update, delete |
| **report** | view, export | view, export |
| **system** | user, position, department, audit, config | view, create, update, delete |
| **self** | leave, reimbursement, salary, asset | view, create |

### 权限检查

```typescript
import { hasPermission, requirePermission } from '../utils/permissions.js'

// 中间件方式
app.post('/api/employees', requirePermission('hr', 'employee', 'create'), handler)

// 函数方式
if (!hasPermission(c, 'finance', 'flow', 'create')) {
  throw Errors.FORBIDDEN()
}
```

---

## 🔑 核心函数

| 函数 | 说明 |
|------|------|
| `hasPermission(c, module, sub, action)` | 检查操作权限 |
| `canViewEmployee(c, targetId)` | 检查员工数据访问权限 |
| `canApproveApplication(c, applicantId)` | 检查审批权限 |
| `getDataAccessFilterSQL(c, alias, options)` | 获取 SQL 过滤条件 |
| `getUserPosition(c)` | 获取当前用户职位 |
| `canManageSubordinates(c)` | 检查下属管理权限 |

---

## ⚠️ 重要规范

> [!CAUTION]
> **禁止硬编码职位代码**  
> 永远不要使用 `position.code === 'ceo'` 这样的判断。  
> 应使用 `position.dataScope === 'all'` 或 `hasPermission()` 函数。

### ✅ 正确

```typescript
if (position.dataScope === DataScope.ALL) { ... }
if (hasPermission(c, 'hr', 'employee', 'view')) { ... }
```

### ❌ 错误

```typescript
if (position.code === 'ceo') { ... }
if (position.code === 'finance_director') { ... }
```

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

**最后更新**：2025-12-27
