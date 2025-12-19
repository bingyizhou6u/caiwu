/**
 * Cloudflare Email Routing Service
 * 用于管理员工邮箱路由
 */

import { Logger } from '../../utils/logger.js'

interface EmailRoutingEnv {
  CF_ACCOUNT_ID: string
  CF_ZONE_ID: string
  CF_EMAIL_TOKEN?: string // 专用 Email Routing Token
}

interface EmailRoutingRule {
  id: string
  tag: string
  name: string
  enabled: boolean
  matchers: Array<{ type: string; field: string; value: string }>
  actions: Array<{ type: string; value: string[] }>
}

export class EmailRoutingService {
  private accountId: string
  private zoneId: string
  private apiToken: string
  private baseUrl = 'https://api.cloudflare.com/client/v4'

  constructor(env: EmailRoutingEnv) {
    this.accountId = env.CF_ACCOUNT_ID
    this.zoneId = env.CF_ZONE_ID
    this.apiToken = env.CF_EMAIL_TOKEN || ''
  }

  /**
   * 生成公司邮箱地址
   * 基于员工姓名生成 @cloudflarets.com 邮箱
   */
  async generateCompanyEmail(name: string, existingEmails: string[]): Promise<string> {
    const domain = 'cloudflarets.com'

    // 将姓名转换为邮箱前缀（支持中文和英文）
    const basePrefix = this.nameToEmailPrefix(name)

    // 检查是否与现有邮箱冲突
    let email = `${basePrefix}@${domain}`
    let counter = 1

    while (existingEmails.includes(email.toLowerCase())) {
      counter++
      email = `${basePrefix}${counter}@${domain}`
    }

    return email
  }

  /**
   * 将姓名转换为邮箱前缀
   */
  private nameToEmailPrefix(name: string): string {
    // 移除空格和特殊字符，转换为小写
    let prefix = name
      .toLowerCase()
      .replace(/\s+/g, '.') // 空格转换为点
      .replace(/[^a-z0-9.]/g, '') // 移除非字母数字和点的字符

    // 如果是纯中文名，保持原样（Cloudflare 支持 Unicode）
    // 但为了安全起见，对于非 ASCII 字符使用员工 ID 或其他方式
    if (prefix.length === 0) {
      // 如果名字完全是中文或其他非 ASCII 字符，使用拼音或默认前缀
      prefix = 'employee_' + Date.now().toString(36)
    }

    return prefix
  }

  /**
   * 添加/确保收件地址存在（会触发 Cloudflare 验证邮件）
   */
  async ensureDestinationAddress(
    email: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    if (!this.apiToken || !this.accountId) {
      return { success: false, error: 'Missing CF_ACCOUNT_ID or CF_API_TOKEN' }
    }

    const url = `${this.baseUrl}/accounts/${this.accountId}/email/routing/addresses`
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const result = (await resp.json()) as any

      // 已存在或创建成功都视为成功（Cloudflare 会返回 success=false, errors=[] 的情况较少）
      if (result?.success || resp.status === 409) {
        const status = result?.result?.status
        return { success: true, status }
      }

      const errorMsg = result?.errors?.[0]?.message || `HTTP ${resp.status}`
      Logger.error('[EmailRouting] ensureDestinationAddress failed', { error: errorMsg })
      return { success: false, error: errorMsg }
    } catch (error: any) {
      Logger.error('[EmailRouting] ensureDestinationAddress error', { error })
      return { success: false, error: error?.message || 'unknown error' }
    }
  }

  /**
   * 创建邮箱路由规则
   * 将公司邮箱转发到个人邮箱
   */
  async createRoutingRule(
    companyEmail: string,
    personalEmail: string
  ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/email/routing/rules`

    const ruleName = `Forward: ${companyEmail}`
    const emailPrefix = companyEmail.split('@')[0]

    const body = {
      name: ruleName,
      enabled: true,
      matchers: [
        {
          type: 'literal',
          field: 'to',
          value: companyEmail,
        },
      ],
      actions: [
        {
          type: 'forward',
          value: [personalEmail],
        },
      ],
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const result = (await response.json()) as any

      if (result.success) {
        Logger.info(`[EmailRouting] Created rule for ${companyEmail} -> ${personalEmail}`)
        return { success: true, ruleId: result.result.id }
      } else {
        Logger.error('[EmailRouting] Failed to create rule', { errors: result.errors })
        return { success: false, error: result.errors?.[0]?.message || 'Unknown error' }
      }
    } catch (error: any) {
      Logger.error('[EmailRouting] Error creating rule', { error })
      return { success: false, error: error.message }
    }
  }

  /**
   * 删除邮箱路由规则
   */
  async deleteRoutingRule(ruleId: string): Promise<boolean> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/email/routing/rules/${ruleId}`

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      const result = (await response.json()) as any
      return result.success
    } catch (error) {
      Logger.error('[EmailRouting] Error deleting rule', { error })
      return false
    }
  }

  /**
   * 获取所有路由规则
   */
  async listRoutingRules(): Promise<EmailRoutingRule[]> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/email/routing/rules`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      const result = (await response.json()) as any
      if (result.success) {
        return result.result || []
      }
      return []
    } catch (error) {
      Logger.error('[EmailRouting] Error listing rules', { error })
      return []
    }
  }
}
