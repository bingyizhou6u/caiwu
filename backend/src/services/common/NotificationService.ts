import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { EmailService } from './EmailService.js'
import { SystemConfigService } from '../system/SystemConfigService.js'
import { Logger } from '../../utils/logger.js'

const { notifications, employees, employeeLeaves, expenseReimbursements } = schema

// 通知类型
export type NotificationType = 'system' | 'approval' | 'task' | 'message'

// 创建站内通知参数
export interface CreateInAppNotificationParams {
  recipientId: string
  type: NotificationType
  title: string
  content?: string
  link?: string
  relatedEntityType?: string
  relatedEntityId?: string
}

// 通知列表查询参数
export interface NotificationFilters {
  isRead?: boolean
  type?: NotificationType
  limit?: number
  offset?: number
}

export class NotificationService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private emailService: EmailService,
    private systemConfigService: SystemConfigService
  ) { }

  // ==========================================
  // 站内通知功能
  // ==========================================

  /**
   * 获取站内通知列表
   */
  async getNotifications(employeeId: string, filters: NotificationFilters = {}) {
    const conditions = [eq(notifications.recipientId, employeeId)]

    if (filters.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead ? 1 : 0))
    }

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type))
    }

    const limit = filters.limit || 20
    const offset = filters.offset || 0

    const results = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return results
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(employeeId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, employeeId),
          eq(notifications.isRead, 0)
        )
      )
      .all()

    return result.length
  }

  /**
   * 获取单条通知
   */
  async getNotificationById(id: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .get()
  }

  /**
   * 标记单条通知为已读
   */
  async markAsRead(id: string, employeeId: string): Promise<boolean> {
    const notification = await this.getNotificationById(id)
    if (!notification || notification.recipientId !== employeeId) {
      return false
    }

    await this.db
      .update(notifications)
      .set({
        isRead: 1,
        readAt: Date.now(),
      })
      .where(eq(notifications.id, id))
      .run()

    return true
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(employeeId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: 1,
        readAt: Date.now(),
      })
      .where(
        and(
          eq(notifications.recipientId, employeeId),
          eq(notifications.isRead, 0)
        )
      )
      .run()

    return result.meta?.changes || 0
  }

  /**
   * 创建站内通知
   */
  async createNotification(params: CreateInAppNotificationParams): Promise<string> {
    const id = crypto.randomUUID()
    const now = Date.now()

    await this.db
      .insert(notifications)
      .values({
        id,
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        content: params.content,
        link: params.link,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
        isRead: 0,
        createdAt: now,
      })
      .run()

    return id
  }

  /**
   * 批量创建通知（给多人发送相同通知）
   */
  async createNotifications(
    recipientIds: string[],
    params: Omit<CreateInAppNotificationParams, 'recipientId'>
  ): Promise<string[]> {
    const ids: string[] = []
    const now = Date.now()

    for (const recipientId of recipientIds) {
      const id = crypto.randomUUID()
      ids.push(id)

      await this.db
        .insert(notifications)
        .values({
          id,
          recipientId,
          type: params.type,
          title: params.title,
          content: params.content,
          link: params.link,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId,
          isRead: 0,
          createdAt: now,
        })
        .run()
    }

    return ids
  }

  /**
   * 删除通知
   */
  async deleteNotification(id: string, employeeId: string): Promise<boolean> {
    const notification = await this.getNotificationById(id)
    if (!notification || notification.recipientId !== employeeId) {
      return false
    }

    await this.db
      .delete(notifications)
      .where(eq(notifications.id, id))
      .run()

    return true
  }

  // ==========================================
  // 邮件通知功能（原有）
  // ==========================================

  /**
   * 发送审批结果通知（邮件 + 站内）
   */
  async notifyApprovalResult(
    type: 'leave' | 'reimbursement',
    id: string,
    status: 'approved' | 'rejected',
    approverId: string
  ): Promise<void> {
    try {
      // 获取申请人和申请详情
      const application = await this.getApplication(type, id)
      if (!application) {
        Logger.warn(`Application not found: ${type} ${id}`)
        return
      }

      const applicant = await this.getEmployee(application.employeeId)
      if (!applicant) {
        Logger.warn(`Applicant not found: ${application.employeeId}`)
        return
      }

      const approver = await this.getEmployee(approverId)
      const typeLabel = this.getTypeLabel(type)
      const statusLabel = status === 'approved' ? '已通过' : '已拒绝'

      // 1. 创建站内通知
      await this.createNotification({
        recipientId: application.employeeId,
        type: 'approval',
        title: `${typeLabel}申请${statusLabel}`,
        content: `您的${typeLabel}申请已被 ${approver?.name || '审批人'} ${statusLabel}`,
        link: type === 'leave' ? '/my/leaves' : '/my/reimbursements',
        relatedEntityType: type,
        relatedEntityId: id,
      })

      // 2. 发送邮件通知（如果启用）
      const notificationEnabled = await this.systemConfigService.get('email_notification_enabled')
      if (notificationEnabled?.value === 'true' || notificationEnabled?.value === true) {
        if (applicant.email) {
          await this.emailService.sendApprovalNotificationEmail({
            to: applicant.email,
            applicantName: applicant.name || '用户',
            type,
            typeLabel,
            status,
            approverName: approver?.name || '审批人',
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
        }
      }
    } catch (error: any) {
      // 通知失败不应影响审批流程，仅记录错误
      Logger.error('Failed to send approval notification', { error })
    }
  }

  /**
   * 获取申请详情
   */
  private async getApplication(
    type: 'leave' | 'reimbursement',
    id: string
  ): Promise<any | null> {
    if (type === 'leave') {
      return await this.db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, id))
        .get()
    } else if (type === 'reimbursement') {
      return await this.db
        .select()
        .from(expenseReimbursements)
        .where(eq(expenseReimbursements.id, id))
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
      .from(employees)
      .where(eq(employees.id, employeeId))
      .get()
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: 'leave' | 'reimbursement'): string {
    const labels: Record<'leave' | 'reimbursement', string> = {
      leave: '请假',
      reimbursement: '费用报销',
    }
    return labels[type] || type
  }
}
