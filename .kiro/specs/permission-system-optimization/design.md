# Design Document: Permission System Optimization

## Overview

本设计文档描述权限系统优化的技术实现方案。优化目标是统一权限检查机制、提供声明式配置、优化数据访问过滤性能，同时保持向后兼容。

## Architecture

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request → Auth Middleware → Permission Guard → Route Handler   │
│                    │                │                            │
│                    ▼                ▼                            │
│            ┌──────────────┐  ┌──────────────┐                   │
│            │ Permission   │  │ Data Access  │                   │
│            │ Context      │  │ Filter       │                   │
│            └──────┬───────┘  └──────┬───────┘                   │
│                   │                 │                            │
│                   ▼                 ▼                            │
│            ┌──────────────────────────────┐                     │
│            │     KV Cache (Sessions)      │                     │
│            └──────────────────────────────┘                     │
│                          │                                       │
│                          ▼                                       │
│            ┌──────────────────────────────┐                     │
│            │     D1 Database              │                     │
│            │  (positions, employees, etc) │                     │
│            └──────────────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 模块划分

```
backend/src/
├── middleware/
│   ├── auth.ts              # 现有认证中间件
│   └── permission-guard.ts  # 新增：路由级权限守卫
├── utils/
│   ├── permission-context.ts # 新增：权限上下文类
│   └── data-access-filter.ts # 新增：数据访问过滤器
├── services/
│   └── hr/
│       └── PermissionService.ts # 增强：添加审计功能
└── constants/
    └── permissions.ts       # 现有：权限常量定义
```

## Components and Interfaces

### 1. Permission Guard (权限守卫中间件)

```typescript
// backend/src/middleware/permission-guard.ts

import { Context, Next } from 'hono'
import type { Env, AppVariables } from '../types/index.js'

/**
 * 权限要求配置
 */
interface PermissionRequirement {
  module: string
  subModule?: string
  action?: string
}

/**
 * 权限守卫配置
 */
interface PermissionGuardConfig {
  /** 所需权限（单个或多个） */
  permissions: PermissionRequirement | PermissionRequirement[]
  /** 多个权限的组合逻辑，默认 'AND' */
  logic?: 'AND' | 'OR'
  /** 是否跳过权限检查 */
  skip?: boolean
  /** 自定义错误消息 */
  errorMessage?: string
}

/**
 * 创建权限守卫中间件
 */
export function requirePermission(
  module: string,
  subModule?: string,
  action?: string
): (c: Context, next: Next) => Promise<Response | void>

/**
 * 创建带配置的权限守卫中间件
 */
export function createPermissionGuard(
  config: PermissionGuardConfig
): (c: Context, next: Next) => Promise<Response | void>

/**
 * 检查用户是否具有指定权限
 */
function checkPermission(
  userPermissions: Record<string, Record<string, string[]>>,
  requirement: PermissionRequirement
): boolean
```

### 2. Permission Context (权限上下文)

```typescript
// backend/src/utils/permission-context.ts

import type { Env, AppVariables } from '../types/index.js'

/**
 * 权限上下文类
 * 封装用户权限信息和常用权限检查方法
 */
export class PermissionContext {
  constructor(
    private employeeId: string,
    private position: {
      id: string
      code: string
      name: string
      canManageSubordinates: number
      dataScope: string
      permissions: Record<string, Record<string, string[]>>
    },
    private employee: {
      id: string
      orgDepartmentId: string | null
      projectId: string | null
    },
    private departmentModules: string[]
  ) {}

  /** 检查是否具有指定权限 */
  hasPermission(module: string, subModule?: string, action?: string): boolean

  /** 检查是否可以访问指定员工的数据 */
  canAccessData(targetEmployeeId: string): Promise<boolean>

  /** 检查是否可以审批指定员工的申请 */
  canApprove(applicantEmployeeId: string): Promise<boolean>

  /** 获取数据范围 */
  get dataScope(): string

  /** 是否可以管理下属 */
  get canManageSubordinates(): boolean

  /** 获取部门允许的模块 */
  get allowedModules(): string[]

  /** 检查模块是否被部门允许 */
  isModuleAllowed(module: string): boolean

  /** 导出为 JSON（用于前端） */
  toJSON(): PermissionContextJSON
}

/**
 * 从请求上下文创建 PermissionContext
 */
export function createPermissionContext(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): PermissionContext
```

### 3. Data Access Filter (数据访问过滤器)

```typescript
// backend/src/utils/data-access-filter.ts

import { SQL } from 'drizzle-orm'

/**
 * 字段映射配置
 */
interface FieldMapping {
  /** 员工ID字段名，默认 'employeeId' */
  employeeId?: string
  /** 项目ID字段名，默认 'projectId' */
  projectId?: string
  /** 部门ID字段名，默认 'orgDepartmentId' */
  orgDepartmentId?: string
  /** 创建人字段名，默认 'createdBy' */
  createdBy?: string
}

/**
 * 数据访问过滤器配置
 */
interface DataAccessFilterConfig {
  /** 数据范围 */
  dataScope: 'all' | 'project' | 'group' | 'self'
  /** 当前用户信息 */
  user: {
    id: string
    projectId: string | null
    orgDepartmentId: string | null
  }
  /** 字段映射 */
  fieldMapping?: FieldMapping
  /** self 模式下使用的字段，默认 'employeeId' */
  selfField?: 'employeeId' | 'createdBy'
}

/**
 * 生成数据访问过滤条件
 * @returns SQL 条件或 undefined（表示不过滤）
 */
export function createDataAccessFilter(
  config: DataAccessFilterConfig
): SQL | undefined

/**
 * 为 Drizzle 查询添加数据访问过滤
 */
export function withDataAccessFilter<T>(
  query: T,
  table: any,
  config: DataAccessFilterConfig
): T
```

