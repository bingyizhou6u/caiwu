import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { employees } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

/**
 * Cloudflare Access 策略同步服务
 * 
 * 当员工创建/更新时，自动将邮箱同步到 Access 策略
 */

// Access 配置常量
const CF_ACCOUNT_ID = '611d1a2e53f6c6d0922ff231e6a63211'
const CF_ACCESS_APP_ID = '9d55b99c-e8b8-48f1-a211-f5b23685d981'
const CF_ACCESS_POLICY_ID = 'ada0a55b-6eb4-4764-b42f-f5bad29cc3f4'

interface AccessPolicyInclude {
    email?: { email: string }
    email_domain?: { domain: string }
    everyone?: {}
}

interface AccessPolicy {
    id: string
    name: string
    decision: string
    include: AccessPolicyInclude[]
    exclude: AccessPolicyInclude[]
    require: AccessPolicyInclude[]
    precedence: number
}

export class AccessPolicySyncService {
    constructor(
        private db: DrizzleD1Database<typeof schema>,
        private cfAccessToken?: string
    ) { }

    /**
     * 同步所有活跃员工邮箱到 Access 策略
     */
    async syncAllEmployeeEmails(): Promise<{ success: boolean; synced: number; error?: string }> {
        if (!this.cfAccessToken) {
            return { success: false, synced: 0, error: 'CF_ACCESS_TOKEN not configured' }
        }

        try {
            // 获取所有活跃员工的邮箱
            const activeEmployees = await this.db
                .select({ email: employees.personalEmail })
                .from(employees)
                .where(eq(employees.active, 1))
                .all()

            const emails = activeEmployees
                .map(e => e.email)
                .filter((email): email is string => !!email)

            if (emails.length === 0) {
                return { success: true, synced: 0 }
            }

            // 更新 Access 策略
            const include: AccessPolicyInclude[] = emails.map(email => ({
                email: { email }
            }))

            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${CF_ACCESS_APP_ID}/policies/${CF_ACCESS_POLICY_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.cfAccessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: 'Allow Authorized Employees',
                        decision: 'allow',
                        include,
                        exclude: [],
                        require: [],
                        precedence: 1,
                    }),
                }
            )

            const data = await response.json() as { success: boolean; errors?: any[] }

            if (!data.success) {
                console.error('Access policy sync failed:', data.errors)
                return { success: false, synced: 0, error: 'API request failed' }
            }

            return { success: true, synced: emails.length }
        } catch (error: any) {
            console.error('Access policy sync error:', error)
            return { success: false, synced: 0, error: error.message }
        }
    }

    /**
     * 添加单个邮箱到 Access 策略
     * 
     * 注意：由于 API 限制，这实际上会重新同步所有邮箱
     */
    async addEmployeeEmail(email: string): Promise<{ success: boolean; error?: string }> {
        if (!email) {
            return { success: false, error: 'Email is required' }
        }

        // 为了简化，直接同步所有邮箱
        const result = await this.syncAllEmployeeEmails()
        return { success: result.success, error: result.error }
    }

    /**
     * 从 Access 策略移除邮箱（停用员工时调用）
     * 
     * 注意：由于 API 限制，这实际上会重新同步所有活跃邮箱
     */
    async removeEmployeeEmail(email: string): Promise<{ success: boolean; error?: string }> {
        // 直接同步所有活跃邮箱，停用的员工会自动被排除
        const result = await this.syncAllEmployeeEmails()
        return { success: result.success, error: result.error }
    }
}
