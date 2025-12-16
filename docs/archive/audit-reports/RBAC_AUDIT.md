# RBAC Compliance Audit Report

## 1. Overview
Audit of `backend/src/routes/*.ts` to verify:
1.  **Functional Permission**: Is `hasPermission` or `protectRoute` used?
2.  **Data Scope**: Is `getDataAccessFilter` used for list/search endpoints?

## 2. Route Analysis

| Route File | Endpoint | Permission Check | Data Scope Check | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `employees.ts` | `GET /employees` | ✅ Manual | ❌ **MISSING / AD-HOC** | 🔴 **CRITICAL** | Level 3 (Team Leader) logic is empty comment. Level 2 uses manual `filters.departmentId`. |
| `employees.ts` | `POST /employees` | ✅ Manual | N/A | 🟡 Partial | - |
| `flows.ts` | `GET /flows` | ✅ Manual (`getUserPosition`) | ⚠️ **AD-HOC SQL** | 🟠 **WARNING** | Uses raw SQL `financeService.listCashFlows` which is hard to maintain. |
| `fixed-assets.ts` | All | ✅ `protectRoute` | ❓ Need to check Service | 🟢 **GOOD** | Uses middleware correctly. |
| `ar-ap.ts` | `GET /ar-ap-docs` | ✅ Manual | ✅ `getDataAccessFilter` | 🟢 **GOOD** | Correctly uses standard utility. |
| `borrowings.ts` | `GET /borrowings` | ✅ Manual | ✅ `getDataAccessFilter` | 🟢 **GOOD** | Correctly uses standard utility. |
| `approvals.ts` | `GET /approvals/pending` | ✅ Service-Level | ✅ `getPendingApprovals(userId)` | 🟢 **GOOD** | Logic seems tailored to user inside service. |
| `reports.ts` | `GET /dashboard/stats` | ✅ Manual | ❌ **MISSING** | 🔴 **CRITICAL** | `reportService.getDashboardStats(department_id)` accepts any ID from query. No check if user owns that dept. |
| `reports.ts` | `GET /department-cash` | ✅ Manual | ❌ **MISSING** | 🔴 **CRITICAL** | User can query ANY department(s) cash flow. |

## 3. Detailed Failures

### `employees.ts` - `GET /employees`
```typescript
// lines 46-49
} else if (position.level === 3) {
  if (isTeamMember(c)) {
    // Limited visibility for team members <- CODE IS MISSING
  }
}
```
**Impact**: Team Leaders currently see **ALL** employees (if the filter is empty) or **NO** employees (depending on how `getAll` behaves with empty filters), or raw SQL injection risk if not handled. The logic is simply not there.

### `flows.ts` - `GET /flows`
```typescript
// lines 133-146
let whereClause = sql`1=1`
if (position.level === 2) {
   whereClause = sql`cash_flows.department_id = ${employee.department_id}`
} // ...
```
**Impact**: While functionally safe, this duplicates the logic in `getDataAccessFilter` and requires manual maintenance. If `getDataAccessFilter` updates (e.g. new level 4 logic), this file will rot.

### `reports.ts` - **Systemic Failure**
Almost all report endpoints accept `department_id` or `org_department_id` as query parameters but **do not validate** if the caller has rights to see that department's data.
Example: `GET /dashboard/stats?department_id=HQ_DEPT_ID` by a Project Manager would likely succeed if they have `report.finance.view` permission, leaking HQ data.

## 4. Service Layer Audit (Data Scope)

Even if routes pass filters, does the Service apply them?

*   `EmployeeService.getAll(filters)` -> Needs to check if it respects the filters passed from Route.
*   `FinanceService.listCashFlows(whereClause)` -> Accepts raw SQL, which is flexible but dangerous if Route constructs it wrong.

## 5. Next Steps
1.  **Fix `employees.ts`**: Implement `getDataAccessFilter` locally or use the utility if compatible.
2.  **Refactor `flows.ts`**: Try to switch to `getDataAccessFilter` if `cash_flows` table schema allows (needs `department_id` mapping).
3.  **Secure `reports.ts`**: Add a mandatory lookup to verify `department_id` in query is within user's scope using `getDataAccessFilter` or manual checks.

