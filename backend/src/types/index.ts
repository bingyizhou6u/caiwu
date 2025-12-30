import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { MonitoringService } from '../utils/monitoring.js'
import type { ServiceContainer } from '../middleware/service-container.js'

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
  INIT_ADMIN_EMAIL?: string
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

  // Monitoring service (initialized at startup)
  monitoring: MonitoringService

  // Dependency Injection - 使用懒加载的服务容器
  db: DrizzleD1Database<typeof schema>
  services: ServiceContainer
}

// 已移除固定超级管理员
// 所有管理员权限现在基于员工记录的职位
