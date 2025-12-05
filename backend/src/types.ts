export type Env = {
  DB: D1Database
  SESSIONS_KV: KVNamespace
  VOUCHERS: R2Bucket
  // Cloudflare Email Workers 邮件发送
  EMAIL?: SendEmail
  // 邮件发送配置（可选，如果配置了Resend API Key）
  RESEND_API_KEY?: string
  // Cloudflare IP 白名单配置（使用 IP Lists）
  CF_API_TOKEN?: string // Cloudflare API Token（优先使用）
  CF_GLOBAL_API_KEY?: string // Cloudflare Global API Key（备选）
  CF_AUTH_EMAIL?: string // Cloudflare 账户邮箱（配合 Global API Key 使用）
  CF_ACCOUNT_ID?: string // Cloudflare Account ID
  CF_ZONE_ID?: string // Zone ID（创建自定义规则需要）
  CF_IP_LIST_ID?: string // IP List ID（如果已创建，可指定）
  AUTH_JWT_SECRET: string
}

export type AppVariables = {
  userId?: string
  sessionId?: string
  userPosition?: {
    id: string
    code: string
    name: string
    level: number
    can_manage_subordinates: number
    permissions: Record<string, Record<string, string[]>>
  }
  userEmployee?: {
    id: string
    org_department_id: string | null
    department_id: string | null
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
    siteConfig: SiteConfigService
  }
}

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './db/schema.js'
import { SystemConfigService } from './services/SystemConfigService.js'
import { FinanceService } from './services/FinanceService.js'
import { UserService } from './services/UserService.js'
import { EmployeeService } from './services/EmployeeService.js'
import { ImportService } from './services/ImportService.js'
import { SalaryPaymentService } from './services/SalaryPaymentService.js'
import { ReportService } from './services/ReportService.js'
import { AuthService } from './services/AuthService.js'
import { MasterDataService } from './services/MasterDataService.js'
import { FixedAssetService } from './services/FixedAssetService.js'
import { RentalService } from './services/RentalService.js'
import type { MyService } from './services/MyService.js'
import type { ApprovalService } from './services/ApprovalService.js'
import type { AuditService } from './services/AuditService.js'
import type { IPWhitelistService } from './services/IPWhitelistService.js'
import type { PositionService } from './services/PositionService.js'
import type { SiteConfigService } from './services/SiteConfigService.js'

// 已移除固定超级管理员
// 所有管理员权限现在基于员工记录的职位
