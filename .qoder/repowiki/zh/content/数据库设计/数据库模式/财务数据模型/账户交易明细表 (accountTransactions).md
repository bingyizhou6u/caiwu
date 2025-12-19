# 账户交易明细表 (accountTransactions)

<cite>
**本文档引用的文件**
- [schema.ts](file://backend/src/db/schema.ts)
- [schema.sql](file://backend/src/db/schema.sql)
- [AccountService.ts](file://backend/src/services/AccountService.ts)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts)
- [AccountTransferService.ts](file://backend/src/services/AccountTransferService.ts)
- [AccountTransactionsPage.tsx](file://frontend/src/features/finance/pages/AccountTransactionsPage.tsx)
</cite>

## 目录
1. [简介](#简介)
2. [核心字段详解](#核心字段详解)
3. [余额计算机制](#余额计算机制)
4. [与cash_flows表的关系](#与cash_flows表的关系)
5. [索引与查询性能](#索引与查询性能)
6. [数据流与业务逻辑](#数据流与业务逻辑)
7. [前端应用](#前端应用)

## 简介

账户交易明细表（`accountTransactions`）是财务系统中的核心物化视图，用于精确追踪每个账户的余额变动历史。该表通过记录每一笔交易发生前后的账户余额，实现了对账户状态的可追溯性。它并非简单的流水记录，而是作为`accounts`表的补充，承担了实时余额计算和审计追踪的关键角色。每当发生一笔现金流动（`cash_flows`）或账户转账（`account_transfers`）时，系统都会在`accountTransactions`表中创建一条或多条记录，以确保所有余额变动都有据可查。

**Section sources**
- [schema.ts](file://backend/src/db/schema.ts#L189-L206)
- [schema.sql](file://backend/src/db/schema.sql#L205-L216)

## 核心字段详解

`accountTransactions`表的每个字段都设计用于支持精确的财务核算。

- **`accountId`**: 外键，关联`accounts`表，标识该交易属于哪个账户。
- **`flowId`**: 外键，关联`cash_flows`表或`account_transfers`表，标识该交易是由哪一笔业务流水触发的。这建立了交易明细与原始业务单据之间的直接联系。
- **`transactionDate`**: 记录交易发生的业务日期。该日期可能与系统创建时间（`createdAt`）不同，允许用户按实际业务发生日期进行记账。
- **`balanceBeforeCents`**: 记录在本次交易发生前，该账户的余额（单位：分）。这是实现余额可追溯性的关键字段。
- **`balanceAfterCents`**: 记录在本次交易发生后，该账户的余额（单位：分）。通过`balanceBeforeCents`和`balanceAfterCents`，可以清晰地看到每一笔交易对账户余额的影响。
- **`amountCents`**: 本次交易的金额（单位：分）。对于收入，该值为正；对于支出，该值为负。
- **`transactionType`**: 交易类型，如`income`（收入）、`expense`（支出）、`transfer_in`（转入）、`transfer_out`（转出）等，用于对交易进行分类。
- **`createdAt`**: 记录在系统中创建该交易明细的时间戳，用于保证记录的顺序性和并发控制。

**Section sources**
- [schema.ts](file://backend/src/db/schema.ts#L194-L202)
- [schema.sql](file://backend/src/db/schema.sql#L208-L215)

## 余额计算机制

`accountTransactions`表的核心功能是支持实时、精确的余额查询。系统不直接在`accounts`表中存储当前余额，而是通过查询`accountTransactions`表来动态计算。

余额计算的逻辑如下：
1.  **获取初始余额**：如果账户没有任何交易记录，则使用`accounts`表中的`openingCents`（期初余额）作为基准。
2.  **查找历史记录**：根据指定的查询时间点（日期和时间戳），查找在该时间点之前的所有交易记录。
3.  **确定余额**：将查询到的最后一条交易记录的`balanceAfterCents`作为该时间点的账户余额。

例如，在`FinanceService.ts`中，`getAccountBalanceBefore`方法通过以下SQL逻辑实现：
```sql
SELECT * FROM account_transactions 
WHERE account_id = ? 
  AND (transaction_date < ? OR (transaction_date = ? AND created_at < ?))
ORDER BY transaction_date DESC, created_at DESC 
LIMIT 1;
```
如果找到记录，则返回其`balanceAfterCents`；否则返回`accounts`表的`openingCents`。

**Section sources**
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L41-L68)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L108-L114)

## 与cash_flows表的关系

`accountTransactions`表与`cash_flows`表之间存在紧密的一对一或一对多关系，具体取决于业务场景。

- **一对一关系**：对于一笔普通的收入或支出流水（`cash_flows`），系统会创建一条对应的`accountTransactions`记录，记录该笔流水对账户余额的影响。
- **一对多关系**：对于一笔账户转账（`account_transfers`），由于涉及两个账户（转出和转入），系统会创建两条`accountTransactions`记录。这两条记录的`flowId`都指向同一个`account_transfers`记录的ID，但`accountId`、`transactionType`和余额字段则分别记录了两个账户的变动情况。

这种设计确保了所有资金流动，无论来源如何，都能在`accountTransactions`表中找到对应的余额变动记录，从而保证了余额计算的完整性和一致性。

**Section sources**
- [AccountTransferService.ts](file://backend/src/services/AccountTransferService.ts#L86-L121)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L214-L226)

## 索引与查询性能

为了支持高效的按账户和日期范围查询，`accountTransactions`表定义了专门的复合索引。

- **`idxAccountDate`**: 该索引基于`accountId`和`transactionDate`两个字段创建。它极大地优化了以下查询：
    - 查询某个账户在特定日期范围内的所有交易明细。
    - 按账户分组，获取最新的交易记录以计算当前余额。

该索引的存在使得前端的“账户明细查询”页面能够快速响应，即使在数据量庞大的情况下也能提供流畅的用户体验。

**Section sources**
- [schema.ts](file://backend/src/db/schema.ts#L203-L205)
- [schema.sql](file://backend/src/db/schema.sql#L217)

## 数据流与业务逻辑

当一笔新的现金流动或转账被创建时，系统会通过事务处理来确保数据的一致性：

1.  **创建业务记录**：首先在`cash_flows`或`account_transfers`表中插入业务单据。
2.  **计算余额**：调用`getAccountBalanceBefore`方法，根据`transactionDate`和`createdAt`计算出交易前的余额。
3.  **插入交易明细**：根据计算出的余额和交易金额，生成`balanceAfterCents`，并将完整的交易明细插入`accountTransactions`表。
4.  **并发控制**：在`FinanceService`中，通过乐观锁（`accounts`表的`version`字段）来防止并发修改导致的余额计算错误。

这个流程确保了每一笔余额变动都是原子性的，并且有完整的审计线索。

**Section sources**
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L146-L155)
- [FinanceService.ts](file://backend/src/services/FinanceService.ts#L212-L226)

## 前端应用

在前端，`AccountTransactionsPage.tsx`页面通过调用后端API来展示账户的交易明细。该页面利用`accountTransactions`表提供的丰富信息，向用户展示：
- 交易日期 (`transactionDate`)
- 交易类型 (`transactionType`)
- 交易前余额 (`balanceBeforeCents`)
- 交易金额 (`amountCents`)
- 交易后余额 (`balanceAfterCents`)

这种展示方式让用户能够清晰地看到账户余额的每一次变化，满足了财务审计和日常查询的需求。

**Section sources**
- [AccountTransactionsPage.tsx](file://frontend/src/features/finance/pages/AccountTransactionsPage.tsx#L49-L88)
- [useAccountTransactions.ts](file://frontend/src/hooks/business/useAccountTransactions.ts#L7-L23)