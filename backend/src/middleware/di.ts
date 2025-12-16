import { Context, Next } from 'hono'
import { createDb } from '../db/index.js'
import { SystemConfigService } from '../services/SystemConfigService.js'
import { EmployeeService } from '../services/EmployeeService.js'
import { UserService } from '../services/UserService.js'
import { FinanceService } from '../services/FinanceService.js'
import { ImportService } from '../services/ImportService.js'
import { SalaryPaymentService } from '../services/SalaryPaymentService.js'
import { SalaryPaymentGenerationService } from '../services/SalaryPaymentGenerationService.js'
import { SalaryPaymentProcessingService } from '../services/SalaryPaymentProcessingService.js'
import { ReportService } from '../services/ReportService.js'
import { AuthService } from '../services/AuthService.js'
import { MasterDataService } from '../services/MasterDataService.js'
import { FixedAssetService } from '../services/FixedAssetService.js'
import { FixedAssetAllocationService } from '../services/FixedAssetAllocationService.js'
import { FixedAssetChangeService } from '../services/FixedAssetChangeService.js'
import { FixedAssetDepreciationService } from '../services/FixedAssetDepreciationService.js'
import { FixedAssetAllocationService } from '../services/FixedAssetAllocationService.js'
import { FixedAssetChangeService } from '../services/FixedAssetChangeService.js'
import { FixedAssetDepreciationService } from '../services/FixedAssetDepreciationService.js'
import { RentalService } from '../services/RentalService.js'
import { ApprovalService } from '../services/ApprovalService.js'
import { NotificationService } from '../services/NotificationService.js'
import { OperationHistoryService } from '../services/OperationHistoryService.js'
import { MyService } from '../services/MyService.js'
import { AuditService } from '../services/AuditService.js'
import { IPWhitelistService } from '../services/IPWhitelistService.js'
import { PositionService } from '../services/PositionService.js'
import { SalaryService } from '../services/SalaryService.js'
import { AllowanceService } from '../services/AllowanceService.js'
import { AllowancePaymentService } from '../services/AllowancePaymentService.js'
import { EmployeeLeaveService } from '../services/EmployeeLeaveService.js'
import { ExpenseReimbursementService } from '../services/ExpenseReimbursementService.js'
import { AttendanceService } from '../services/AttendanceService.js'
import { AnnualLeaveService } from '../services/AnnualLeaveService.js'
import { PermissionService } from '../services/PermissionService.js'
import { EmailService } from '../services/EmailService.js'
import { BorrowingService } from '../services/BorrowingService.js'
import { SiteBillService } from '../services/SiteBillService.js'
import { ArApService } from '../services/ArApService.js'
import { AccountTransferService } from '../services/AccountTransferService.js'
import { RateLimitService } from '../services/RateLimitService.js'
import type { Env, AppVariables } from '../types.js'

export const di = async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
  const db = createDb(c.env.DB)

  // Initialize services
  const systemConfigService = new SystemConfigService(db)
  const annualLeaveService = new AnnualLeaveService(db)

  const permissionService = new PermissionService(db)
  const emailService = new EmailService(c.env as any)

  const userService = new UserService(db) // Updated to use Drizzle db
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
    emailService
  ) // Updated
  const masterDataService = new MasterDataService(db) // Updated to use Drizzle db
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
    user: userService,
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
