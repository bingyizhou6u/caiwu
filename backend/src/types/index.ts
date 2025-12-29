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
  CF_ACCESS_TOKEN?: string // Access Policy 同步 Token
  CF_ACCESS_APP_ID?: string // Access Application ID
  CF_ACCESS_AUD?: string // Access Application Audience Tag
  CF_ACCESS_TEAM_DOMAIN?: string // Access Team Domain (e.g. ar-teams.cloudflareaccess.com)
  AUTH_JWT_SECRET: string
  INIT_ADMIN_PASSWORD_HASH: string // 初始化管理员密码哈希（必需，用于数据库初始化）
}

export type AppVariables = {
  requestId: string
  apiVersion?: string // API 版本（v1/v2/v3）
  employeeId?: string
  sessionId?: string
  cfAccessEmail?: string // Cloudflare Access 验证的邮箱
  cfAccessSub?: string // Cloudflare Access 用户 ID
  userPosition?: {
    id: string
    code: string
    name: string
    canManageSubordinates: number
    dataScope?: string
    permissions: Record<string, Record<string, string[]>>
  }
  userEmployee?: {
    id: string
    orgDepartmentId: string | null
    projectId: string | null
  }
  departmentModules?: string[] // 部门允许的功能模块列表

  // Dependency Injection
  db: DrizzleD1Database<typeof schema>
  services: {
    systemConfig: SystemConfigService
    finance: FinanceService
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
    siteBill: SiteBillService
    arAp: ArApService
    accountTransfer: AccountTransferService
    rateLimit: RateLimitService
    salaryPaymentGeneration: SalaryPaymentGenerationService
    salaryPaymentProcessing: SalaryPaymentProcessingService
    operationHistory: OperationHistoryService
    fixedAssetAllocation: FixedAssetAllocationService
    fixedAssetChange: FixedAssetChangeService
    fixedAssetDepreciation: FixedAssetDepreciationService
    // PM services
    project: ProjectService
    task: TaskService
    taskTimelog: TaskTimelogService
    // System services
    orgDepartment: OrgDepartmentService
  }
}

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { SystemConfigService } from '../services/system/SystemConfigService.js'
import { FinanceService } from '../services/finance/FinanceService.js'
import { EmployeeService } from '../services/hr/EmployeeService.js'
import { ImportService } from '../services/finance/ImportService.js'
import { SalaryPaymentService } from '../services/hr/SalaryPaymentService.js'
import { SalaryPaymentGenerationService } from '../services/hr/SalaryPaymentGenerationService.js'
import { SalaryPaymentProcessingService } from '../services/hr/SalaryPaymentProcessingService.js'
import { ReportService } from '../services/reports/ReportService.js'
import { OperationHistoryService } from '../services/system/OperationHistoryService.js'
import { AuthService } from '../services/auth/AuthService.js'
import { MasterDataService } from '../services/system/MasterDataService.js'
import { FixedAssetService } from '../services/assets/FixedAssetService.js'
import { FixedAssetAllocationService } from '../services/assets/FixedAssetAllocationService.js'
import { FixedAssetChangeService } from '../services/assets/FixedAssetChangeService.js'
import { FixedAssetDepreciationService } from '../services/assets/FixedAssetDepreciationService.js'
import { RentalService } from '../services/assets/RentalService.js'
import type { MyService } from '../services/common/MyService.js'
import type { ApprovalService } from '../services/common/ApprovalService.js'
import type { AuditService } from '../services/system/AuditService.js'
import type { IPWhitelistService } from '../services/system/IPWhitelistService.js'
import type { PositionService } from '../services/hr/PositionService.js'
import type { SalaryService } from '../services/hr/SalaryService.js'
import type { AllowanceService } from '../services/hr/AllowanceService.js'
import type { AllowancePaymentService } from '../services/hr/AllowancePaymentService.js'
import type { EmployeeLeaveService } from '../services/hr/EmployeeLeaveService.js'
import type { ExpenseReimbursementService } from '../services/hr/ExpenseReimbursementService.js'
import type { AttendanceService } from '../services/hr/AttendanceService.js'
import { AnnualLeaveService } from '../services/hr/AnnualLeaveService.js'
import { PermissionService } from '../services/hr/PermissionService.js'
import { EmailService } from '../services/common/EmailService.js'
import { SiteBillService } from '../services/finance/SiteBillService.js'
import { ArApService } from '../services/finance/ArApService.js'
import { AccountTransferService } from '../services/finance/AccountTransferService.js'
import { RateLimitService } from '../services/common/RateLimitService.js'
// PM services
import { ProjectService } from '../services/pm/ProjectService.js'
import { TaskService } from '../services/pm/TaskService.js'
import { TaskTimelogService } from '../services/pm/TaskTimelogService.js'
// System services
import { OrgDepartmentService } from '../services/system/OrgDepartmentService.js'

// 已移除固定超级管理员
// 所有管理员权限现在基于员工记录的职位
