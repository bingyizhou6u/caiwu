# 房产管理API

<cite>
**本文引用的文件**
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts)
- [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts)
- [backend/openapi.json](file://backend/openapi.json)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向“房产管理API”的使用者与维护者，系统化梳理租赁房产全生命周期管理能力，包括：
- 房产创建、更新、删除
- 房产信息查询（基础信息、关联部门、支付账户、创建人）
- 房产状态变更记录机制
- 删除约束（存在付款记录则不可删除）
- 列表查询过滤条件（类型、状态、部门）与排序规则
- 财务数据关联（租金支出与现金流、会计分录）

同时给出接口清单、调用流程、错误处理与最佳实践，帮助快速集成与稳定运行。

## 项目结构
后端采用路由层（OpenAPIHono）+ 服务层（RentalService）+ 数据层（Drizzle ORM + SQLite）的分层设计，前端通过类型定义与后端API对接。

```mermaid
graph TB
subgraph "前端"
FE["前端类型定义<br/>frontend/src/types/rental.ts"]
end
subgraph "后端"
RT["路由层<br/>backend/src/routes/rental.ts"]
SVC["服务层<br/>backend/src/services/RentalService.ts"]
DB["数据层Schema<br/>backend/src/db/schema.ts"]
AUD["审计日志工具<br/>backend/src/utils/audit.ts"]
OAS["OpenAPI规范<br/>backend/openapi.json"]
end
FE --> RT
RT --> SVC
SVC --> DB
RT --> AUD
OAS -. 导出 .-> RT
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L677)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L617)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L92)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L1-L143)
- [backend/openapi.json](file://backend/openapi.json#L11227-L11947)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L677)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L617)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L92)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L1-L143)
- [backend/openapi.json](file://backend/openapi.json#L11227-L11947)

## 核心组件
- 路由层（rental.ts）：定义所有房产与付款相关REST接口，包含鉴权、权限校验、请求校验、响应封装与审计日志记录。
- 服务层（RentalService）：实现业务逻辑，包括：
  - 房产列表/详情查询（含部门、账户、币种、创建人等关联信息）
  - 房产增删改
  - 房产状态变更记录（变更表）
  - 付款记录列表/创建/更新/删除（含与现金流、会计分录联动）
  - 宿舍分配/归还
  - 应付账单生成与状态更新
- 数据层（schema.ts）：定义房产、付款、变更、分配、应付账单、审计日志等核心表结构。
- 前端类型（rental.ts）：统一前后端数据契约，便于TS强类型开发。
- 审计工具（audit.ts）：统一记录操作人、实体、行为、详情与IP信息。

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L677)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L617)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L1-L143)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L92)

## 架构总览
```mermaid
sequenceDiagram
participant C as "客户端"
participant R as "路由层<br/>rental.ts"
participant S as "服务层<br/>RentalService"
participant D as "数据库<br/>schema.ts"
participant F as "财务服务<br/>FinanceService(间接使用)"
C->>R : "创建/更新/删除 房产"
R->>R : "鉴权/权限校验"
R->>S : "调用业务方法"
S->>D : "执行SQL插入/更新/删除/查询"
S->>F : "必要时计算余额/生成凭证号"
S-->>R : "返回结果"
R-->>C : "JSON响应"
R->>D : "审计日志记录"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L254-L357)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L200)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L61-L92)

## 详细组件分析

### 房产生命周期管理
- 创建房产
  - 接口：POST /rental-properties
  - 权限：资产-租赁-创建
  - 校验：propertyCode唯一；月租/年租金额按租期类型校验
  - 关联字段：部门、支付账户、币种、状态、合同文件等
  - 审计：记录创建动作与关键字段摘要
- 更新房产
  - 接口：PUT /rental-properties/{id}
  - 权限：资产-租赁-更新
  - 变更记录：当状态、月租、年租、租期类型、起止日期等关键字段发生变更时，写入变更记录表
  - 审计：记录更新动作与变更摘要
