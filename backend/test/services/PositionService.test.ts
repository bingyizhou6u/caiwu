import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { PositionService } from '../../src/services/hr/PositionService.js'
import {
  positions,
  employees,
  projects,
  orgDepartments,
} from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('PositionService', () => {
  let service: PositionService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new PositionService(db)
  })

  beforeEach(async () => {
    // Clean up tables
    await db.delete(employees).execute()
    await db.delete(positions).execute()
    await db.delete(projects).execute()
    await db.delete(orgDepartments).execute()
  })

  describe('getPositions', () => {
    it('应该返回所有活跃职位', async () => {
      const position1 = {
        id: uuid(),
        code: 'ENG1',
        name: '工程师',
        canManageSubordinates: 0,
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const position2 = {
        id: uuid(),
        code: 'MGR1',
        name: '经理',
        canManageSubordinates: 1,
        permissions: '{}',
        sortOrder: 0,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const position3 = {
        id: uuid(),
        code: 'INACTIVE',
        name: '停用职位',
        canManageSubordinates: 0,
        permissions: '{}',
        sortOrder: 2,
        active: 0, // 非活跃
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await db.insert(positions).values([position1, position2, position3]).execute()

      const result = await service.getPositions()

      expect(result).toHaveLength(2)
      expect(result.map(p => p.code)).toContain('ENG1')
      expect(result.map(p => p.code)).toContain('MGR1')
      expect(result.map(p => p.code)).not.toContain('INACTIVE')
    })

    it('应该按 sortOrder 和 name 排序', async () => {
      const position1 = {
        id: uuid(),
        code: 'B',
        name: 'B职位',
        permissions: '{}',
        sortOrder: 2,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const position2 = {
        id: uuid(),
        code: 'A',
        name: 'A职位',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await db.insert(positions).values([position1, position2]).execute()

      const result = await service.getPositions()

      expect(result[0].code).toBe('A')
      expect(result[1].code).toBe('B')
    })
  })

  describe('getAvailablePositions', () => {
    it('应该返回所有活跃职位', async () => {
      const position1 = {
        id: uuid(),
        code: 'HQ_DIR',
        name: '总部负责人',
        dataScope: 'all',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const position2 = {
        id: uuid(),
        code: 'PROJ_MGR',
        name: '项目主管',
        dataScope: 'project',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const position3 = {
        id: uuid(),
        code: 'INACTIVE_POS',
        name: '停用职位',
        dataScope: 'self',
        permissions: '{}',
        sortOrder: 1,
        active: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([position1, position2, position3]).execute()

      const result = await service.getAvailablePositions()

      // 只返回活跃职位
      expect(result.results).toHaveLength(2)
      expect(result.results.map(p => p.code)).toContain('HQ_DIR')
      expect(result.results.map(p => p.code)).toContain('PROJ_MGR')
      expect(result.results.map(p => p.code)).not.toContain('INACTIVE_POS')
    })

    it('应该按 level 分组', async () => {
      const hqPos = {
        id: uuid(),
        code: 'HQ_POS',
        name: '总部职位',
        level: 1,
        dataScope: 'all',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const projectPos = {
        id: uuid(),
        code: 'PROJ_POS',
        name: '项目职位',
        level: 2,
        dataScope: 'project',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([hqPos, projectPos]).execute()

      const result = await service.getAvailablePositions()

      expect(result.grouped['总部职位']).toHaveLength(1)
      expect(result.grouped['项目职位']).toHaveLength(1)
    })
  })

  describe('createPosition', () => {
    it('应该创建新职位', async () => {
      const data = {
        code: 'NEW_POS',
        name: '新职位',
        description: '测试职位',
        permissions: '{"view": true}',
        sortOrder: 5,
      }

      const result = await service.createPosition(data)

      expect(result.id).toBeDefined()
      expect(result.code).toBe('NEW_POS')
      expect(result.name).toBe('新职位')

      // 验证数据库中的记录
      const position = await db.query.positions.findFirst({
        where: eq(positions.id, result.id),
      })
      expect(position).toBeDefined()
      expect(position?.code).toBe('NEW_POS')
      expect(position?.active).toBe(1)
    })

    it('应该设置默认值', async () => {
      const data = {
        code: 'DEFAULT_POS',
        name: '默认职位',
      }

      const result = await service.createPosition(data)

      const position = await db.query.positions.findFirst({
        where: eq(positions.id, result.id),
      })
      expect(position?.canManageSubordinates).toBe(0)
      expect(position?.permissions).toBe('{}')
      expect(position?.sortOrder).toBe(0)
    })

    it('应该拒绝重复的职位代码', async () => {
      const existing = {
        id: uuid(),
        code: 'EXISTING',
        name: '已存在',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(existing).execute()

      const data = {
        code: 'EXISTING',
        name: '重复职位',
      }

      await expect(service.createPosition(data)).rejects.toThrow()
    })
  })

  describe('updatePosition', () => {
    it('应该更新职位信息', async () => {
      const position = {
        id: uuid(),
        code: 'UPDATE_POS',
        name: '原名称',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      const originalUpdatedAt = position.updatedAt
      await service.updatePosition(position.id, {
        name: '新名称',
        description: '新描述',
      })

      const updated = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.description).toBe('新描述')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('应该支持部分更新', async () => {
      const position = {
        id: uuid(),
        code: 'PARTIAL',
        name: '部分更新',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      const originalUpdatedAt = position.updatedAt
      await service.updatePosition(position.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.code).toBe('PARTIAL') // 未更新的字段保持不变
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('应该检查职位代码冲突', async () => {
      const pos1 = {
        id: uuid(),
        code: 'POS1',
        name: '职位1',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const pos2 = {
        id: uuid(),
        code: 'POS2',
        name: '职位2',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([pos1, pos2]).execute()

      await expect(
        service.updatePosition(pos1.id, {
          code: 'POS2', // 与 pos2 冲突
        })
      ).rejects.toThrow()
    })

    it('应该允许更新为相同的代码', async () => {
      const position = {
        id: uuid(),
        code: 'SAME_CODE',
        name: '职位',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      await service.updatePosition(position.id, {
        code: 'SAME_CODE', // 相同代码
        name: '新名称',
      })

      const updated = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(updated?.name).toBe('新名称')
    })

    it('应该抛出错误当职位不存在', async () => {
      await expect(
        service.updatePosition('non-existent', {
          name: '新名称',
        })
      ).rejects.toThrow()
    })
  })

  describe('deletePosition', () => {
    it('应该软删除职位（设置为 inactive）', async () => {
      const position = {
        id: uuid(),
        code: 'DELETE_POS',
        name: '删除职位',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      const result = await service.deletePosition(position.id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('删除职位')

      const deleted = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(deleted?.active).toBe(0) // 软删除
    })

    it('应该拒绝删除有员工使用的职位', async () => {
      const position = {
        id: uuid(),
        code: 'USED_POS',
        name: '使用中的职位',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      const employee = {
        id: uuid(),
        email: 'test@example.com',
        name: '测试员工',
        positionId: position.id,
        status: 'regular',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(employees).values(employee).execute()

      await expect(service.deletePosition(position.id)).rejects.toThrow()
    })

    it('应该抛出错误当职位不存在', async () => {
      await expect(service.deletePosition('non-existent')).rejects.toThrow()
    })
  })
})
