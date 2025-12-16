import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { businessOperationHistory, employees } from '../db/schema.js'
import { uuid } from '../utils/db.js'

export class OperationHistoryService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * 记录业务操作历史
   */
  async recordOperation(
    entityType: string,
    entityId: string,
    action: string,
    operatorId: string,
    beforeData?: any,
    afterData?: any,
    memo?: string
  ): Promise<void> {
    // 获取操作人姓名
    let operatorName: string | null = null
    try {
      const operator = await this.db
        .select({ name: employees.name })
        .from(employees)
        .where(eq(employees.id, operatorId))
        .get()
      operatorName = operator?.name || null
    } catch (error) {
      // 忽略错误，继续记录
      console.warn('Failed to get operator name:', error)
    }

    await this.db.insert(businessOperationHistory).values({
      id: uuid(),
      entityType,
      entityId,
      action,
      operatorId,
      operatorName,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
      memo: memo || null,
      createdAt: Date.now(),
    })
  }

  /**
   * 获取实体的操作历史
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<any[]> {
    const history = await this.db
      .select()
      .from(businessOperationHistory)
      .where(
        and(
          eq(businessOperationHistory.entityType, entityType),
          eq(businessOperationHistory.entityId, entityId)
        )
      )
      .orderBy(desc(businessOperationHistory.createdAt))
      .limit(limit)
      .all()

    return history.map(h => ({
      ...h,
      beforeData: h.beforeData ? JSON.parse(h.beforeData) : null,
      afterData: h.afterData ? JSON.parse(h.afterData) : null,
    }))
  }

  /**
   * 获取操作人的操作历史
   */
  async getOperatorHistory(
    operatorId: string,
    entityType?: string,
    limit: number = 50
  ): Promise<any[]> {
    const conditions = [eq(businessOperationHistory.operatorId, operatorId)]
    if (entityType) {
      conditions.push(eq(businessOperationHistory.entityType, entityType))
    }

    const history = await this.db
      .select()
      .from(businessOperationHistory)
      .where(and(...conditions))
      .orderBy(desc(businessOperationHistory.createdAt))
      .limit(limit)
      .all()

    return history.map(h => ({
      ...h,
      beforeData: h.beforeData ? JSON.parse(h.beforeData) : null,
      afterData: h.afterData ? JSON.parse(h.afterData) : null,
    }))
  }
}

