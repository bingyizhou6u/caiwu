# API参考

<cite>
**本文档引用的文件**
- [openapi.json](file://backend/openapi.json)
- [export-openapi.ts](file://backend/scripts/export-openapi.ts)
- [api.ts](file://frontend/src/config/api.ts)
- [schema.d.ts](file://frontend/src/types/schema.d.ts)
- [auth.ts](file://backend/src/routes/v2/auth.ts) - V2版本
- [employees.ts](file://backend/src/routes/v2/employees.ts) - V2版本
- [employee-leaves.ts](file://backend/src/routes/v2/employee-leaves.ts) - V2版本
- [expense-reimbursements.ts](file://backend/src/routes/v2/expense-reimbursements.ts) - V2版本
- [flows.ts](file://backend/src/routes/v2/flows.ts) - V2版本
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts) - V2版本
- [reports.ts](file://backend/src/routes/v2/reports.ts) - V2版本
- [common.schema.ts](file://backend/src/schemas/common.schema.ts)
- [business.schema.ts](file://backend/src/schemas/business.schema.ts)
- [employee.schema.ts](file://backend/src/schemas/employee.schema.ts)
- [response.ts](file://backend/src/utils/response.ts) - V2响应格式工具
- [errors.ts](file://backend/src/utils/errors.js) - V2错误处理
</cite>

> **📌 API版本说明**
> 
> 本文档描述的是 **API v2** 版本，所有端点使用 `/api/v2/` 前缀（兼容 `/api/` 路径）。
> 
> **主要变化**：
> - ✅ 响应格式统一为 `{ success: boolean, data?: any, error?: { code, message } }`
> - ✅ 分页响应使用 `{ items: [], pagination: {} }` 结构
> - ✅ 错误响应统一使用 `error` 对象，包含错误码和消息
> - ✅ 所有路由已迁移到 `backend/src/routes/v2/` 目录

## 目录
1. [API设计原则](#api设计原则)
2. [认证与授权](#认证与授权)
3. [员工管理API](#员工管理api)
4. [请假管理API](#请假管理api)
5. [报销管理API](#报销管理api)
6. [财务流水API](#财务流水api)
7. [应收应付API](#应收应付api)
8. [报表API](#报表api)
9. [OpenAPI文档生成](#openapi文档生成)
10. [前端调用示例](#前端调用示例)
11. [后端接口设计规范](#后端接口设计规范)

## API设计原则

本系统遵循RESTful架构风格，采用统一的响应格式和命名规范。所有API端点均以`/api/v2`为前缀（兼容`/api`路径），使用HTTP动词表示操作类型（GET、POST、PUT、DELETE）。响应体采用统一的JSON格式，包含`success`字段表示操作成功与否，以及相应的数据或错误信息。

### API版本
- **当前版本**: v2
- **路径格式**: `/api/v2/...` 或 `/api/...`（自动映射到v2）
- **响应格式**: 统一使用 `{ success: boolean, data?: any, error?: { code, message } }` 结构

API设计遵循以下原则：
- **资源导向**：每个API端点代表一个明确的资源（如员工、请假、报销等）
- **统一响应格式**：所有响应都遵循一致的结构（`success` + `data`/`error`），便于前端处理
- **版本控制**：通过URL路径进行版本管理（`/api/v2/...`），支持多版本并存
- **安全性**：所有受保护的端点都需要JWT认证
- **可发现性**：通过OpenAPI文档提供完整的API描述

**Section sources**
- [openapi.json](file://backend/openapi.json)
- [index.ts](file://backend/src/index.ts)

## 认证与授权

### 认证流程
系统采用JWT（JSON Web Token）进行认证。用户登录后，服务器返回一个包含用户信息和权限的JWT令牌，后续请求需要在`Authorization`头中携带此令牌。

#### 登录
```http
POST /api/v2/auth/login
```

**请求头**
- `Content-Type: application/json`

**请求体**
```json
{
  "email": "string",
  "password": "string",
  "totp": "string"
}
```

**响应体（V2格式）**
```json
{
  "success": true,
  "data": {
    "token": "string",
    "expiresIn": 0,
    "user": {},
    "mustChangePassword": false,
    "needTotp": false,
    "message": "string"
  }
}
```

**错误响应**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "认证失败"
  }
}
```

#### 获取当前用户信息
```http
GET /api/v2/auth/me
```

**请求头**
- `Authorization: Bearer <token>`

**响应体（V2格式）**
```json
{
  "success": true,
  "data": {
    "user": {}
  }
}
```

#### 获取用户权限
```http
GET /api/v2/my-permissions
```

**请求头**
- `Authorization: Bearer <token>`

**响应体（V2格式）**
```json
{
  "success": true,
  "data": {
    "permissions": {}
  }
}
```

**Section sources**
- [auth.ts](file://backend/src/routes/auth.ts)
- [openapi.json](file://backend/openapi.json)

## 员工管理API

员工管理API提供对员工信息的增删改查功能，包括创建员工、更新员工信息、员工转正等操作。

### 获取员工列表
```http
GET /api/v2/employees
```

**响应体（V2格式）**
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `status`: 员工状态（all, regular, probation, resigned）
- `activeOnly`: 是否只显示活跃员工（true, false）
- `employeeId`: 员工ID
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应体**
```json
{
  "results": [
    {
      "id": "string",
      "name": "string",
      "personalEmail": "string",
      "orgDepartmentId": "string",
      "departmentId": "string",
      "positionId": "string",
      "joinDate": "string",
      "birthday": "string",
      "phone": "string",
      "usdtAddress": "string",
      "address": "string",
      "emergencyContact": "string",
      "emergencyPhone": "string",
      "memo": "string",
      "workSchedule": "string",
      "annualLeaveCycleMonths": 0,
      "annualLeaveDays": 0,
      "probationSalaryCents": 0,
      "regularSalaryCents": 0,
      "livingAllowanceCents": 0,
      "housingAllowanceCents": 0,
      "transportationAllowanceCents": 0,
      "mealAllowanceCents": 0,
      "active": 0,
      "createdAt": 0,
      "updatedAt": 0
    }
  ]
}
```

### 创建员工
```http
POST /api/employees
```

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "name": "string",
  "personalEmail": "string",
  "orgDepartmentId": "string",
  "departmentId": "string",
  "positionId": "string",
  "joinDate": "string",
  "birthday": "string",
  "phone": "string",
  "usdtAddress": "string",
  "address": "string",
  "emergencyContact": "string",
  "emergencyPhone": "string",
  "memo": "string",
  "workSchedule": "string",
  "annualLeaveCycleMonths": 0,
  "annualLeaveDays": 0
}
```

**响应体**
```json
{
  "id": "string",
  "email": "string",
  "personalEmail": "string",
  "userAccountCreated": true,
  "userRole": "string",
  "emailSent": true,
  "emailRoutingCreated": true
}
```

### 更新员工信息
```http
PUT /api/employees/{id}
```

**路径参数**
- `id`: 员工ID

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "name": "string",
  "departmentId": "string",
  "orgDepartmentId": "string",
  "positionId": "string",
  "joinDate": "string",
  "probationSalaryCents": 0,
  "regularSalaryCents": 0,
  "livingAllowanceCents": 0,
  "housingAllowanceCents": 0,
  "transportationAllowanceCents": 0,
  "mealAllowanceCents": 0,
  "active": 0,
  "phone": "string",
  "personalEmail": "string",
  "usdtAddress": "string",
  "emergencyContact": "string",
  "emergencyPhone": "string",
  "address": "string",
  "memo": "string",
  "birthday": "string",
  "workSchedule": "string",
  "annualLeaveCycleMonths": 0,
  "annualLeaveDays": 0
}
```

**响应体**
```json
{
  "id": "string"
}
```

### 员工转正
```http
POST /api/employees/{id}/regularize
```

**路径参数**
- `id`: 员工ID

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "regularSalaryCents": 0
}
```

**响应体**
```json
{
  "id": "string"
}
```

**Section sources**
- [employees.ts](file://backend/src/routes/employees.ts)
- [employee.schema.ts](file://backend/src/schemas/employee.schema.ts)
- [openapi.json](file://backend/openapi.json)

## 请假管理API

请假管理API提供对员工请假记录的增删改查功能。

### 获取请假列表
```http
GET /api/employee-leaves
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `employeeId`: 员工ID
- `status`: 请假状态

**响应体**
```json
[
  {
    "id": "string",
    "employeeId": "string",
    "employeeName": "string",
    "leaveType": "string",
    "startDate": "string",
    "endDate": "string",
    "days": 0,
    "status": "string",
    "reason": "string",
    "memo": "string",
    "approvedBy": "string",
    "approvedAt": 0,
    "createdAt": 0,
    "updatedAt": 0
  }
]
```

### 创建请假
```http
POST /api/employee-leaves
```

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "employeeId": "string",
  "leaveType": "string",
  "startDate": "string",
  "endDate": "string",
  "days": 0,
  "reason": "string",
  "memo": "string"
}
```

**响应体**
```json
{
  "id": "string",
  "employeeId": "string",
  "employeeName": "string",
  "leaveType": "string",
  "startDate": "string",
  "endDate": "string",
  "days": 0,
  "status": "string",
  "reason": "string",
  "memo": "string",
  "approvedBy": "string",
  "approvedAt": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

### 更新请假状态
```http
PUT /api/employee-leaves/{id}/status
```

**路径参数**
- `id`: 请假记录ID

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "status": "pending",
  "memo": "string"
}
```

**响应体**
```json
{
  "success": true
}
```

**Section sources**
- [employee-leaves.ts](file://backend/src/routes/employee-leaves.ts)
- [openapi.json](file://backend/openapi.json)

## 报销管理API

报销管理API提供对员工报销记录的增删改查功能。

### 获取报销列表
```http
GET /api/expense-reimbursements
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `employeeId`: 员工ID
- `status`: 报销状态

**响应体**
```json
[
  {
    "id": "string",
    "employeeId": "string",
    "employeeName": "string",
    "expenseType": "string",
    "amountCents": 0,
    "currencyId": "string",
    "expenseDate": "string",
    "description": "string",
    "voucherUrl": "string",
    "status": "string",
    "approvedBy": "string",
    "approvedAt": 0,
    "memo": "string",
    "createdBy": "string",
    "createdAt": 0,
    "updatedAt": 0
  }
]
```

### 创建报销
```http
POST /api/expense-reimbursements
```

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "employeeId": "string",
  "expenseType": "string",
  "amountCents": 0,
  "currencyId": "string",
  "expenseDate": "string",
  "description": "string",
  "voucherUrl": "string",
  "memo": "string"
}
```

**响应体**
```json
{
  "id": "string",
  "employeeId": "string",
  "employeeName": "string",
  "expenseType": "string",
  "amountCents": 0,
  "currencyId": "string",
  "expenseDate": "string",
  "description": "string",
  "voucherUrl": "string",
  "status": "string",
  "approvedBy": "string",
  "approvedAt": 0,
  "memo": "string",
  "createdBy": "string",
  "createdAt": 0,
  "updatedAt": 0
}
```

### 更新报销状态
```http
PUT /api/expense-reimbursements/{id}/status
```

**路径参数**
- `id`: 报销记录ID

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "status": "pending",
  "memo": "string"
}
```

**响应体**
```json
{
  "success": true
}
```

**Section sources**
- [expense-reimbursements.ts](file://backend/src/routes/expense-reimbursements.ts)
- [openapi.json](file://backend/openapi.json)

## 财务流水API

财务流水API提供对现金流动的管理功能，包括获取流水、创建流水、上传凭证等。

### 获取下一个凭证号
```http
GET /api/flows/next-voucher
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `date`: 日期（YYYY-MM-DD）

**响应体**
```json
{
  "voucherNo": "string"
}
```

### 获取财务流水列表
```http
GET /api/flows
```

**请求头**
- `Authorization: Bearer <token>`

**响应体**
```json
{
  "results": [
    {
      "id": "string",
      "voucherNo": "string",
      "bizDate": "string",
      "type": "income",
      "accountId": "string",
      "categoryId": "string",
      "method": "string",
      "amountCents": 0,
      "siteId": "string",
      "departmentId": "string",
      "counterparty": "string",
      "memo": "string",
      "voucherUrls": [
        "string"
      ],
      "voucherUrl": "string",
      "createdBy": "string",
      "createdAt": 0,
      "accountName": "string",
      "categoryName": "string"
    }
  ]
}
```

### 上传凭证
```http
POST /api/upload/voucher
```

**请求头**
- `Authorization: Bearer <token>`

**请求体** (multipart/form-data)
- `file`: 上传的文件

**响应体**
```json
{
  "url": "string",
  "key": "string"
}
```

**Section sources**
- [flows.ts](file://backend/src/routes/flows.ts)
- [openapi.json](file://backend/openapi.json)

## 应收应付API

应收应付API提供对AR/AP文档和结算的管理功能。

### 获取AR/AP文档列表
```http
GET /api/ar/docs
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `kind`: 文档类型（AR, AP）
- `status`: 文档状态

**响应体**
```json
{
  "results": [
    {
      "id": "string",
      "kind": "AR",
      "docNo": "string",
      "partyId": "string",
      "siteId": "string",
      "departmentId": "string",
      "issueDate": "string",
      "dueDate": "string",
      "amountCents": 0,
      "status": "string",
      "memo": "string",
      "createdAt": 0,
      "settled_cents": 0,
      "siteName": "string"
    }
  ]
}
```

### 创建AR/AP文档
```http
POST /api/ar/docs
```

**请求头**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**
```json
{
  "kind": "AR",
  "amountCents": 0,
  "issueDate": "string",
  "dueDate": "string",
  "partyId": "string",
  "siteId": "string",
  "departmentId": "string",
  "memo": "string",
  "docNo": "string"
}
```

**响应体**
```json
{
  "id": "string",
  "docNo": "string"
}
```

### 获取结算列表
```http
GET /api/ar/settlements
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `docId`: 文档ID

**响应体**
```json
{
  "results": [
    {
      "id": "string",
      "docId": "string",
      "flowId": "string",
      "settle_amountCents": 0,
      "settleDate": "string",
      "createdAt": 0
    }
  ]
}
```

**Section sources**
- [ar-ap.ts](file://backend/src/routes/ar-ap.ts)
- [openapi.json](file://backend/openapi.json)

## 报表API

报表API提供各种财务和人力资源报表的查询功能。

### 获取仪表板统计
```http
GET /api/reports/dashboard/stats
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `department_id`: 部门ID

**响应体**
```json
{
  "today": {
    "income_cents": 0,
    "expense_cents": 0,
    "count": 0
  },
  "month": {
    "income_cents": 0,
    "expense_cents": 0,
    "count": 0
  },
  "accounts": {
    "total": 0
  },
  "ar_ap": {},
  "borrowings": {
    "borrower_count": 0,
    "total_borrowed_cents": 0,
    "total_repaid_cents": 0,
    "balance_cents": 0
  },
  "recent_flows": []
}
```

### 获取部门现金流
```http
GET /api/reports/department-cash
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `start`: 开始日期
- `end`: 结束日期
- `department_ids`: 部门ID列表（逗号分隔）

**响应体**
```json
[
  {}
]
```

### 获取站点增长报告
```http
GET /api/reports/site-growth
```

**请求头**
- `Authorization: Bearer <token>`

**查询参数**
- `start`: 开始日期
- `end`: 结束日期
- `department_id`: 部门ID

**响应体**
```json
{
  "rows": [],
  "prev_range": {
    "start": "string",
    "end": "string"
  }
}
```

**Section sources**
- [reports.ts](file://backend/src/routes/reports.ts)
- [openapi.json](file://backend/openapi.json)

## OpenAPI文档生成

系统使用`export-openapi.ts`脚本自动生成OpenAPI文档。该脚本从Hono应用中提取API定义，并将其导出为标准的OpenAPI JSON格式。

### 生成脚本
```typescript
import app from '../src/index.js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const doc = app.getOpenAPI31Document({
    openapi: '3.0.0',
    info: {
        version: '2.0.0',
        title: 'Caiwu API',
    },
})

const outputPath = resolve(process.cwd(), 'openapi.json')
writeFileSync(outputPath, JSON.stringify(doc, null, 2))
console.log(`OpenAPI spec exported to ${outputPath}`)
```

### 生成步骤
1. 确保后端服务已启动
2. 运行生成脚本：
```bash
node backend/scripts/export-openapi.ts
```
3. 生成的`openapi.json`文件将位于项目根目录

### 自动化集成
可以将文档生成集成到CI/CD流程中，确保API文档始终与代码保持同步。

**Section sources**
- [export-openapi.ts](file://backend/scripts/export-openapi.ts)
- [index.ts](file://backend/src/index.ts)

## 前端调用示例

### 基础API配置（V2）
```typescript
// API配置
const API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : ''

export const API_VERSION = 'v2'
export const api = {
  base: API_BASE,
  auth: {
    login: `${API_BASE}/api/v2/auth/login`,
    me: `${API_BASE}/api/v2/auth/me`,
  },
  employees: `${API_BASE}/api/v2/employees`,
  employeeLeaves: `${API_BASE}/api/v2/employee-leaves`,
  expenseReimbursements: `${API_BASE}/api/v2/expense-reimbursements`,
  flows: `${API_BASE}/api/v2/flows`,
  reports: {
    dashboard: {
      stats: `${API_BASE}/api/v2/reports/dashboard/stats`,
    },
  },
}
```

### 登录示例（V2格式）
```typescript
async function login(email: string, password: string) {
  const response = await fetch(api.auth.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  
  const data = await response.json()
  // V2 响应格式：使用 success 字段
  if (data.success && data.data?.token) {
    const token = data.data.token
    localStorage.setItem('authToken', token)
    return data.data.user
  }
  // 处理错误响应
  throw new Error(data.error?.message || '登录失败')
}
```

### 获取员工列表（V2格式）
```typescript
async function getEmployees(page = 1, pageSize = 20) {
  const token = localStorage.getItem('authToken')
  const response = await fetch(`${api.employees}?page=${page}&pageSize=${pageSize}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  const data = await response.json()
  if (data.success) {
    // V2 分页格式：data.items 和 data.pagination
    return {
      items: data.data.items,
      pagination: data.data.pagination
    }
  }
  throw new Error(data.error?.message || '获取员工列表失败')
}
```

### 创建请假（V2格式）
```typescript
async function createLeave(leaveData: any) {
  const token = localStorage.getItem('authToken')
  const response = await fetch(api.employeeLeaves, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leaveData),
  })
  
  const data = await response.json()
  if (data.success) {
    return data.data // V2 格式：数据在 data 字段中
  }
  throw new Error(data.error?.message || '创建请假失败')
}
```

### 统一错误处理（V2）
```typescript
// 统一的 API 客户端封装
class ApiClient {
  async request(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('authToken')
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (data.success) {
      return data.data
    }
    
    // 统一错误处理
    throw new Error(data.error?.message || '请求失败')
  }
  
  get(url: string) {
    return this.request(url, { method: 'GET' })
  }
  
  post(url: string, body: any) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}
```

**Section sources**
- [api.ts](file://frontend/src/config/api.ts)
- [schema.d.ts](file://frontend/src/types/schema.d.ts)

## 后端接口设计规范

### 命名规范
- 所有API端点使用小写字母和连字符（kebab-case）
- 资源名称使用复数形式
- 路径层次清晰，反映资源关系

### 请求/响应格式（V2）

#### 成功响应格式
```json
{
  "success": true,
  "data": {
    // 实际数据内容
  },
  "message": "可选的成功消息"
}
```

#### 分页响应格式
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

#### 关键变化（V1 → V2）
- ✅ `ok` → `success`：统一使用布尔值 `success` 字段
- ✅ 数据统一放在 `data` 字段中
- ✅ 错误信息统一放在 `error` 对象中，包含 `code` 和 `message`
- ✅ 分页数据使用 `items` + `pagination` 结构

### 认证机制
- 使用JWT进行认证
- 令牌通过`Authorization`头传递
- 令牌包含用户ID、角色和权限信息

### 错误处理
- 使用标准HTTP状态码
- 错误响应包含详细的错误信息
- 记录错误日志用于调试

### 数据验证
- 使用Zod进行请求数据验证
- 验证失败返回400状态码
- 提供详细的验证错误信息

### 安全性
- 所有敏感操作都需要权限验证
- 使用HTTPS传输
- 防止常见的安全漏洞（如XSS、CSRF）

**Section sources**
- [auth.ts](file://backend/src/routes/auth.ts)
- [common.schema.ts](file://backend/src/schemas/common.schema.ts)
- [business.schema.ts](file://backend/src/schemas/business.schema.ts)