- 删除房产
  - 接口：DELETE /rental-properties/{id}
  - 权限：资产-租赁-删除
  - 约束：若存在付款记录，则禁止删除
  - 事务：同时清理变更记录与宿舍分配，再删除房产
  - 审计：记录删除动作与摘要

```mermaid
flowchart TD
Start(["开始"]) --> CheckDel["检查是否存在付款记录"]
CheckDel --> HasPay{"存在付款记录？"}
HasPay --> |是| Block["拒绝删除并返回业务错误"]
HasPay --> |否| Txn["开启事务"]
Txn --> CleanChg["删除变更记录"]
CleanChg --> CleanAlloc["删除宿舍分配"]
CleanAlloc --> DelProp["删除房产"]
DelProp --> Commit["提交事务"]
Commit --> End(["结束"])
Block --> End
```

图表来源
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L190-L204)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L259-L387)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L160-L204)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L581-L612)

### 房产信息查询接口
- 获取房产列表
  - 接口：GET /rental-properties
  - 过滤条件：propertyType、status、departmentId
  - 排序规则：按创建时间倒序
  - 关联信息：部门名称、支付账户名称、币种名称、创建人姓名
- 获取单个房产详情
  - 接口：GET /rental-properties/{id}
  - 返回：基础信息 + 部门/账户/币种/创建人 + 付款历史 + 变更记录 + 宿舍分配（仅宿舍类型）

```mermaid
sequenceDiagram
participant C as "客户端"
participant R as "路由层"
participant S as "服务层"
participant D as "数据库"
C->>R : "GET /rental-properties?propertyType&status&departmentId"
R->>S : "listProperties(query)"
S->>D : "多表连接查询部门/账户/币种/用户"
D-->>S : "结果集"
S-->>R : "{results : [{property, departmentName, paymentAccountName, currencyName, createdByName}]}"
R-->>C : "JSON"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L24-L57)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L15-L41)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L561)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L24-L57)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L15-L41)
- [backend/openapi.json](file://backend/openapi.json#L11227-L11282)

### 房产状态变更记录机制
- 触发条件：当状态、月租、年租、租期类型、起止日期等关键字段被更新时，自动记录一条变更记录
- 记录内容：变更类型、变更日期、起止日期、金额、状态等对比值，以及备注与创建人
- 查询入口：详情接口会返回变更记录数组

```mermaid
flowchart TD
UStart(["更新房产"]) --> CheckFields{"是否涉及关键字段变更？"}
CheckFields --> |否| UEnd(["结束"])
CheckFields --> |是| InsertChg["插入变更记录"]
InsertChg --> UEnd
```

图表来源
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L167-L188)

章节来源
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L167-L188)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L581-L597)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L112-L141)

### 房产删除约束
- 约束条件：若该房产存在付款记录，则不允许删除
- 实现：删除前统计付款数量，大于0则抛出业务错误
- 清理策略：删除事务内级联删除变更记录与宿舍分配，再删除房产

章节来源
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L190-L204)

### 房产列表查询过滤与排序
- 过滤条件
  - propertyType：枚举 office/warehouse/dormitory/other
  - status：字符串
  - departmentId：UUID
- 排序规则：按创建时间倒序

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L24-L57)
- [backend/openapi.json](file://backend/openapi.json#L11227-L11282)

### 房产与财务数据关联
- 付款记录
  - 接口：GET /rental-payments（支持按propertyId/year/month过滤）
  - 关联信息：属性编码/名称/类型、账户名称、分类名称、创建人
  - 创建付款时：
    - 校验账户有效性与币种一致性
    - 生成唯一凭证号（JZYYYYMMDD-NNN）
    - 计算账户余额（基于FinanceService）
    - 写入现金流表与会计分录表
    - 同步更新对应应付账单为已支付
- 应付账单
  - 自动生成：根据租期、周期、到期日生成未付账单
  - 标记已付：通过专用接口将账单标记为已支付

```mermaid
sequenceDiagram
participant C as "客户端"
participant R as "路由层"
participant S as "服务层"
participant D as "数据库"
participant FS as "FinanceService"
C->>R : "POST /rental-payments"
R->>S : "createPayment(data)"
S->>D : "校验账户/币种/重复月份"
S->>FS : "计算余额/生成凭证号"
S->>D : "插入rental_payments"
S->>D : "插入cash_flows"
S->>D : "插入account_transactions"
S->>D : "更新rental_payable_bills为paid"
S-->>R : "{id, flowId, voucherNo}"
R-->>C : "JSON"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L436-L491)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L238-L350)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L563-L631)
- [backend/src/services/FinanceService.ts](file://backend/src/services/FinanceService.ts#L1-L128)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L391-L491)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L208-L350)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L563-L631)
- [backend/src/services/FinanceService.ts](file://backend/src/services/FinanceService.ts#L1-L128)

### 审计日志
- 记录内容：操作人、动作、实体、实体ID、时间、详情、IP与归属地
- 触发点：创建/更新/删除房产、创建/更新/删除付款、生成应付账单、标记账单已付等
- 异步记录：通过waitUntil保证不阻塞主流程

章节来源
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L92)
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L288-L387)
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L482-L567)

