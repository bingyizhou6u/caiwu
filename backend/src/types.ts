export type Env = {
  DB: D1Database
  SESSIONS_KV: KVNamespace
  VOUCHERS: R2Bucket
  // 通过 Service Binding 访问的专用邮件 Worker
  EMAIL_SERVICE?: Fetcher
  EMAIL_TOKEN?: string
  // 邮件发送配置（可选，如果配置了Resend API Key）
  RESEND_API_KEY?: string
  // Cloudflare 服务专用 API Tokens
  CF_IP_LISTS_TOKEN?: string // IP Lists 管理 (Account Rule Lists Write)
  CF_EMAIL_TOKEN?: string // Email Routing (Account + Zone 权限)
  CF_FIREWALL_TOKEN?: string // Firewall Rules (Zone Firewall Services Write)
  CF_ACCOUNT_ID?: string // Cloudflare Account ID
  CF_ZONE_ID?: string // Zone ID（创建自定义规则需要）
  CF_IP_LIST_ID?: string // IP List ID（如果已创建，可指定）
  AUTH_JWT_SECRET: string
}

export type AppVariables = {
  requestId: string
  apiVersion?: string // API 版本（v1/v2/v3）
  userId?: string
  sessionId?: string
  userPosition?: {
    id: string
    code: string
    name: string
    level: number
    canManageSubordinates: number
    permissions: Record<string, Record<string, string[]>>
  }
  userEmployee?: {
    id: string
    orgDepartmentId: string | null
    departmentId: string | null
  }
  departmentModules?: string[] // 部门允许的功能模块列表

  // Dependency Injection
  db: DrizzleD1Database<typeof schema>
  services: {
    systemConfig: SystemConfigService
    finance: FinanceService
    user: UserService
    employee: EmployeeService
    import: ImportService
    salaryPayment: SalaryPaymentService
    report: ReportService
    auth: AuthService
    masterData: MasterDataService
    fixedAsset: FixedAssetService
    rental: RentalService
    approval: ApprovalService
    my: MyService
    audit: AuditService
    ipWhitelist: IPWhitelistService
    position: PositionService
    salary: SalaryService
    allowance: AllowanceService
    allowancePayment: AllowancePaymentService
    employeeLeave: EmployeeLeaveService
    expenseReimbursement: ExpenseReimbursementService
    attendance: AttendanceService
    annualLeave: AnnualLeaveService
    permission: PermissionService
    email: EmailService
    borrowing: BorrowingService
    siteBill: SiteBillService
    arAp: ArApService
    accountTransfer: AccountTransferService
    rateLimit: RateLimitService
  }
}

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './db/schema.js'
import { SystemConfigService } from './services/system/SystemConfigService.js'
import { FinanceService } from './services/finance/FinanceService.js'
import { UserService } from './services/UserService.js'
import { EmployeeService } from './services/hr/EmployeeService.js'
import { ImportService } from './services/finance/ImportService.js'
import { SalaryPaymentService } from './services/hr/SalaryPaymentService.js'
import { ReportService } from './services/reports/ReportService.js'
import { AuthService } from './services/auth/AuthService.js'
import { MasterDataService } from './services/system/MasterDataService.js'
import { FixedAssetService } from './services/assets/FixedAssetService.js'
import { RentalService } from './services/assets/RentalService.js'
import type { MyService } from './services/common/MyService.js'
import type { ApprovalService } from './services/common/ApprovalService.js'
import type { AuditService } from './services/system/AuditService.js'
import type { IPWhitelistService } from './services/system/IPWhitelistService.js'
import type { PositionService } from './services/hr/PositionService.js'
import type { SalaryService } from './services/hr/SalaryService.js'
import type { AllowanceService } from './services/hr/AllowanceService.js'
import type { AllowancePaymentService } from './services/hr/AllowancePaymentService.js'
import type { EmployeeLeaveService } from './services/hr/EmployeeLeaveService.js'
import type { ExpenseReimbursementService } from './services/hr/ExpenseReimbursementService.js'
import type { AttendanceService } from './services/hr/AttendanceService.js'
import { AnnualLeaveService } from './services/hr/AnnualLeaveService.js'
import { PermissionService } from './services/PermissionService.js'
import { EmailService } from './services/EmailService.js'
import { BorrowingService } from './services/BorrowingService.js'
import { SiteBillService } from './services/SiteBillService.js'
import { ArApService } from './services/ArApService.js'
import { AccountTransferService } from './services/AccountTransferService.js'
import { RateLimitService } from './services/RateLimitService.js'

// 已移除固定超级管理员
// 所有管理员权限现在基于员工记录的职位
