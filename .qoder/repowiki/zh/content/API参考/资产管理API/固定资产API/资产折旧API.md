# 资产折旧API

<cite>
**本文档引用的文件**   
- [fixed-assets.ts](file://backend/src/routes/fixed-assets.ts)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts)
- [business.schema.ts](file://backend/src/schemas/business.schema.ts)
- [schema.ts](file://backend/src/db/schema.ts)
- [errors.ts](file://backend/src/utils/errors.ts)
- [FixedAssetsManagement.tsx](file://frontend/src/features/assets/pages/FixedAssetsManagement.tsx)
- [useFixedAssets.ts](file://frontend/src/hooks/business/useFixedAssets.ts)
</cite>

## 目录
1. [简介](#简介)
2. [资产折旧端点](#资产折旧端点)
3. [折旧数据验证](#折旧数据验证)
4. [折旧业务逻辑](#折旧业务逻辑)
5. [折旧计算示例](#折旧计算示例)
6. [错误处理](#错误处理)
7. [前端交互流程](#前端交互流程)

## 简介
资产折旧API是财务管理系统中的核心功能之一，用于处理固定资产的折旧操作。该API允许用户为特定资产创建折旧记录，系统会自动计算累计折旧和剩余价值，并在事务中同步更新相关数据。本文档详细说明了通过/{id}/depreciation端点创建折旧记录的流程，包括数据验证规则、业务逻辑实现、计算示例以及错误处理机制。

**Section sources**
- [fixed-assets.ts](file://backend/src/routes/fixed-assets.ts#L413-L458)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L325-L369)

## 资产折旧端点
资产折旧API通过POST请求访问/{id}/depreciation端点来创建折旧记录。该端点需要提供资产ID作为路径参数，并在请求体中包含折旧日期和折旧金额等信息。系统会验证输入数据的合法性，确保折旧金额不超过资产原值，并在事务中完成所有相关数据的更新。

```mermaid
sequenceDiagram
participant 前端 as 前端应用
participant API as 资产折旧API
participant 服务 as FixedAssetService
participant 数据库 as 数据库
前端->>API : POST /fixed-assets/{id}/depreciation
API->>API : 验证用户权限
API->>服务 : 调用createDepreciation方法
服务->>数据库 : 查询资产信息
数据库-->>服务 : 返回资产数据
服务->>数据库 : 查询现有折旧总额
数据库-->>服务 : 返回折旧总额
服务->>服务 : 计算新累计折旧和剩余价值
服务->>服务 : 验证剩余价值是否非负
服务->>数据库 : 开始事务
数据库->>数据库 : 插入折旧明细记录
数据库->>数据库 : 更新资产当前价值
数据库->>服务 : 提交事务
服务-->>API : 返回折旧记录ID
API-->>前端 : 返回成功响应
```

**Diagram sources **
- [fixed-assets.ts](file://backend/src/routes/fixed-assets.ts#L413-L458)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L325-L369)

**Section sources**
- [fixed-assets.ts](file://backend/src/routes/fixed-assets.ts#L413-L458)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L325-L369)

## 折旧数据验证
系统通过Zod Schema对折旧数据进行严格验证，确保数据的完整性和正确性。`createDepreciationSchema`定义了折旧记录所需的所有字段及其验证规则。

```mermaid
classDiagram
class createDepreciationSchema {
+string assetId
+string depreciationDate
+number amountCents
+string memo
}
createDepreciationSchema : amountCents必须大于0
createDepreciationSchema : depreciationDate必须为有效日期格式
createDepreciationSchema : assetId必须为有效UUID
```

**Diagram sources **
- [business.schema.ts](file://backend/src/schemas/business.schema.ts#L302-L308)

**Section sources**
- [business.schema.ts](file://backend/src/schemas/business.schema.ts#L302-L308)

### 折旧金额验证
折旧金额(amountCents)的验证规则如下：
- 必须为正整数
- 必须大于0
- 以分为单位存储，避免浮点数精度问题

### 折旧日期验证
折旧日期(depreciationDate)的验证规则如下：
- 必须为有效的日期格式(YYYY-MM-DD)
- 不能为空
- 必须是过去或当前日期

## 折旧业务逻辑
`FixedAssetService.createDepreciation`方法实现了核心的折旧业务逻辑，包括累计折旧计算、剩余价值计算、数据验证和事务处理。

```mermaid
flowchart TD
A[开始] --> B[查询资产信息]
B --> C[查询现有折旧总额]
C --> D[计算新累计折旧]
D --> E[计算剩余价值]
E --> F{剩余价值 >= 0?}
F --> |是| G[开始事务]
F --> |否| H[抛出业务错误]
G --> I[插入折旧明细记录]
I --> J[更新资产当前价值]
J --> K[提交事务]
K --> L[返回成功]
H --> M[返回错误]
```

**Diagram sources **
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L325-L369)

**Section sources**
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L325-L369)

### 累计折旧和剩余价值计算
系统通过以下公式计算累计折旧和剩余价值：
- **累计折旧** = 现有累计折旧总额 + 本次折旧金额
- **剩余价值** = 资产购买价格 - 累计折旧

### 数据同步更新
系统在数据库事务中同步更新两个关键数据：
1. 在`fixed_asset_depreciations`表中插入新的折旧明细记录
2. 更新`fixed_assets`表中资产的`currentValueCents`字段

### 事务处理
所有数据库操作都在事务中执行，确保数据的一致性。如果任何一步操作失败，整个事务将回滚，避免数据不一致的情况。

## 折旧计算示例
以下是一个按月直线法折旧的计算示例：

```mermaid
flowchart LR
A[资产原值: 120000分] --> B[月折旧额: 10000分]
B --> C[第1月折旧后]
C --> D[累计折旧: 10000分]
D --> E[剩余价值: 110000分]
E --> F[第2月折旧后]
F --> G[累计折旧: 20000分]
G --> H[剩余价值: 100000分]
```

**Diagram sources **
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L340-L341)

**Section sources**
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L340-L341)

### 计算过程
假设某资产购买价格为1200元(120000分)，预计使用年限为1年(12个月)，采用直线法折旧：
- 月折旧额 = 120000 ÷ 12 = 10000分
- 第1个月折旧后：累计折旧10000分，剩余价值110000分
- 第2个月折旧后：累计折旧20000分，剩余价值100000分
- 以此类推，直到第12个月折旧完成后，剩余价值为0

## 错误处理
系统对折旧操作中的各种异常情况进行了完善的错误处理，确保数据的完整性和系统的稳定性。

```mermaid
flowchart TD
A[开始折旧操作] --> B[验证输入数据]
B --> C{数据有效?}
C --> |否| D[返回验证错误]
C --> |是| E[计算剩余价值]
E --> F{剩余价值 >= 0?}
F --> |否| G[返回业务错误]
F --> |是| H[执行数据库操作]
H --> I{操作成功?}
I --> |否| J[返回服务器错误]
I --> |是| K[返回成功]
```

**Diagram sources **
- [errors.ts](file://backend/src/utils/errors.ts#L48-L49)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L343-L344)

**Section sources**
- [errors.ts](file://backend/src/utils/errors.ts#L48-L49)
- [FixedAssetService.ts](file://backend/src/services/FixedAssetService.ts#L343-L344)

### 超额折旧错误
当折旧金额超过资产购买价格时，系统会返回特定的业务错误：
- **错误代码**: BUSINESS_ERROR
- **错误消息**: '折旧金额超过购买价格'
- **HTTP状态码**: 400

此错误确保了资产的剩余价值不会变为负数，维护了财务数据的准确性。

## 前端交互流程
前端应用通过一系列组件和钩子与资产折旧API进行交互，为用户提供友好的操作界面。

```mermaid
sequenceDiagram
participant 用户 as 用户
participant 界面 as 前端界面
participant 钩子 as useFixedAssets钩子
participant API as 资产折旧API
用户->>界面 : 点击"折旧"按钮
界面->>界面 : 显示折旧表单
用户->>界面 : 填写折旧日期和金额
界面->>钩子 : 调用useDepreciateFixedAsset
钩子->>API : 发送POST请求
API-->>钩子 : 返回响应
钩子-->>界面 : 更新状态
界面-->>用户 : 显示成功或错误消息
```

**Diagram sources **
- [FixedAssetsManagement.tsx](file://frontend/src/features/assets/pages/FixedAssetsManagement.tsx#L505-L518)
- [useFixedAssets.ts](file://frontend/src/hooks/business/useFixedAssets.ts#L118-L128)

**Section sources**
- [FixedAssetsManagement.tsx](file://frontend/src/features/assets/pages/FixedAssetsManagement.tsx#L505-L518)
- [useFixedAssets.ts](file://frontend/src/hooks/business/useFixedAssets.ts#L118-L128)

### 前端组件
前端主要包含以下组件：
- **折旧模态框**: 用于收集折旧信息的表单
- **折旧表单**: 包含折旧日期和金额输入字段
- **状态管理**: 使用React Query管理API调用状态

### 数据流
前端数据流遵循以下流程：
1. 用户在界面触发折旧操作
2. 前端组件收集用户输入
3. 通过useDepreciateFixedAsset钩子调用API
4. 处理API响应并更新UI状态
5. 显示操作结果给用户