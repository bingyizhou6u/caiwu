# 服务层架构文档

> **技术栈**：Hono + Cloudflare Workers  
> **服务目录**：`backend/src/services/`

---

## 📁 服务模块

```
services/
├── assets/          # 资产模块 (8)
│   ├── FixedAssetService.ts
│   ├── FixedAssetChangeService.ts
│   ├── FixedAssetAllocationService.ts
│   ├── RentalPropertyService.ts
│   ├── RentalPaymentService.ts
│   ├── RentalPayableBillService.ts
│   ├── DormitoryAllocationService.ts
│   └── AssetReportService.ts
│
├── auth/            # 认证模块 (2)
│   ├── AuthService.ts
│   └── SessionService.ts
│
├── common/          # 公共模块 (6)
│   ├── AccountService.ts
│   ├── AccountTransferService.ts
│   ├── CashFlowService.ts
│   ├── CategoryService.ts
│   ├── VendorService.ts
│   └── SiteService.ts
│
├── finance/         # 财务模块 (6)
│   ├── ArApDocService.ts
│   ├── SettlementService.ts
│   ├── SiteBillService.ts
│   ├── FinancialReportService.ts
│   ├── BalanceSnapshotService.ts
│   └── OpeningBalanceService.ts
│
├── hr/              # 人事模块 (13)
│   ├── EmployeeService.ts
│   ├── EmployeeSalaryService.ts
│   ├── EmployeeAllowanceService.ts
│   ├── EmployeeLeaveService.ts
│   ├── ExpenseReimbursementService.ts
│   ├── SalaryPaymentService.ts
│   ├── AllowancePaymentService.ts
│   ├── AttendanceService.ts
│   ├── DepartmentService.ts
│   ├── OrgDepartmentService.ts
│   ├── PositionService.ts
│   ├── PermissionService.ts
│   └── HeadquartersService.ts
│
├── reports/         # 报表模块 (4)
│   ├── ReportService.ts
│   ├── DashboardReportService.ts
│   ├── HRReportService.ts
│   └── FinancialReportService.ts
│
└── system/          # 系统模块 (15)
    ├── SystemConfigService.ts
    ├── AuditLogService.ts
    ├── OperationHistoryService.ts
    ├── IPWhitelistService.ts
    ├── TrustedDeviceService.ts
    ├── CurrencyService.ts
    ├── MyService.ts
    └── ...
```

---

## 🏗️ 服务层设计原则

### 1. 单一职责
每个 Service 只负责一个业务领域的 CRUD 和业务逻辑。

### 2. 依赖注入
通过 Hono Context 注入数据库连接 (`c.env.DB`)，避免全局状态。

### 3. 事务边界
复杂业务逻辑在 Service 层统一处理事务。

---

## 📦 服务结构模板

```typescript
export class ExampleService {
  constructor(private db: DrizzleD1Database) {}

  // 查询
  async list(filter?: { status?: string }) { }
  async getById(id: string) { }

  // 增删改
  async create(data: CreateInput) { }
  async update(id: string, data: UpdateInput) { }
  async delete(id: string) { }

  // 业务操作
  async approve(id: string, approvedBy: string) { }
}
```

---

## 🔗 路由与服务对应

| 路由前缀 | 服务 |
|---------|------|
| `/api/v2/auth/*` | AuthService |
| `/api/v2/employees/*` | EmployeeService |
| `/api/v2/flows/*` | CashFlowService |
| `/api/v2/leaves/*` | EmployeeLeaveService |
| `/api/v2/reimbursements/*` | ExpenseReimbursementService |
| `/api/v2/fixed-assets/*` | FixedAssetService |
| `/api/v2/sites/*` | SiteService |
| `/api/v2/reports/*` | ReportService |

---

**最后更新**: 2025-12-27
