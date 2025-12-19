import { describe, it, expect, beforeEach } from 'vitest'
import { OperationHistoryService } from '../../src/services/system/OperationHistoryService.js'
import { createDb } from '../../src/db'
import { env } from 'cloudflare:test'
import { applySchema } from '../setup'
import { employees, businessOperationHistory } from '../../src/db/schema'
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'

describe('OperationHistoryService', () => {
  let db: any
  let operationHistoryService: OperationHistoryService

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    operationHistoryService = new OperationHistoryService(db)

    // 创建测试员工
    await db
      .insert(employees)
      .values({
        id: 'emp1',
        email: 'test@example.com',
        name: 'Test Employee',
        joinDate: '2023-01-01',
        status: 'regular',
        active: 1,
      })
      .run()
  })

  describe('recordOperation', () => {
    it('应该记录操作历史', async () => {
      const entityId = uuid()
      const operatorId = 'emp1'
      const beforeData = { status: 'pending' }
      const afterData = { status: 'approved' }

      await operationHistoryService.recordOperation(
        'salary_payment',
        entityId,
        'approved',
        operatorId,
        beforeData,
        afterData,
        '测试备注'
      )

      const history = await db
        .select()
        .from(businessOperationHistory)
        .where(eq(businessOperationHistory.entityId, entityId))
        .get()

      expect(history).toBeDefined()
      expect(history?.entityType).toBe('salary_payment')
      expect(history?.entityId).toBe(entityId)
      expect(history?.action).toBe('approved')
      expect(history?.operatorId).toBe(operatorId)
      expect(history?.operatorName).toBe('Test Employee')
      expect(history?.memo).toBe('测试备注')
      expect(JSON.parse(history?.beforeData || '{}')).toEqual(beforeData)
      expect(JSON.parse(history?.afterData || '{}')).toEqual(afterData)
    })

    it('应该处理空的操作数据', async () => {
      const entityId = uuid()
      const operatorId = 'emp1'

      await operationHistoryService.recordOperation(
        'borrowing',
        entityId,
        'created',
        operatorId
      )

      const history = await db
        .select()
        .from(businessOperationHistory)
        .where(eq(businessOperationHistory.entityId, entityId))
        .get()

      expect(history).toBeDefined()
      expect(history?.beforeData).toBeNull()
      expect(history?.afterData).toBeNull()
    })
  })

  describe('getEntityHistory', () => {
    it('应该获取实体的操作历史', async () => {
      const entityId = uuid()
      const operatorId = 'emp1'

      // 记录多条历史
      await operationHistoryService.recordOperation(
        'salary_payment',
        entityId,
        'created',
        operatorId,
        null,
        { status: 'pending' }
      )

      await operationHistoryService.recordOperation(
        'salary_payment',
        entityId,
        'approved',
        operatorId,
        { status: 'pending' },
        { status: 'approved' }
      )

      const history = await operationHistoryService.getEntityHistory(
        'salary_payment',
        entityId
      )

      expect(history.length).toBe(2)
      expect(history[0].action).toBe('approved') // 最新的在前
      expect(history[1].action).toBe('created')
    })

    it('应该限制返回数量', async () => {
      const entityId = uuid()
      const operatorId = 'emp1'

      // 记录多条历史
      for (let i = 0; i < 10; i++) {
        await operationHistoryService.recordOperation(
          'salary_payment',
          entityId,
          'updated',
          operatorId
        )
      }

      const history = await operationHistoryService.getEntityHistory(
        'salary_payment',
        entityId,
        5
      )

      expect(history.length).toBe(5)
    })
  })

  describe('getOperatorHistory', () => {
    it('应该获取操作人的操作历史', async () => {
      const operatorId = 'emp1'
      const entityId1 = uuid()
      const entityId2 = uuid()

      await operationHistoryService.recordOperation(
        'salary_payment',
        entityId1,
        'created',
        operatorId
      )

      await operationHistoryService.recordOperation(
        'borrowing',
        entityId2,
        'approved',
        operatorId
      )

      const history = await operationHistoryService.getOperatorHistory(operatorId)

      expect(history.length).toBe(2)
      expect(history.some(h => h.entityId === entityId1)).toBe(true)
      expect(history.some(h => h.entityId === entityId2)).toBe(true)
    })

    it('应该按实体类型过滤', async () => {
      const operatorId = 'emp1'
      const entityId1 = uuid()
      const entityId2 = uuid()

      await operationHistoryService.recordOperation(
        'salary_payment',
        entityId1,
        'created',
        operatorId
      )

      await operationHistoryService.recordOperation(
        'borrowing',
        entityId2,
        'approved',
        operatorId
      )

      const history = await operationHistoryService.getOperatorHistory(
        operatorId,
        'salary_payment'
      )

      expect(history.length).toBe(1)
      expect(history[0].entityId).toBe(entityId1)
    })
  })
})

