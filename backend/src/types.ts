export type Env = {
  DB: D1Database
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
    level: string
    scope: string
    permissions: any
  }
  userEmployee?: {
    org_department_id: string | null
    department_id: string | null
  }
}

// 已移除固定超级管理员
// 所有管理员权限现在基于员工记录的职位

