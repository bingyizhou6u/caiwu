import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { VendorService } from '../../src/services/system/VendorService.js'
import { vendors } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('VendorService', () => {
  let service: VendorService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new VendorService(db)
  })

  beforeEach(async () => {
    await db.delete(vendors).execute()
  })

  describe('getVendors', () => {
    it('应该返回所有活跃供应商', async () => {
      const vendor1 = {
        id: uuid(),
        name: '供应商1',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const vendor2 = {
        id: uuid(),
        name: '供应商2',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const vendor3 = {
        id: uuid(),
        name: '停用供应商',
        active: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values([vendor1, vendor2, vendor3]).execute()

      const result = await service.getVendors()

      expect(result).toHaveLength(2)
      expect(result.map(v => v.name)).toContain('供应商1')
      expect(result.map(v => v.name)).toContain('供应商2')
      expect(result.map(v => v.name)).not.toContain('停用供应商')
    })

    it('应该按名称排序', async () => {
      const vendor1 = {
        id: uuid(),
        name: 'B供应商',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const vendor2 = {
        id: uuid(),
        name: 'A供应商',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values([vendor1, vendor2]).execute()

      const result = await service.getVendors()

      expect(result[0].name).toBe('A供应商')
      expect(result[1].name).toBe('B供应商')
    })
  })

  describe('getVendor', () => {
    it('应该返回指定供应商', async () => {
      const vendor = {
        id: uuid(),
        name: '测试供应商',
        contact: '联系人',
        phone: '123456789',
        email: 'vendor@example.com',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values(vendor).execute()

      const result = await service.getVendor(vendor.id)

      expect(result.id).toBe(vendor.id)
      expect(result.name).toBe('测试供应商')
      expect(result.contact).toBe('联系人')
    })

    it('应该抛出错误当供应商不存在', async () => {
      await expect(service.getVendor('non-existent')).rejects.toThrow()
    })
  })

  describe('createVendor', () => {
    it('应该创建新供应商', async () => {
      const data = {
        name: '新供应商',
        contact: '联系人',
        phone: '123456789',
        email: 'vendor@example.com',
        address: '地址',
        memo: '备注',
      }

      const result = await service.createVendor(data)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('新供应商')
      expect(result.active).toBe(1)

      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, result.id),
      })
      expect(vendor).toBeDefined()
      expect(vendor?.name).toBe('新供应商')
    })

    it('应该支持最小字段创建', async () => {
      const result = await service.createVendor({
        name: '最小供应商',
      })

      expect(result.name).toBe('最小供应商')
      expect(result.active).toBe(1)
    })
  })

  describe('updateVendor', () => {
    it('应该更新供应商信息', async () => {
      const vendor = {
        id: uuid(),
        name: '原名称',
        contact: '原联系人',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values(vendor).execute()

      const originalUpdatedAt = vendor.updatedAt
      await service.updateVendor(vendor.id, {
        name: '新名称',
        contact: '新联系人',
      })

      const updated = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendor.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.contact).toBe('新联系人')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('应该支持部分更新', async () => {
      const vendor = {
        id: uuid(),
        name: '供应商',
        contact: '联系人',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values(vendor).execute()

      await service.updateVendor(vendor.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendor.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.contact).toBe('联系人') // 未更新的字段保持不变
    })

    it('应该可以停用供应商', async () => {
      const vendor = {
        id: uuid(),
        name: '供应商',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values(vendor).execute()

      await service.updateVendor(vendor.id, {
        active: 0,
      })

      const updated = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendor.id),
      })
      expect(updated?.active).toBe(0)
    })
  })

  describe('deleteVendor', () => {
    it('应该软删除供应商（设置为 inactive）', async () => {
      const vendor = {
        id: uuid(),
        name: '删除供应商',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(vendors).values(vendor).execute()

      const result = await service.deleteVendor(vendor.id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('删除供应商')

      const deleted = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendor.id),
      })
      expect(deleted?.active).toBe(0) // 软删除
    })
  })
})
