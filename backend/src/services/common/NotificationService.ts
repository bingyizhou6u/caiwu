import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { EmailService } from './EmailService.js'
import { SystemConfigService } from '../system/SystemConfigService.js'
import { Logger } from '../../utils/logger.js'

export class NotificationService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private emailService: EmailService,
    private systemConfigService: SystemConfigService
  ) {}

  /**
   * 发送审批结果通知
   */
  async notifyApprovalResult(
    type: 'leave' | 'reimbursement' | 'borrowing',
    id: string,
    status: 'approved' | 'rejected',
    approverId: string
  ): Promise<void> {
    // 检查是否启用邮件通知
    const notificationEnabled = await this.systemConfigService.get('email_notification_enabled')
    if (notificationEnabled?.value !== 'true' && notificationEnabled?.value !== true) {
      return // 未启用通知，直接返回
    }

    try {
      // 获取申请人和申请详情
      const application = await this.getApplication(type, id)
      if (!application) {
        Logger.warn(`Application not found: ${type} ${id}`)
        return
      }

      const applicant = await this.getEmployee(application.employeeId)
      if (!applicant || !applicant.email) {
        Logger.warn(`Applicant not found or no email: ${application.employeeId}`)
        return
      }

      const approver = await this.getEmployee(approverId)
      if (!approver) {
        Logger.warn(`Approver not found: ${approverId}`)
        return
      }

      // 获取类型标签
      const typeLabel = this.getTypeLabel(type)

      // 发送邮件通知
      await this.emailService.sendApprovalNotificationEmail({
        to: applicant.email,
        applicantName: applicant.name || '用户',
        type,
        typeLabel,
        status,
        approverName: approver.name || '审批人',
        details: {
          id: application.id,
          amountCents: application.amountCents,
          currency: application.currency,
          startDate: application.startDate,
          endDate: application.endDate,
          days: application.days,
          memo: application.memo,
        },
      })
    } catch (error: any) {
      // 通知失败不应影响审批流程，仅记录错误
      Logger.error('Failed to send approval notification', { error })
    }
  }

  /**
   * 获取申请详情
   */
  private async getApplication(
    type: 'leave' | 'reimbursement' | 'borrowing',
    id: string
  ): Promise<any | null> {
    if (type === 'leave') {
      return await this.db
        .select()
        .from(schema.employeeLeaves)
        .where(eq(schema.employeeLeaves.id, id))
        .get()
    } else if (type === 'reimbursement') {
      return await this.db
        .select()
        .from(schema.expenseReimbursements)
        .where(eq(schema.expenseReimbursements.id, id))
        .get()
    } else if (type === 'borrowing') {
      return await this.db
        .select()
        .from(schema.borrowings)
        .where(eq(schema.borrowings.id, id))
        .get()
    }
    return null
  }

  /**
   * 获取员工信息
   */
  private async getEmployee(employeeId: string): Promise<any | null> {
    return await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, employeeId))
      .get()
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: 'leave' | 'reimbursement' | 'borrowing'): string {
    const labels = {
      leave: '请假',
      reimbursement: '费用报销',
      borrowing: '借款',
    }
    return labels[type] || type
  }
}

