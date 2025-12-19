# 财务操作API

<cite>
**本文档引用的文件**   
- [flows.ts](file://backend/src/routes/v2/flows.ts)
- [account-transfers.ts](file://backend/src/routes/v2/account-transfers.ts)
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts)
- [borrowings.ts](file://backend/src/routes/v2/borrowings.ts)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts)
- [ArApService.ts](file://backend/src/services/ArApService.ts)
- [BorrowingService.ts](file://backend/src/services/BorrowingService.ts)
- [AccountTransferService.ts](file://backend/src/services/AccountTransferService.ts)
- [optimistic-lock.ts](file://backend/src/utils/optimistic-lock.ts)
- [state-machine.ts](file://backend/src/utils/state-machine.ts)
- [amount-validator.ts](file://backend/src/utils/amount-validator.ts)
- [schema.ts](file://backend/src/db/schema.ts)
- [business.schema.ts](file://backend/src/schemas/business.schema.ts)
</cite>

## 目录
1. [简介](#简介)
2. [财务流水管理](#财务流水管理)
3. [账户转账管理](#账户转账管理)
4. [应收应付管理](#应收应付管理)
5. [借款管理](#借款管理)
6. [核心机制](#核心机制)
7. [错误处理策略](#错误处理策略)

## 简介
本API文档详细说明了财务操作相关的核心接口，包括财务流水、账户转账、应收应付和借款管理。系统通过严格的权限控制、数据验证和并发控制机制，确保财务数据的一致性和安全性。所有财务交易均通过凭证号（voucherNo）进行唯一标识，并支持红冲（冲正）操作以纠正错误记录。

**Section sources**
- [flows.ts](file://backend/src/routes/v2/flows.ts#L1-L566)
- [account-transfers.ts](file://backend/src/routes/v2/account-transfers.ts#L1-L235)
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts#L1-L626)
- [borrowings.ts](file://backend/src/routes/v2/borrowings.ts#L1-L379)

## 财务流水管理
财务流水（flows）API用于记录企业的所有现金流入和流出。每条流水记录都包含业务日期、交易类型、金额、关联账户和凭证等关键信息。

### 创建财务流水
创建财务流水的API端点为`POST /flows`。请求体必须包含账户ID、业务日期、交易类型（income/expense）、金额（以分为单位）和凭证URL。系统会自动生成唯一的凭证号。

```mermaid
flowchart TD
A[客户端发起创建请求] --> B{权限验证}
B --> |通过| C[生成凭证号]
C --> D[获取账户余额]
D --> E{余额检查}
E --> |支出且余额不足| F[返回余额不足错误]
E --> |检查通过| G[创建流水记录]
G --> H[创建账户交易记录]
H --> I[返回成功响应]
```

**Diagram sources**
- [flows.ts](file://backend/src/routes/v2/flows.ts#L327-L426)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L70-L229)

### 流水红冲流程
红冲（reverse）操作用于冲正错误的财务流水。该操作会创建一条金额相等但方向相反的新流水，并标记原始流水为已冲正状态。

```mermaid
stateDiagram-v2
[*] --> 原始流水
原始流水 --> 红冲记录 : 红冲操作
红冲记录 --> 原始流水 : 标记已冲正
状态检查 --> |已被冲正| 拒绝操作
状态检查 --> |是红冲记录| 拒绝操作
```

**Diagram sources**
- [flows.ts](file://backend/src/routes/v2/flows.ts#L494-L565)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L285-L437)

**Section sources**
- [flows.ts](file://backend/src/routes/v2/flows.ts#L494-L565)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L285-L437)

## 账户转账管理
账户转账（account-transfers）API用于处理不同账户之间的资金转移。转账操作会同时在转出账户和转入账户生成相应的交易记录。

### 转账创建流程
创建账户转账的API端点为`POST /account-transfers`。系统会验证转出和转入账户，并计算各自的余额变化。

```mermaid
sequenceDiagram
participant Client
participant API
participant Service
participant DB
Client->>API : POST /account-transfers
API->>Service : 调用create方法
Service->>DB : 查询转出账户余额
DB-->>Service : 返回余额
Service->>DB : 创建转账记录
Service->>DB : 创建转出账户交易
Service->>DB : 创建转入账户交易
DB-->>Service : 返回结果
Service-->>API : 返回成功
API-->>Client : 返回转账ID
```

**Diagram sources**
- [account-transfers.ts](file://backend/src/routes/v2/account-transfers.ts#L119-L184)
- [AccountTransferService.ts](file://backend/src/services/AccountTransferService.ts#L44-L124)

**Section sources**
- [account-transfers.ts](file://backend/src/routes/v2/account-transfers.ts#L119-L184)
- [AccountTransferService.ts](file://backend/src/services/AccountTransferService.ts#L44-L124)

## 应收应付管理
应收应付（AR/AP）管理API用于处理企业的应收账款和应付账款。系统通过单据（doc）和结算（settlement）两个核心概念来管理账款。

### AR/AP单据状态机
AR/AP单据的状态转换遵循严格的规则，确保账款处理的正确性。

```mermaid
stateDiagram-v2
[*] --> open
open --> partially_settled : 部分结算
open --> settled : 完全结算
partially_settled --> settled : 完成剩余结算
settled --> confirmed : 确认
confirmed --> [*]
```

**Diagram sources**
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts#L163-L220)
- [ArApService.ts](file://backend/src/services/ArApService.ts#L84-L118)

### 确认流程
确认AR/AP单据会触发财务流水的创建和账款的结算。

```mermaid
sequenceDiagram
participant Client
participant API
participant ArApService
participant FinanceService
Client->>API : POST /ar/confirm
API->>ArApService : 调用confirm方法
ArApService->>FinanceService : createCashFlow
FinanceService-->>ArApService : 返回流水ID
ArApService->>ArApService : 更新单据状态
ArApService->>ArApService : 创建结算记录
ArApService-->>API : 返回结果
API-->>Client : 返回流水ID和凭证号
```

**Diagram sources**
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts#L372-L437)
- [ArApService.ts](file://backend/src/services/ArApService.ts#L178-L243)

**Section sources**
- [ar-ap.ts](file://backend/src/routes/v2/ar-ap.ts#L372-L437)
- [ArApService.ts](file://backend/src/services/ArApService.ts#L178-L243)

## 借款管理
借款管理API用于处理员工的借款和还款。系统通过借款（borrowing）和还款（repayment）两个核心实体来管理借款生命周期。

### 借款状态机
借款记录的状态转换遵循预定义的流程。

```mermaid
stateDiagram-v2
[*] --> pending
pending --> approved : 审批通过
pending --> rejected : 审批拒绝
approved --> outstanding : 创建借款
outstanding --> partial : 部分还款
outstanding --> repaid : 完全还款
partial --> repaid : 完成剩余还款
repaid --> [*]
rejected --> [*]
```

**Diagram sources**
- [state-machine.ts](file://backend/src/utils/state-machine.ts#L56-L67)
- [borrowings.ts](file://backend/src/routes/v2/borrowings.ts#L148-L209)

### 借款与还款流程
借款和还款操作通过独立的API端点进行管理。

```mermaid
flowchart TD
A[创建借款] --> B[借款状态: outstanding]
B --> C[创建还款]
C --> D{还款金额}
D --> |等于借款总额| E[借款状态: repaid]
D --> |小于借款总额| F[借款状态: partial]
F --> G[创建更多还款]
G --> E
```

**Diagram sources**
- [borrowings.ts](file://backend/src/routes/v2/borrowings.ts#L148-L209)
- [BorrowingService.ts](file://backend/src/services/BorrowingService.ts#L109-L136)

**Section sources**
- [borrowings.ts](file://backend/src/routes/v2/borrowings.ts#L148-L209)
- [BorrowingService.ts](file://backend/src/services/BorrowingService.ts#L109-L136)

## 核心机制
本节详细说明财务操作中的关键机制，包括金额验证、账户余额检查、乐观锁控制等。

### 交易金额验证
系统通过`amount-validator.ts`文件中的工具函数对交易金额进行严格验证。

```mermaid
flowchart TD
A[接收金额参数] --> B{是否为整数}
B --> |否| C[抛出验证错误]
B --> |是| D{金额是否小于最小值}
D --> |是| E[抛出验证错误]
D --> |否| F{金额是否大于最大值}
F --> |是| G[抛出验证错误]
F --> |否| H[验证通过]
```

**Diagram sources**
- [amount-validator.ts](file://backend/src/utils/amount-validator.ts#L11-L39)
- [business.schema.ts](file://backend/src/schemas/business.schema.ts#L19-L20)

### 账户余额检查
在创建财务流水时，系统会检查账户余额以确保不会出现负余额。

```mermaid
flowchart TD
A[获取交易类型] --> B{是否为支出}
B --> |否| C[无需余额检查]
B --> |是| D[计算交易后余额]
D --> E{余额是否足够}
E --> |否| F[抛出余额不足错误]
E --> |是| G[继续创建流水]
```

**Diagram sources**
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L173-L186)
- [schema.ts](file://backend/src/db/schema.ts#L146-L147)

### 乐观锁控制
系统使用乐观锁机制防止并发修改导致的数据冲突。

```mermaid
classDiagram
class OptimisticLock {
+validateVersion(currentVersion, expectedVersion)
+incrementVersion(version)
}
class Account {
-version : number
}
class FinanceService {
-createCashFlow()
-reverseFlow()
}
OptimisticLock --> Account : 检查版本
FinanceService --> OptimisticLock : 调用验证
```

**Diagram sources**
- [optimistic-lock.ts](file://backend/src/utils/optimistic-lock.ts#L16-L39)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L146-L165)

**Section sources**
- [optimistic-lock.ts](file://backend/src/utils/optimistic-lock.ts#L16-L39)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L146-L165)

## 错误处理策略
系统采用分层的错误处理策略，确保财务操作的可靠性和数据一致性。

### 错误分类
财务操作中的错误主要分为以下几类：

| 错误类型 | HTTP状态码 | 错误码 | 说明 |
|---------|----------|-------|------|
| 验证错误 | 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 权限错误 | 403 | FORBIDDEN | 用户无权执行操作 |
| 业务错误 | 400 | BUSINESS_ERROR | 业务逻辑错误 |
| 并发冲突 | 409 | BUS_CONCURRENT_MODIFICATION | 数据被其他用户修改 |

**Section sources**
- [errors.ts](file://backend/src/utils/errors.js)
- [errorCodes.ts](file://backend/src/constants/errorCodes.ts)

### 幂等性保证
所有创建操作都通过事务和唯一约束来保证幂等性。系统通过以下方式实现：

1. 使用UUID作为记录ID，确保全局唯一
2. 在关键表上设置唯一索引（如凭证号）
3. 使用数据库事务确保操作的原子性
4. 对于重复请求，返回已存在的记录而非创建新记录

```mermaid
flowchart TD
A[收到创建请求] --> B{检查唯一约束}
B --> |已存在| C[返回现有记录]
B --> |不存在| D[创建新记录]
D --> E[提交事务]
E --> F[返回成功]
```

**Section sources**
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L88-L229)
- [ArApService.ts](file://backend/src/services/ArApService.ts#L95-L117)

## 结论
本财务操作API系统通过严谨的设计和实现，提供了完整的财务交易管理功能。系统采用乐观锁、事务控制和状态机等机制，确保了财务数据的一致性和安全性。所有操作都经过严格的权限验证和数据校验，有效防止了非法操作和数据错误。通过清晰的API设计和详细的错误处理，系统为财务人员提供了可靠的操作界面。