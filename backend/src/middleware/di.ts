import { Context, Next } from 'hono'
import { createDb } from '../db/index.js'
// System services
import { SystemConfigService } from '../services/system/SystemConfigService.js'
import { MasterDataService } from '../services/system/MasterDataService.js'
import { KVCachedMasterDataService } from '../services/system/KVCachedMasterDataService.js'
import { AuditService } from '../services/system/AuditService.js'
import { OperationHistoryService } from '../services/system/OperationHistoryService.js'
import { IPWhitelistService } from '../services/system/IPWhitelistService.js'
// HR services
import { EmployeeService } from '../services/hr/EmployeeService.js'
import { PositionService } from '../services/hr/PositionService.js'
import { PermissionService } from '../services/hr/PermissionService.js'
import { SalaryService } from '../services/hr/SalaryService.js'
import { SalaryPaymentService } from '../services/hr/SalaryPaymentService.js'
import { SalaryPaymentGenerationService } from '../services/hr/SalaryPaymentGenerationService.js'
import { SalaryPaymentProcessingService } from '../services/hr/SalaryPaymentProcessingService.js'
import { AllowanceService } from '../services/hr/AllowanceService.js'
import { AllowancePaymentService } from '../services/hr/AllowancePaymentService.js'
import { EmployeeLeaveService } from '../services/hr/EmployeeLeaveService.js'
import { ExpenseReimbursementService } from '../services/hr/ExpenseReimbursementService.js'
import { AttendanceService } from '../services/hr/AttendanceService.js'
import { AnnualLeaveService } from '../services/hr/AnnualLeaveService.js'
// Finance services
import { FinanceService } from '../services/finance/FinanceService.js'
import { ImportService } from '../services/finance/ImportService.js'
import { BorrowingService } from '../services/finance/BorrowingService.js'
import { SiteBillService } from '../services/finance/SiteBillService.js'
import { ArApService } from '../services/finance/ArApService.js'
import { AccountTransferService } from '../services/finance/AccountTransferService.js'
// Assets services
import { FixedAssetService } from '../services/assets/FixedAssetService.js'
import { FixedAssetAllocationService } from '../services/assets/FixedAssetAllocationService.js'
import { FixedAssetChangeService } from '../services/assets/FixedAssetChangeService.js'
import { FixedAssetDepreciationService } from '../services/assets/FixedAssetDepreciationService.js'
import { RentalService } from '../services/assets/RentalService.js'
// Reports services
import { ReportService } from '../services/reports/ReportService.js'
// Auth services
import { AuthService } from '../services/auth/AuthService.js'
// Common services
import { ApprovalService } from '../services/common/ApprovalService.js'
import { NotificationService } from '../services/common/NotificationService.js'
import { MyService } from '../services/common/MyService.js'
import { EmailService } from '../services/common/EmailService.js'
import { RateLimitService } from '../services/common/RateLimitService.js'
import type { Env, AppVariables } from '../types.js'

export const di = async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
  const db = createDb(c.env.DB)

  // Initialize services
  const systemConfigService = new SystemConfigService(db)
  const annualLeaveService = new AnnualLeaveService(db)

  const permissionService = new PermissionService(db)
  const emailService = new EmailService(c.env as any)

  const employeeService = new EmployeeService(db, emailService)
  const financeService = new FinanceService(db)
  const siteBillService = new SiteBillService(db)
  const arApService = new ArApService(db, financeService)
  const accountTransferService = new AccountTransferService(db, financeService)
  const importService = new ImportService(db)
  const auditService = new AuditService(db)
  const operationHistoryService = new OperationHistoryService(db)
  const salaryPaymentService = new SalaryPaymentService(db, operationHistoryService)
  const salaryPaymentGenerationService = new SalaryPaymentGenerationService(db)
  const salaryPaymentProcessingService = new SalaryPaymentProcessingService(db, operationHistoryService, salaryPaymentService)
  const reportService = new ReportService(db, annualLeaveService, c.env.SESSIONS_KV)
  const authService = new AuthService(
    db,
    c.env.SESSIONS_KV,
    systemConfigService,
    auditService,
    emailService,
    employeeService
  )
  // 使用 KV 缓存的主数据服务（提升性能）
  // 如需禁用缓存，可切换为: new MasterDataService(db)
  const masterDataService = new KVCachedMasterDataService(db, c.env.SESSIONS_KV)
  const fixedAssetService = new FixedAssetService(db)
  const fixedAssetAllocationService = new FixedAssetAllocationService(db)
  const fixedAssetChangeService = new FixedAssetChangeService(db)
  const fixedAssetDepreciationService = new FixedAssetDepreciationService(db)
  const rentalService = new RentalService(db)
  const notificationService = new NotificationService(db, emailService, systemConfigService)
  const approvalService = new ApprovalService(
    db,
    permissionService,
    employeeService,
    financeService,
    notificationService,
    operationHistoryService
  )
  const borrowingService = new BorrowingService(db)
  const allowancePaymentService = new AllowancePaymentService(db)
  // const auditService = new AuditService(db) // Moved up
  const ipWhitelistService = new IPWhitelistService(c.env)
  const rateLimitService = new RateLimitService(c.env.SESSIONS_KV)
  const positionService = new PositionService(db, c.env.SESSIONS_KV)
  const salaryService = new SalaryService(db)
  const allowanceService = new AllowanceService(db)

  const employeeLeaveService = new EmployeeLeaveService(db)
  const expenseReimbursementService = new ExpenseReimbursementService(db)
  const attendanceService = new AttendanceService(db)

  const myService = new MyService(
    db,
    employeeLeaveService,
    expenseReimbursementService,
    attendanceService,
    financeService,
    allowancePaymentService,
    fixedAssetService,
    fixedAssetAllocationService,
    employeeService,
    annualLeaveService,
    salaryService,
    borrowingService
  )

  // Inject into context
  c.set('db', db)
  c.set('services', {
    systemConfig: systemConfigService,
    finance: financeService,
    employee: employeeService,
    import: importService,
    salaryPayment: salaryPaymentService,
    salaryPaymentGeneration: salaryPaymentGenerationService,
    salaryPaymentProcessing: salaryPaymentProcessingService,
    report: reportService,
    auth: authService,
    masterData: masterDataService,
    fixedAsset: fixedAssetService,
    fixedAssetAllocation: fixedAssetAllocationService,
    fixedAssetChange: fixedAssetChangeService,
    fixedAssetDepreciation: fixedAssetDepreciationService,
    rental: rentalService,
    approval: approvalService,
    my: myService,
    audit: auditService,
    ipWhitelist: ipWhitelistService,
    position: positionService,
    salary: salaryService,
    allowance: allowanceService,
    allowancePayment: allowancePaymentService,
    employeeLeave: employeeLeaveService,
    expenseReimbursement: expenseReimbursementService,
    attendance: attendanceService,
    annualLeave: annualLeaveService,
    permission: permissionService,
    email: emailService,
    borrowing: borrowingService,
    arAp: arApService,
    accountTransfer: accountTransferService,
    siteBill: siteBillService,
    rateLimit: rateLimitService,
    operationHistory: operationHistoryService,
  })

  await next()
}
