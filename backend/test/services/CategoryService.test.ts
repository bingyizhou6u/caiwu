import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { CategoryService } from '../../src/services/CategoryService.js'
import { categories, cashFlows } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('CategoryService', () => {
  let service: CategoryService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new CategoryService(db)
  })

  beforeEach(async () => {
    await db.delete(cashFlows).execute()
    await db.delete(categories).execute()
  })

  describe('getCategories', () => {
    it('应该返回所有类别', async () => {
      const category1 = {
        id: uuid(),
        name: '类别A',
        kind: 'expense',
        active: 1,
      }
      const category2 = {
        id: uuid(),
        name: '类别B',
        kind: 'income',
        active: 1,
      }
      await db.insert(categories).values([category1, category2]).execute()

      const result = await service.getCategories()

      expect(result).toHaveLength(2)
      expect(result.map(c => c.name)).toContain('类别A')
      expect(result.map(c => c.name)).toContain('类别B')
    })

    it('应该按 kind 和 name 排序', async () => {
      const category1 = {
        id: uuid(),
        name: 'B类别',
        kind: 'expense',
        active: 1,
      }
      const category2 = {
        id: uuid(),
        name: 'A类别',
        kind: 'expense',
        active: 1,
      }
      const category3 = {
        id: uuid(),
        name: '收入类别',
        kind: 'income',
        active: 1,
      }
      await db.insert(categories).values([category1, category2, category3]).execute()

      const result = await service.getCategories()

      // income 应该在 expense 之前（按 kind 排序）
      expect(result[0].kind).toBe('income')
      expect(result[1].name).toBe('A类别')
      expect(result[2].name).toBe('B类别')
    })
  })

  describe('createCategory', () => {
    it('应该创建新类别', async () => {
      const result = await service.createCategory({
        name: '新类别',
        kind: 'expense',
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('新类别')
      expect(result.kind).toBe('expense')

      const category = await db.query.categories.findFirst({
        where: eq(categories.id, result.id),
      })
      expect(category).toBeDefined()
      expect(category?.active).toBe(1)
    })

    it('应该支持创建有父类别的类别', async () => {
      const parent = {
        id: uuid(),
        name: '父类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(parent).execute()

      const result = await service.createCategory({
        name: '子类别',
        kind: 'expense',
        parentId: parent.id,
      })

      expect(result.parentId).toBe(parent.id)
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, result.id),
      })
      expect(category?.parentId).toBe(parent.id)
    })

    it('应该拒绝重复的类别名称', async () => {
      const existing = {
        id: uuid(),
        name: '已存在',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(existing).execute()

      await expect(
        service.createCategory({
          name: '已存在',
          kind: 'expense',
        })
      ).rejects.toThrow(Errors.DUPLICATE)
    })
  })

  describe('updateCategory', () => {
    it('应该更新类别信息', async () => {
      const category = {
        id: uuid(),
        name: '原名称',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      await service.updateCategory(category.id, {
        name: '新名称',
        kind: 'income',
      })

      const updated = await db.query.categories.findFirst({
        where: eq(categories.id, category.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.kind).toBe('income')
    })

    it('应该支持部分更新', async () => {
      const category = {
        id: uuid(),
        name: '类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      await service.updateCategory(category.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.categories.findFirst({
        where: eq(categories.id, category.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.kind).toBe('expense') // 未更新的字段保持不变
    })

    it('应该拒绝更新为已存在的类别名称', async () => {
      const category1 = {
        id: uuid(),
        name: '类别1',
        kind: 'expense',
        active: 1,
      }
      const category2 = {
        id: uuid(),
        name: '类别2',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values([category1, category2]).execute()

      await expect(
        service.updateCategory(category1.id, {
          name: '类别2', // 与 category2 冲突
        })
      ).rejects.toThrow(Errors.DUPLICATE)
    })

    it('应该允许更新为相同的名称', async () => {
      const category = {
        id: uuid(),
        name: '类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      await service.updateCategory(category.id, {
        name: '类别', // 相同名称
        kind: 'income',
      })

      const updated = await db.query.categories.findFirst({
        where: eq(categories.id, category.id),
      })
      expect(updated?.kind).toBe('income')
    })

    it('应该返回 ok 当没有更新字段', async () => {
      const category = {
        id: uuid(),
        name: '类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      const result = await service.updateCategory(category.id, {})

      expect(result.ok).toBe(true)
    })
  })

  describe('deleteCategory', () => {
    it('应该删除类别', async () => {
      const category = {
        id: uuid(),
        name: '删除类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      const result = await service.deleteCategory(category.id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('删除类别')

      const deleted = await db.query.categories.findFirst({
        where: eq(categories.id, category.id),
      })
      expect(deleted).toBeUndefined()
    })

    it('应该拒绝删除有流水记录的类别', async () => {
      const category = {
        id: uuid(),
        name: '有流水的类别',
        kind: 'expense',
        active: 1,
      }
      await db.insert(categories).values(category).execute()

      const flow = {
        id: uuid(),
        accountId: uuid(),
        type: 'expense',
        amountCents: 10000,
        categoryId: category.id,
        transactionDate: '2024-01-01',
        createdAt: Date.now(),
      }
      await db.insert(cashFlows).values(flow).execute()

      await expect(service.deleteCategory(category.id)).rejects.toThrow(Errors.BUSINESS_ERROR)
    })

    it('应该抛出错误当类别不存在', async () => {
      await expect(service.deleteCategory('non-existent')).rejects.toThrow(Errors.NOT_FOUND)
    })
  })
})