### 4. Permission Audit Service (权限审计服务)

```typescript
// backend/src/services/system/PermissionAuditService.ts

/**
 * 权限变更类型
 */
type PermissionChangeType = 
  | 'position_permission_update'
  | 'employee_position_change'
  | 'department_module_update'

/**
 * 权限变更记录
 */
interface PermissionChangeRecord {
  changeType: PermissionChangeType
  entityType: string
  entityId: string
  beforeData: any
  afterData: any
  operatorId: string
  operatorName?: string
  ip?: string
  memo?: string
}

export class PermissionAuditService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /** 记录权限变更 */
  async logPermissionChange(record: PermissionChangeRecord): Promise<void>

  /** 查询权限变更历史 */
  async getPermissionHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PermissionChangeRecord[]>

  /** 计算权限差异 */
  static diffPermissions(
    before: Record<string, Record<string, string[]>>,
    after: Record<string, Record<string, string[]>>
  ): { added: any; removed: any; changed: any }
}
```

## Data Models

### 现有数据模型（无需修改）

```typescript
// positions 表
{
  id: string
  code: string
  name: string
  dataScope: 'all' | 'project' | 'group' | 'self'
  canManageSubordinates: 0 | 1
  permissions: string // JSON: { module: { subModule: ['action'] } }
}

// employees 表
{
  id: string
  positionId: string
  projectId: string | null
  orgDepartmentId: string | null
}

// orgDepartments 表
{
  id: string
  allowedModules: string // JSON: ['module.*', 'module.subModule']
}
```

### 审计日志扩展

```typescript
// 复用现有 businessOperationHistory 表
{
  entityType: 'position_permission' | 'employee_position' | 'department_module'
  action: 'permission_update' | 'position_change' | 'module_update'
  beforeData: string // JSON
  afterData: string  // JSON
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Permission Check Correctness

*For any* user with permissions P and any route requiring permission R, the permission guard should return true if and only if P contains R (considering AND/OR logic).

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Data Access Filter Correctness

*For any* dataScope value and user context, the generated SQL condition should correctly filter data according to the scope rules:
- 'all' → no filter
- 'project' → filter by projectId
- 'group' → filter by orgDepartmentId  
- 'self' → filter by employeeId or createdBy

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Field Mapping Consistency

*For any* custom field mapping configuration, the Data_Access_Filter should use the mapped field names in the generated SQL condition.

**Validates: Requirements 2.6**

### Property 4: Permission Context Completeness

*For any* authenticated user, the Permission_Context should contain all required fields: permissions, dataScope, canManageSubordinates, and departmentModules.

**Validates: Requirements 3.2**

### Property 5: hasPermission Method Correctness

*For any* permission query (module, subModule, action), the hasPermission method should return true if and only if the user's permissions include the queried permission.

**Validates: Requirements 3.3**

### Property 6: Audit Log Completeness

*For any* permission change operation, the audit log should contain: changeType, entityType, entityId, beforeData, afterData, operatorId, and timestamp.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 7: Cache Consistency

*For any* permission change, the related cache entries should be invalidated, and subsequent reads should return the updated data.

**Validates: Requirements 6.2, 6.3**

### Property 8: API Response Completeness

*For any* call to /api/v2/my/permissions, the response should include: permissions, dataScope, canManageSubordinates, and allowedModules.

**Validates: Requirements 5.2, 5.3**

## Migration Strategy

由于不需要向后兼容，可以直接重构现有代码：

1. **替换现有权限检查** - 将分散的 `hasPermission` 调用替换为 Permission Guard 中间件
2. **统一数据过滤** - 将各服务中的数据范围过滤逻辑替换为 Data Access Filter
3. **移除冗余代码** - 删除前端重复的权限检查逻辑，统一使用后端返回的权限信息

## Error Handling

### 权限错误响应格式

```typescript
interface PermissionErrorResponse {
  success: false
  error: {
    code: 'PERMISSION_DENIED' | 'MODULE_NOT_ALLOWED'
    message: string
    details?: {
      required: PermissionRequirement
      actual: string[]
    }
  }
}
```

### 错误码定义

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| PERMISSION_DENIED | 403 | 用户缺少所需权限 |
| MODULE_NOT_ALLOWED | 403 | 用户部门不允许访问该模块 |
| INVALID_DATA_SCOPE | 500 | 无效的数据范围配置 |

## Testing Strategy

### 单元测试

1. **Permission Guard Tests**
   - 测试单个权限检查
   - 测试 AND/OR 组合逻辑
   - 测试跳过配置

2. **Data Access Filter Tests**
   - 测试各 dataScope 生成的 SQL 条件
   - 测试自定义字段映射

3. **Permission Context Tests**
   - 测试 hasPermission 方法
   - 测试 toJSON 序列化

### 属性测试

使用 fast-check 进行属性测试：

1. **Permission Check Property Test**
   - 生成随机用户权限和路由权限要求
   - 验证检查结果符合预期

2. **Data Access Filter Property Test**
   - 生成随机 dataScope 和用户信息
   - 验证生成的 SQL 条件正确

3. **Audit Log Property Test**
   - 生成随机权限变更
   - 验证审计日志包含所有必要字段

### 集成测试

1. 测试完整的请求流程（认证 → 权限检查 → 数据过滤）
2. 测试缓存失效机制
3. 测试审计日志记录