## 依赖关系分析
```mermaid
classDiagram
class RentalRoutes {
+listProperties()
+getProperty()
+createProperty()
+updateProperty()
+deleteProperty()
+listPayments()
+createPayment()
+updatePayment()
+deletePayment()
+generatePayableBills()
+listPayableBills()
+markBillPaid()
}
class RentalService {
+listProperties()
+getProperty()
+createProperty()
+updateProperty()
+deleteProperty()
+listPayments()
+createPayment()
+updatePayment()
+deletePayment()
+listAllocations()
+allocateDormitory()
+returnDormitory()
+generatePayableBills()
+listPayableBills()
+markBillPaid()
}
class Schema {
+rentalProperties
+rentalPayments
+rentalChanges
+dormitoryAllocations
+rentalPayableBills
+cashFlows
+accountTransactions
+accounts
+departments
+currencies
+employees
+users
}
RentalRoutes --> RentalService : "调用"
RentalService --> Schema : "读写"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L677)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L617)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L677)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L617)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)

## 性能考量
- 查询优化
  - 房产列表与详情均使用多表左连接，建议在相关列上建立索引（如propertyId、departmentId、year/month等）
  - 分页与排序：按创建时间倒序，避免全表扫描
- 事务与并发
  - 删除房产与创建付款均使用事务，确保一致性
  - 审计日志异步记录，避免阻塞主流程
- 缓存与热点
  - 对高频查询（如部门、币种、账户）可考虑应用层缓存以降低数据库压力

## 故障排查指南
- 403 禁止访问
  - 检查用户岗位与权限位是否具备资产-租赁-创建/更新/删除
- 404 未找到
  - 房产、付款、账单、员工等资源不存在时返回
- 409 业务冲突
  - 房产删除被阻止（存在付款记录）
  - 付款记录重复（同一年/月）
  - 账单已支付
- 422 参数校验失败
  - propertyCode重复、币种不匹配、账户停用、月租/年租参数缺失等
- 审计日志
  - 若审计未记录，请检查IP头与executionCtx.waitUntil可用性

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L259-L387)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L190-L204)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L61-L92)

## 结论
本API围绕“房产”与“付款”两大核心域构建，覆盖了从创建到删除的完整生命周期，并通过变更记录与审计日志保障可追溯性。财务侧通过统一凭证号与余额计算，确保现金流与会计分录的一致性。建议在生产环境完善索引、缓存与监控，持续优化查询与事务性能。

## 附录

### 接口一览（按功能分组）
- 房产管理
  - GET /rental-properties
  - GET /rental-properties/{id}
  - POST /rental-properties
  - PUT /rental-properties/{id}
  - DELETE /rental-properties/{id}
- 付款管理
  - GET /rental-payments
  - POST /rental-payments
  - PUT /rental-payments/{id}
  - DELETE /rental-payments/{id}
- 应付账单
  - POST /rental-properties/generate-payable-bills
  - GET /rental-payable-bills
  - POST /rental-payable-bills/:id/mark-paid

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L24-L677)
- [backend/openapi.json](file://backend/openapi.json#L11227-L11947)

### 数据模型概览
```mermaid
erDiagram
RENTAL_PROPERTIES {
string id PK
string property_code
string name
string property_type
string address
float area_sqm
string rent_type
int monthly_rent_cents
int yearly_rent_cents
string currency
int payment_period_months
string landlord_name
string landlord_contact
string lease_start_date
string lease_end_date
int deposit_cents
string payment_method
string payment_account_id
int payment_day
string department_id
string status
string memo
string contract_file_url
string created_by
int created_at
int updated_at
}
RENTAL_PAYMENTS {
string id PK
string property_id FK
string payment_date
int year
int month
int amount_cents
string currency
string account_id
string category_id
string payment_method
string voucher_url
string memo
string created_by
int created_at
int updated_at
}
RENTAL_CHANGES {
string id PK
string property_id FK
string change_type
string change_date
string from_lease_start
string to_lease_start
string from_lease_end
string to_lease_end
int from_monthly_rent_cents
int to_monthly_rent_cents
string from_status
string to_status
string memo
string created_by
int created_at
}
DORMITORY_ALLOCATIONS {
string id PK
string property_id FK
string employee_id
string room_number
string bed_number
string allocation_date
int monthly_rent_cents
string return_date
string memo
string created_by
int created_at
int updated_at
}
RENTAL_PAYABLE_BILLS {
string id PK
string property_id FK
string bill_date
string due_date
int year
int month
int amount_cents
string currency
int payment_period_months
string status
string paid_date
string paid_payment_id
string memo
string created_by
int created_at
int updated_at
}
CASH_FLOWS {
string id PK
string voucher_no
string biz_date
string type
string account_id
string category_id
string method
int amount_cents
string site_id
string department_id
string counterparty
string memo
string voucher_url
string created_by
int created_at
}
ACCOUNT_TRANSACTIONS {
string id PK
string account_id
string flow_id
string transaction_date
string transaction_type
int amount_cents
int balance_before_cents
int balance_after_cents
int created_at
}
DEPARTMENTS {
string id PK
string name
string code
int active
int created_at
int updated_at
}
ACCOUNTS {
string id PK
string name
string type
string currency
string alias
string account_number
int opening_cents
int active
}
CURRENCIES {
string code PK
string name
string symbol
int active
}
EMPLOYEES {
string id PK
string email
string name
string department_id
int active
int created_at
int updated_at
}
USERS {
string id PK
string email
int active
int created_at
}
RENTAL_PROPERTIES ||--o{ RENTAL_PAYMENTS : "拥有"
RENTAL_PROPERTIES ||--o{ RENTAL_CHANGES : "变更"
RENTAL_PROPERTIES ||--o{ DORMITORY_ALLOCATIONS : "分配"
RENTAL_PROPERTIES ||--o{ RENTAL_PAYABLE_BILLS : "生成"
RENTAL_PAYMENTS ||--|| ACCOUNT_TRANSACTIONS : "产生"
RENTAL_PAYMENTS ||--|| CASH_FLOWS : "产生"
RENTAL_PROPERTIES }o--|| DEPARTMENTS : "所属"
RENTAL_PROPERTIES }o--|| ACCOUNTS : "支付账户"
RENTAL_PROPERTIES }o--|| CURRENCIES : "币种"
RENTAL_PAYMENTS }o--|| ACCOUNTS : "账户"
RENTAL_PAYMENTS }o--|| CATEGORIES : "分类"
RENTAL_PAYMENTS }o--|| EMPLOYEES : "创建人"
USERS ||--o{ EMPLOYEES : "映射"
```

图表来源
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L529-L644)