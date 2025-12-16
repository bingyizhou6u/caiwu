import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { CategoryService } from '../../src/services/CategoryService.js'
import { categories, cashFlows, accounts, currencies } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { AppError } from '../../src/utils/errors.js'

describe('CategoryService', () => {
  let service: CategoryService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // 初始化数据库 schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new CategoryService(db)
  })

  beforeEach(async () => {
    // 清理测试数据
    await db.delete(cashFlows).execute()
    await db.delete(accounts).execute()
    await db.delete(categories).execute()
  })

  describe('getCategories', () => {
    it('应该返回所有类别', async () => {
      await db
        .insert(categories)
        .values([
          { id: uuid(), name: '工资支出', kind: 'expense', active: 1 },
          { id: uuid(), name: '销售收入', kind: 'income', active: 1 },
        ])
        .execute()

      const result = await service.getCategories()

      expect(result).toHaveLength(2)
      expect(result.map(c => c.name)).toContain('工资支出')
      expect(result.map(c => c.name)).toContain('销售收入')
    })

    it('应该按类型和名称排序', async () => {
      await db
        .insert(categories)
        .values([
          { id: uuid(), name: 'B收入', kind: 'income', active: 1 },
          { id: uuid(), name: 'A收入', kind: 'income', active: 1 },
          { id: uuid(), name: 'A支出', kind: 'expense', active: 1 },
        ])
        .execute()

      const result = await service.getCategories()

      // 按 kind 排序（expense < income），然后按 name 排序
      expect(result[0].name).toBe('A支出')
      expect(result[1].name).toBe('A收入')
      expect(result[2].name).toBe('B收入')
    })
  })

  describe('createCategory', () => {
    it('应该创建新类别', async () => {
      const data = {
        name: '办公费用',
        kind: 'expense',
      }

      const result = await service.createCategory(data)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('办公费用')
      expect(result.kind).toBe('expense')

      // 验证数据库记录
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, result.id),
      })
      expect(category?.name).toBe('办公费用')
      expect(category?.active).toBe(1)
    })

    it('应该支持创建子类别', async () => {
      const parentId = uuid()
      await db
        .insert(categories)
        .values({ id: parentId, name: '父类别', kind: 'expense', active: 1 })
        .execute()

      const result = await service.createCategory({
        name: '子类别',
        kind: 'expense',
        parentId,
      })

      const category = await db.query.categories.findFirst({
        where: eq(categories.id, result.id),
      })
      expect(category?.parentId).toBe(parentId)
    })

    it('应该拒绝重复的类别名称', async () => {
      await db.insert(categories).values({ id: uuid(), name: '重复名称', kind: 'expense', active: 1 }).execute()

      await expect(
        service.createCategory({
          name: '重复名称',
          kind: 'income',
        })
      ).rejects.toThrow('已存在')
    })
  })

  describe('updateCategory', () => {
    it('应该更新类别信息', async () => {
      const id = uuid()
      await db.insert(categories).values({ id, name: '原名称', kind: 'expense', active: 1 }).execute()

      const result = await service.updateCategory(id, {
        name: '新名称',
        kind: 'income',
      })

      expect(result.ok).toBe(true)

      const category = await db.query.categories.findFirst({ where: eq(categories.id, id) })
      expect(category?.name).toBe('新名称')
      expect(category?.kind).toBe('income')
    })

    it('应该支持部分更新', async () => {
      const id = uuid()
      await db.insert(categories).values({ id, name: '测试类别', kind: 'expense', active: 1 }).execute()

      await service.updateCategory(id, { name: '更新后名称' })

      const category = await db.query.categories.findFirst({ where: eq(categories.id, id) })
      expect(category?.name).toBe('更新后名称')
      expect(category?.kind).toBe('expense') // 未修改的字段保持不变
    })

    it('应该拒绝更新为重复名称', async () => {
      const id1 = uuid()
      const id2 = uuid()
      await db
        .insert(categories)
        .values([
          { id: id1, name: '类别1', kind: 'expense', active: 1 },
          { id: id2, name: '类别2', kind: 'expense', active: 1 },
        ])
        .execute()

      await expect(service.updateCategory(id1, { name: '类别2' })).rejects.toThrow('已存在')
    })

    it('应该允许更新为相同名称', async () => {
      const id = uuid()
      await db.insert(categories).values({ id, name: '原名称', kind: 'expense', active: 1 }).execute()

      const result = await service.updateCategory(id, { name: '原名称' })

      expect(result.ok).toBe(true)
    })

    it('空更新应该返回成功', async () => {
      const id = uuid()
      await db.insert(categories).values({ id, name: '测试类别', kind: 'expense', active: 1 }).execute()

      const result = await service.updateCategory(id, {})

      expect(result.ok).toBe(true)
    })
  })

  describe('deleteCategory', () => {
    it('应该删除类别', async () => {
      const id = uuid()
      await db.insert(categories).values({ id, name: '待删除类别', kind: 'expense', active: 1 }).execute()

      const result = await service.deleteCategory(id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('待删除类别')

      const category = await db.query.categories.findFirst({ where: eq(categories.id, id) })
      expect(category).toBeUndefined()
    })

    it('应该拒绝删除不存在的类别', async () => {
      await expect(service.deleteCategory('non-existent')).rejects.toThrow('不存在')
    })

    it('应该拒绝删除有流水记录的类别', async () => {
      const categoryId = uuid()
      const accountId = uuid()

      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()
      await db
        .insert(accounts)
        .values({ id: accountId, name: '测试账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()
      await db.insert(categories).values({ id: categoryId, name: '有流水类别', kind: 'expense', active: 1 }).execute()
      await db
        .insert(cashFlows)
        .values({
          id: uuid(),
          accountId,
          categoryId,
          type: 'expense',
          amountCents: 1000,
          bizDate: '2024-01-01',
          createdAt: Date.now(),
        })
        .execute()

      await expect(service.deleteCategory(categoryId)).rejects.toThrow('无法删除')
    })
  })
})
