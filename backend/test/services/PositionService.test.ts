import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { PositionService } from '../../src/services/PositionService.js'
import { positions, orgDepartments, departments, employees } from '../../src/db/schema.js'
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
    await db.delete(orgDepartments).execute()
    await db.delete(departments).execute()
  })

  describe('getPositions', () => {
    it('应该返回所有活跃职位', async () => {
      const position1 = {
        id: uuid(),
        code: 'ENG1',
        name: '工程师',
        level: 5,
        functionRole: 'engineer',
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
        level: 2,
        functionRole: 'manager',
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
        level: 5,
        functionRole: 'engineer',
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
        level: 5,
        functionRole: 'engineer',
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
        level: 5,
        functionRole: 'engineer',
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
    it('应该返回总部职位的可用职位（level 1）', async () => {
      const hqDept = {
        id: uuid(),
        projectId: null, // 总部
        name: '总部',
        code: 'HQ',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(orgDepartments).values(hqDept).execute()

      const hqPosition = {
        id: uuid(),
        code: 'HQ_DIR',
        name: '总部负责人',
        level: 1,
        functionRole: 'director',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const projectPosition = {
        id: uuid(),
        code: 'PROJ_MGR',
        name: '项目主管',
        level: 2,
        functionRole: 'manager',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([hqPosition, projectPosition]).execute()

      const result = await service.getAvailablePositions(hqDept.id)

      expect(result.results).toHaveLength(1)
      expect(result.results[0].code).toBe('HQ_DIR')
      expect(result.department_info.is_hq).toBe(true)
    })

    it('应该返回项目职位的可用职位（level 2-3）', async () => {
      const projectId = uuid()
      const projectDept = {
        id: uuid(),
        projectId: projectId,
        name: '项目A',
        code: 'PROJ_A',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(departments).values({ id: projectId, name: '项目A', active: 1 }).execute()
      await db.insert(orgDepartments).values(projectDept).execute()

      const hqPosition = {
        id: uuid(),
        code: 'HQ_DIR',
        name: '总部负责人',
        level: 1,
        functionRole: 'director',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const projectPosition = {
        id: uuid(),
        code: 'PROJ_MGR',
        name: '项目主管',
        level: 2,
        functionRole: 'manager',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const teamPosition = {
        id: uuid(),
        code: 'TEAM_LEAD',
        name: '组长',
        level: 3,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([hqPosition, projectPosition, teamPosition]).execute()

      const result = await service.getAvailablePositions(projectDept.id)

      expect(result.results).toHaveLength(2)
      expect(result.results.map(p => p.code)).toContain('PROJ_MGR')
      expect(result.results.map(p => p.code)).toContain('TEAM_LEAD')
      expect(result.results.map(p => p.code)).not.toContain('HQ_DIR')
      expect(result.department_info.is_hq).toBe(false)
    })

    it('应该按 allowedPositions 筛选', async () => {
      const projectId = uuid()
      const projectDept = {
        id: uuid(),
        projectId: projectId,
        name: '项目A',
        code: 'PROJ_A',
        allowedPositions: JSON.stringify(['pos1', 'pos2']),
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(departments).values({ id: projectId, name: '项目A', active: 1 }).execute()
      await db.insert(orgDepartments).values(projectDept).execute()

      const pos1 = {
        id: 'pos1',
        code: 'POS1',
        name: '职位1',
        level: 2,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const pos2 = {
        id: 'pos2',
        code: 'POS2',
        name: '职位2',
        level: 2,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const pos3 = {
        id: 'pos3',
        code: 'POS3',
        name: '职位3',
        level: 2,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values([pos1, pos2, pos3]).execute()

      const result = await service.getAvailablePositions(projectDept.id)

      expect(result.results).toHaveLength(2)
      expect(result.results.map(p => p.id)).toContain('pos1')
      expect(result.results.map(p => p.id)).toContain('pos2')
      expect(result.results.map(p => p.id)).not.toContain('pos3')
    })

    it('应该抛出错误当部门不存在', async () => {
      await expect(service.getAvailablePositions('non-existent')).rejects.toThrow(Errors.NOT_FOUND)
    })
  })

  describe('createPosition', () => {
    it('应该创建新职位', async () => {
      const data = {
        code: 'NEW_POS',
        name: '新职位',
        level: 3,
        functionRole: 'engineer',
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
        level: 3,
        functionRole: 'engineer',
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
        level: 3,
        functionRole: 'engineer',
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
        level: 3,
        functionRole: 'engineer',
      }

      await expect(service.createPosition(data)).rejects.toThrow(Errors.DUPLICATE)
    })
  })

  describe('updatePosition', () => {
    it('应该更新职位信息', async () => {
      const position = {
        id: uuid(),
        code: 'UPDATE_POS',
        name: '原名称',
        level: 3,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      await service.updatePosition(position.id, {
        name: '新名称',
        description: '新描述',
      })

      const updated = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.description).toBe('新描述')
      expect(updated?.updatedAt).toBeGreaterThan(position.updatedAt)
    })

    it('应该支持部分更新', async () => {
      const position = {
        id: uuid(),
        code: 'PARTIAL',
        name: '部分更新',
        level: 3,
        functionRole: 'engineer',
        permissions: '{}',
        sortOrder: 1,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(positions).values(position).execute()

      await service.updatePosition(position.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.positions.findFirst({
        where: eq(positions.id, position.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.code).toBe('PARTIAL') // 未更新的字段保持不变
    })

    it('应该检查职位代码冲突', async () => {
      const pos1 = {
        id: uuid(),
        code: 'POS1',
        name: '职位1',
        level: 3,
        functionRole: 'engineer',
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
        level: 3,
        functionRole: 'engineer',
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
      ).rejects.toThrow(Errors.DUPLICATE)
    })

    it('应该允许更新为相同的代码', async () => {
      const position = {
        id: uuid(),
        code: 'SAME_CODE',
        name: '职位',
        level: 3,
        functionRole: 'engineer',
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
      ).rejects.toThrow(Errors.NOT_FOUND)
    })
  })

  describe('deletePosition', () => {
    it('应该软删除职位（设置为 inactive）', async () => {
      const position = {
        id: uuid(),
        code: 'DELETE_POS',
        name: '删除职位',
        level: 3,
        functionRole: 'engineer',
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
        level: 3,
        functionRole: 'engineer',
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

      await expect(service.deletePosition(position.id)).rejects.toThrow(Errors.BUSINESS_ERROR)
    })

    it('应该抛出错误当职位不存在', async () => {
      await expect(service.deletePosition('non-existent')).rejects.toThrow(Errors.NOT_FOUND)
    })
  })
})
