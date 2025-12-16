# 服务层重组计划

## 服务分类

### HR模块 (`services/hr/`)
- EmployeeService.ts
- EmployeeLeaveService.ts
- AnnualLeaveService.ts
- AttendanceService.ts
- SalaryService.ts
- SalaryPaymentService.ts
- SalaryPaymentGenerationService.ts
- SalaryPaymentProcessingService.ts
- AllowanceService.ts
- AllowancePaymentService.ts
- ExpenseReimbursementService.ts
- PositionService.ts
- PermissionService.ts

### Finance模块 (`services/finance/`)
- FinanceService.ts
- AccountService.ts
- AccountTransferService.ts
- ArApService.ts
- BorrowingService.ts
- SiteBillService.ts
- ImportService.ts

### Assets模块 (`services/assets/`)
- FixedAssetService.ts
- FixedAssetAllocationService.ts
- FixedAssetChangeService.ts
- FixedAssetDepreciationService.ts
- RentalService.ts
- RentalPropertyService.ts
- RentalPaymentService.ts
- DormitoryAllocationService.ts

### Reports模块 (`services/reports/`)
- ReportService.ts
- BusinessReportService.ts
- FinancialReportService.ts
- DashboardReportService.ts

### System模块 (`services/system/`)
- SystemService.ts
- SystemConfigService.ts
- MasterDataService.ts
- CategoryService.ts
- CurrencyService.ts
- VendorService.ts
- DepartmentService.ts
- OrgDepartmentService.ts
- ProjectDepartmentService.ts
- HeadquartersService.ts
- SiteService.ts
- IPWhitelistService.ts
- AuditService.ts
- OperationHistoryService.ts

### Auth模块 (`services/auth/`)
- AuthService.ts
- TrustedDeviceService.ts

### Common模块 (`services/common/`)
- EmailService.ts
- EmailRoutingService.ts
- NotificationService.ts
- ApprovalService.ts
- MyService.ts
- RateLimitService.ts

## 迁移步骤

1. 移动文件到对应目录
2. 更新导入路径（在middleware/di.ts和routes文件中）
3. 创建index.ts导出文件（可选，方便导入）
4. 验证所有导入路径正确
