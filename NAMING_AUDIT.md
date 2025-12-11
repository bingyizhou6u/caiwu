# Naming Convention Audit

## 1. Goal
Standardize all API request/response parameters to **camelCase**.
DB schema remains `snake_case`.

## 2. Violations Found

### A. `reports.ts` (Major)
*   **Query**: `department_id`, `org_department_id` -> Should be `departmentId`, `orgDepartmentId`.
*   **Context**: All report endpoints (`/dashboard/stats`, `/salary/report`, etc.)

### B. `account-transfers.ts` (Mixed)
*   **Query**: `from_accountId`, `to_accountId` -> Should be `fromAccountId`, `toAccountId`.
*   **Response**: 
    *   `from_accountId` -> `fromAccountId`
    *   `to_accountId` -> `toAccountId`
    *   `from_amountCents` -> `fromAmountCents`
    *   `to_amountCents` -> `toAmountCents`
    *   `from_accountName` -> `fromAccountName`
    *   `from_account_currency` -> `fromAccountCurrency`
    *   `to_account_currency` -> `toAccountCurrency`
    *   `to_accountName` -> `toAccountName`

### C. `my.ts` (Inconsistent)
*   **Input**: `emergency_contact`, `emergency_phone` -> Should be `emergencyContact`, `emergencyPhone`.
*   **Response**: `emergency_contact`, `emergency_phone` in some profile endpoints.

### D. `business.schema.ts` (Definition Source)
Some schemas here might define `snake_case` fields which propagate to the above routes.
*   Example: `expense_reimbursement` schema likely has `expense_type` vs `expenseType` mix (checked: mostly camelCase, but needs verifying the few snake_case hits).

## 3. Repair Plan

### Phase 1: Fix `reports.ts` (High Priority - Security & Consistency)
1.  Rename `department_id` to `departmentId` in `request.query` schema.
2.  Rename `org_department_id` to `orgDepartmentId` in `request.query` schema.
3.  Update `ReportService` to accept camelCase args.
4.  **Crucial**: Add Data Scope validation while fixing names.

### Phase 2: Fix `account-transfers.ts`
1.  Update `accountTransferResponseSchema` and `listAccountTransfersResponseSchema`.
2.  Update Route logic mapping variables.
3.  Update `from_accountId` query param in OpenAPI definition.

### Phase 3: Fix `my.ts`
1.  Standardize profile update & get endpoints to use `emergencyContact` / `emergencyPhone`.

## 4. Frontend Impact
*   Frontend calls to these APIs **MUST** be updated simultaneously.
*   `frontend/src/services/ReportService.ts`
*   `frontend/src/features/finance/pages/TransferList.tsx`
*   `frontend/src/features/profile/pages/MyProfile.tsx`

This audit confirms that `reports.ts` is not the only offender; `account-transfers.ts` is also heavily mixed.
