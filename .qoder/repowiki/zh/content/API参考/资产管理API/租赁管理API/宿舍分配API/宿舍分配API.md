# 宿舍分配API

<cite>
**本文引用的文件**
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts)
- [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts)
- [backend/src/schemas/common.schema.ts](file://backend/src/schemas/common.schema.ts)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts)
- [backend/src/middleware/di.ts](file://backend/src/middleware/di.ts)
- [backend/src/utils/permissions.ts](file://backend/src/utils/permissions.ts)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts)
- [backend/src/index.ts](file://backend/src/index.ts)
- [frontend/src/features/assets/pages/RentalManagement.tsx](file://frontend/src/features/assets/pages/RentalManagement.tsx)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向“宿舍分配API”的使用与维护，覆盖员工宿舍的分配与归还流程，以及分配记录查询能力。内容包含：
- 员工宿舍分配接口：员工验证、宿舍类型检查、重复分配校验
- 宿舍归还接口：业务逻辑与状态管理
- 分配记录查询接口：支持按房产、员工、归还状态过滤，并关联员工与部门信息
- 前端集成要点与数据模型映射

## 项目结构
后端采用分层设计：
- 路由层：定义REST接口、请求/响应模式与权限控制
- 服务层：封装业务逻辑与数据库操作
- 数据层：Drizzle ORM表结构定义
- 中间件：依赖注入、权限与审计日志
- 前端：页面组件与类型定义

```mermaid
graph TB
subgraph "前端"
FE_Rental["RentalManagement.tsx"]
FE_Types["types/rental.ts"]
end
subgraph "后端"
R["routes/rental.ts"]
S["services/RentalService.ts"]
D["db/schema.ts"]
M["middleware/di.ts"]
P["utils/permissions.ts"]
A["utils/audit.ts"]
I["index.ts"]
end
FE_Rental --> |"调用"| R
FE_Types --> |"类型约束"| R
R --> |"依赖注入"| M
R --> |"权限校验"| P
R --> |"审计日志"| A
R --> |"调用服务"| S
S --> |"数据库操作"| D
I --> |"注册路由"| R
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L120)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L644)
- [backend/src/middleware/di.ts](file://backend/src/middleware/di.ts#L39-L62)
- [backend/src/utils/permissions.ts](file://backend/src/utils/permissions.ts#L1-L120)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L120)
- [backend/src/index.ts](file://backend/src/index.ts#L100-L120)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L120)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L644)
- [backend/src/middleware/di.ts](file://backend/src/middleware/di.ts#L39-L62)
- [backend/src/index.ts](file://backend/src/index.ts#L100-L120)

## 核心组件
- 路由层（routes/rental.ts）
  - 提供宿舍分配、归还与分配记录查询接口
  - 使用OpenAPI路由定义与Zod校验
  - 权限校验与审计日志记录
- 服务层（services/RentalService.ts）
  - 实现宿舍分配与归还的核心业务逻辑
  - 查询分配记录并关联员工与部门信息
  - 校验宿舍类型、员工有效性与重复分配
- 数据层（db/schema.ts）
  - 定义宿舍分配表与相关联的属性字段
- 前端（RentalManagement.tsx、types/rental.ts）
  - 页面组件与类型定义，支撑分配弹窗与列表展示

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L61-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L367-L486)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)
- [frontend/src/features/assets/pages/RentalManagement.tsx](file://frontend/src/features/assets/pages/RentalManagement.tsx#L960-L998)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L53-L110)

## 架构总览
后端通过路由层接收请求，经权限与校验后交由服务层执行业务逻辑，服务层基于Drizzle ORM访问数据库，最终返回结果并记录审计日志。

```mermaid
sequenceDiagram
participant C as "客户端"
participant R as "路由层(租住)"
participant P as "权限工具"
participant S as "服务层(租住)"
participant DB as "数据库(宿舍分配表)"
participant A as "审计日志"
C->>R : "POST /api/rental-properties/{id}/allocate-dormitory"
R->>P : "校验用户职位/权限"
P-->>R : "通过/拒绝"
R->>S : "allocateDormitory(参数)"
S->>DB : "校验宿舍类型/员工状态/重复分配"
DB-->>S : "校验结果"
S->>DB : "插入分配记录"
DB-->>S : "返回新ID"
S-->>R : "返回分配ID"
R->>A : "记录审计动作"
R-->>C : "{id}"
C->>R : "POST /api/rental-properties/allocations/{id}/return"
R->>P : "校验权限"
P-->>R : "通过/拒绝"
R->>S : "returnDormitory(id, {returnDate})"
S->>DB : "更新returnDate"
DB-->>S : "完成"
S-->>R : "ok : true"
R->>A : "记录审计动作"
R-->>C : "{ok : true}"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L135-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L431-L486)
- [backend/src/utils/permissions.ts](file://backend/src/utils/permissions.ts#L1-L120)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L120)

## 详细组件分析

### 接口一：员工宿舍分配
- 接口路径与方法
  - POST /api/rental-properties/{id}/allocate-dormitory
- 请求体参数
  - employeeId：员工UUID
  - allocationDate：分配日期（YYYY-MM-DD）
  - roomNumber：房间号（可空）
  - bedNumber：床位号（可空）
  - monthlyRentCents：员工需支付的月租金（可空，非负整数）
  - memo：备注（可空）
- 返回
  - { id }：分配记录ID
- 权限与前置校验
  - 用户职位存在性校验
  - 拥有资产-租赁-更新权限
- 业务逻辑
  - 校验宿舍类型为“dormitory”
  - 校验员工存在且处于启用状态
  - 校验同一宿舍未存在未归还的分配记录
  - 插入分配记录并记录创建人
- 审计日志
  - 记录动作类型“allocate”、实体“dormitory”，携带属性ID与员工ID

```mermaid
flowchart TD
Start(["开始"]) --> CheckPos["校验用户职位/登录态"]
CheckPos --> CheckPerm["校验资产-租赁-更新权限"]
CheckPerm --> LoadProp["加载宿舍属性"]
LoadProp --> TypeCheck{"是否为宿舍(dormitory)?"}
TypeCheck --> |否| ErrType["错误：非宿舍类型"]
TypeCheck --> |是| LoadEmp["加载员工信息"]
LoadEmp --> EmpActive{"员工是否启用?"}
EmpActive --> |否| ErrEmp["错误：员工已停用"]
EmpActive --> |是| CheckDup["查询是否存在未归还的同宿舍分配"]
CheckDup --> DupFound{"是否已存在未归还分配?"}
DupFound --> |是| ErrDup["错误：重复分配"]
DupFound --> |否| Insert["插入分配记录"]
Insert --> Done(["返回分配ID"])
ErrType --> End(["结束"])
ErrEmp --> End
ErrDup --> End
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L135-L159)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L431-L474)
- [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts#L608-L615)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L135-L159)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L431-L474)
- [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts#L608-L615)

### 接口二：员工宿舍归还
- 接口路径与方法
  - POST /api/rental-properties/allocations/{id}/return
- 请求体参数
  - returnDate：归还日期（YYYY-MM-DD）
  - memo：备注（可空）
- 返回
  - { ok: true }
- 权限与前置校验
  - 用户职位存在性校验
  - 拥有资产-租赁-更新权限
- 业务逻辑
  - 校验分配记录存在
  - 校验未归还状态（避免重复归还）
  - 更新returnDate与memo
- 审计日志
  - 记录动作类型“return”、实体“dormitory_allocation”

```mermaid
flowchart TD
Start(["开始"]) --> CheckPos["校验用户职位/登录态"]
CheckPos --> CheckPerm["校验资产-租赁-更新权限"]
CheckPerm --> LoadAlloc["加载分配记录"]
LoadAlloc --> Exists{"记录是否存在?"}
Exists --> |否| ErrNotFound["错误：分配记录不存在"]
Exists --> |是| IsReturned{"是否已归还?"}
IsReturned --> |是| ErrReturned["错误：已归还"]
IsReturned --> |否| Update["更新returnDate与memo"]
Update --> Done(["返回{ok:true}"])
ErrNotFound --> End(["结束"])
ErrReturned --> End
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L161-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L476-L486)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L161-L200)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L476-L486)

### 接口三：宿舍分配记录查询
- 接口路径与方法
  - GET /api/rental-properties/allocations
- 查询参数
  - propertyId：宿舍ID（可选）
  - employeeId：员工ID（可选）
  - returned：是否已归还（可选，true/false）
- 返回
  - results：数组，每项包含
    - allocation：分配记录对象
    - propertyCode/propertyName：宿舍编码与名称
    - employeeName：员工姓名
    - employeeDepartmentId/employeeDepartmentName：员工所在部门ID与名称
    - createdByName：创建人姓名
- 关联查询
  - 左连接宿舍属性、员工、部门与创建人用户信息
- 状态过滤
  - returned=true：仅返回已归还记录
  - returned=false：仅返回未归还记录
  - returned缺失：不限制归还状态

```mermaid
sequenceDiagram
participant C as "客户端"
participant R as "路由层(租住)"
participant S as "服务层(租住)"
participant DB as "数据库(宿舍分配/属性/员工/部门)"
C->>R : "GET /api/rental-properties/allocations?propertyId&employeeId&returned"
R->>S : "listAllocations(查询条件)"
S->>DB : "多表左连接查询(分配/属性/员工/部门/创建人)"
DB-->>S : "查询结果集"
S-->>R : "结果集"
R-->>C : "{results : [...]}"
Note over R,DB : "returned参数转换为SQL条件<br/>true -> returnDate IS NOT NULL<br/>false -> returnDate IS NULL"
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L61-L107)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L369-L429)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L61-L107)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L369-L429)

### 数据模型与字段
- 宿舍分配表（dormitoryAllocations）
  - 字段：id、propertyId、employeeId、roomNumber、bedNumber、allocationDate、monthlyRentCents、returnDate、memo、createdBy、createdAt、updatedAt
- 关键字段说明
  - propertyId：宿舍属性ID（外键）
  - employeeId：员工ID（外键）
  - allocationDate：分配日期
  - returnDate：归还日期（未归还时为空）
  - monthlyRentCents：员工需支付的月租金（可空）

```mermaid
erDiagram
DORMITORY_ALLOCATIONS {
text id PK
text propertyId
text employeeId
text roomNumber
text bedNumber
text allocationDate
integer monthlyRentCents
text returnDate
text memo
text createdBy
integer createdAt
integer updatedAt
}
RENTAL_PROPERTIES {
text id PK
text propertyCode
text name
text propertyType
}
EMPLOYEES {
text id PK
text name
integer active
text departmentId
}
DEPARTMENTS {
text id PK
text name
}
DORMITORY_ALLOCATIONS }o--|| RENTAL_PROPERTIES : "propertyId"
DORMITORY_ALLOCATIONS }o--|| EMPLOYEES : "employeeId"
EMPLOYEES }o--|| DEPARTMENTS : "departmentId"
```

图表来源
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)

章节来源
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)

### 前端集成要点
- 页面组件
  - 分配弹窗包含员工选择、房间号、床位号、分配日期、员工需支付月租金、备注等字段
- 类型定义
  - DormitoryAllocation：分配记录结构，包含员工姓名、部门名称、分配/归还时间等

章节来源
- [frontend/src/features/assets/pages/RentalManagement.tsx](file://frontend/src/features/assets/pages/RentalManagement.tsx#L960-L998)
- [frontend/src/types/rental.ts](file://frontend/src/types/rental.ts#L53-L110)

## 依赖关系分析
- 路由依赖
  - 权限工具：用于校验用户职位与资产-租赁-更新权限
  - 审计工具：记录分配与归还动作
  - 依赖注入：将RentalService注入到路由上下文
- 服务层依赖
  - Drizzle ORM：数据库查询与事务
  - 错误工具：统一错误码与消息
- 数据层依赖
  - 宿舍分配表与相关联的属性、员工、部门表

```mermaid
graph LR
Routes["routes/rental.ts"] --> DI["middleware/di.ts"]
Routes --> Perm["utils/permissions.ts"]
Routes --> Audit["utils/audit.ts"]
Routes --> Service["services/RentalService.ts"]
Service --> DB["db/schema.ts"]
Index["index.ts"] --> Routes
```

图表来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L20)
- [backend/src/middleware/di.ts](file://backend/src/middleware/di.ts#L39-L62)
- [backend/src/utils/permissions.ts](file://backend/src/utils/permissions.ts#L1-L120)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L120)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L20)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)
- [backend/src/index.ts](file://backend/src/index.ts#L100-L120)

章节来源
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L1-L20)
- [backend/src/middleware/di.ts](file://backend/src/middleware/di.ts#L39-L62)
- [backend/src/utils/permissions.ts](file://backend/src/utils/permissions.ts#L1-L120)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L120)
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L1-L20)
- [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)
- [backend/src/index.ts](file://backend/src/index.ts#L100-L120)

## 性能考虑
- 查询优化
  - 分配记录查询使用多表左连接，建议在相关列上建立索引（如propertyId、employeeId、returnDate）
- 并发与事务
  - 分配与归还均为单条记录写入，事务开销较小
- 前端渲染
  - 列表分页与筛选参数应合理设置，避免一次性拉取过多数据

[本节为通用指导，无需列出具体文件来源]

## 故障排查指南
- 常见错误与定位
  - “物业不存在”：propertyId无效或被删除
  - “该物业不是宿舍”：propertyType非dormitory
  - “员工不存在”：employeeId无效
  - “员工已停用”：员工active=0
  - “员工已分配到该宿舍”：同一宿舍存在未归还分配
  - “分配记录不存在”：归还时传入的分配ID无效
  - “已归还”：重复归还
- 审计日志
  - 分配与归还均会记录审计日志，便于追踪操作人与对象
- 建议排查步骤
  - 确认请求参数格式（UUID、日期格式）
  - 检查权限与职位校验是否通过
  - 查看服务层抛出的具体错误类型与消息
  - 核对数据库中宿舍属性与员工状态

章节来源
- [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L431-L486)
- [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L135-L200)
- [backend/src/utils/audit.ts](file://backend/src/utils/audit.ts#L1-L120)

## 结论
本API围绕“宿舍分配与归还”提供清晰的接口边界与严格的业务校验，结合分配记录查询与员工/部门关联，满足日常管理需求。通过权限与审计机制保障操作安全与可追溯性。建议在生产环境完善索引与分页策略，持续监控错误日志以提升稳定性。

[本节为总结性内容，无需列出具体文件来源]

## 附录

### 接口一览与参数说明
- POST /api/rental-properties/{id}/allocate-dormitory
  - 路由定义与权限校验：参见 [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L135-L159)
  - 业务逻辑：参见 [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L431-L474)
  - 请求体Schema：参见 [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts#L608-L615)
- POST /api/rental-properties/allocations/{id}/return
  - 路由定义与权限校验：参见 [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L161-L200)
  - 业务逻辑：参见 [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L476-L486)
  - 请求体Schema：参见 [backend/src/schemas/business.schema.ts](file://backend/src/schemas/business.schema.ts#L1012-L1015)
- GET /api/rental-properties/allocations
  - 路由定义与查询参数：参见 [backend/src/routes/rental.ts](file://backend/src/routes/rental.ts#L61-L107)
  - 业务逻辑与关联查询：参见 [backend/src/services/RentalService.ts](file://backend/src/services/RentalService.ts#L369-L429)

### 数据模型字段参考
- 宿舍分配表字段：参见 [backend/src/db/schema.ts](file://backend/src/db/schema.ts#L590-L612)