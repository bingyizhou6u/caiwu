import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { FixedAssetService } from '../../src/services/assets/FixedAssetService.js'
import {
  fixedAssets,
  fixedAssetDepreciations,
  fixedAssetChanges,
  sites,
  vendors,
  currencies,
  employees,
  accounts,
  cashFlows,
  categories,
  projects,
} from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('FixedAssetService', () => {
  let service: FixedAssetService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    // Mock transaction for test environment limitation
    // @ts-ignore
    db.transaction = async cb => cb(db)
    service = new FixedAssetService(db)
  })

  beforeEach(async () => {
    await db.delete(fixedAssetDepreciations).execute()
    await db.delete(fixedAssetChanges).execute()
    await db.delete(cashFlows).execute()
    await db.delete(fixedAssets).execute()
    await db.delete(accounts).execute()
    await db.delete(employees).execute()
    await db.delete(sites).execute()
    await db.delete(vendors).execute()
    await db.delete(projects).execute()
    await db.delete(currencies).execute()
    await db.delete(categories).execute()
  })

  describe('list', () => {
    it('应该返回资产列表', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const project = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PRJ-TEST-1',
        active: 1,
      }
      await db.insert(projects).values(project).execute()

      const now = Date.now()
      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产1',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        projectId: project.id,
        status: 'in_use',
        createdAt: now,
        updatedAt: now,
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '资产2',
        category: '设备',
        purchaseDate: '2024-01-02',
        purchasePriceCents: 200000,
        currency: 'CNY',
        projectId: project.id,
        status: 'in_use',
        createdAt: now + 1,
        updatedAt: now + 1,
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.list({})

      expect(result).toHaveLength(2)
      // 按创建时间倒序，asset2后创建，应该在前面
      expect(result[0].asset.name).toBe('资产2')
      expect(result[1].asset.name).toBe('资产1')
    })

    it('应该支持搜索功能', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '笔记本电脑',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '办公桌',
        category: '家具',
        purchaseDate: '2024-01-02',
        purchasePriceCents: 50000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.list({ search: '电脑' })

      expect(result).toHaveLength(1)
      expect(result[0].asset.name).toBe('笔记本电脑')
    })

    it('应该支持按状态筛选', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产1',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '资产2',
        category: '设备',
        purchaseDate: '2024-01-02',
        purchasePriceCents: 200000,
        currency: 'CNY',
        status: 'scrapped',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.list({ status: 'in_use' })

      expect(result).toHaveLength(1)
      expect(result[0].asset.status).toBe('in_use')
    })

    it('应该支持按项目筛选', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const project1 = {
        id: uuid(),
        hqId: 'hq',
        name: '项目1',
        code: 'PRJ-1',
        active: 1,
      }
      const project2 = {
        id: uuid(),
        hqId: 'hq',
        name: '项目2',
        code: 'PRJ-2',
        active: 1,
      }
      await db.insert(projects).values([project1, project2]).execute()

      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产1',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        projectId: project1.id,
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '资产2',
        category: '设备',
        purchaseDate: '2024-01-02',
        purchasePriceCents: 200000,
        currency: 'CNY',
        projectId: project2.id,
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.list({ projectId: project1.id })

      expect(result).toHaveLength(1)
      expect(result[0].asset.projectId).toBe(project1.id)
    })

    it('应该支持分页', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      // 分批插入以避免SQL语句过长
      const assets = []
      for (let i = 0; i < 25; i++) {
        assets.push({
          id: uuid(),
          assetCode: `ASSET${String(i + 1).padStart(3, '0')}`,
          name: `资产${i + 1}`,
          category: '设备',
          purchaseDate: '2024-01-01',
          purchasePriceCents: 100000,
          currency: 'CNY',
          status: 'in_use',
          createdAt: Date.now() + i,
          updatedAt: Date.now() + i,
        })
      }
      // 分批插入，每批10条
      for (let i = 0; i < assets.length; i += 10) {
        await db.insert(fixedAssets).values(assets.slice(i, i + 10)).execute()
      }

      const result = await service.list({ limit: 10, offset: 0 })

      expect(result).toHaveLength(10)
    })
  })

  describe('getCategories', () => {
    it('应该返回所有类别', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产1',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '资产2',
        category: '家具',
        purchaseDate: '2024-01-02',
        purchasePriceCents: 200000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.getCategories()

      expect(result).toHaveLength(2)
      expect(result.map(c => c.name)).toContain('设备')
      expect(result.map(c => c.name)).toContain('家具')
    })

    it('应该排除空类别', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset1 = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产1',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const asset2 = {
        id: uuid(),
        assetCode: 'ASSET002',
        name: '资产2',
        category: null,
        purchaseDate: '2024-01-02',
        purchasePriceCents: 200000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values([asset1, asset2]).execute()

      const result = await service.getCategories()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('设备')
    })
  })

  describe('get', () => {
    it('应该返回资产详情', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const project = {
        id: uuid(),
        hqId: 'hq',
        name: '测试部门',
        code: 'PRJ-DEPT',
        active: 1,
      }
      await db.insert(projects).values(project).execute()

      const asset = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        projectId: project.id,
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(asset).execute()

      const result = await service.get(asset.id)

      expect(result!.id).toBe(asset.id)
      expect(result!.name).toBe('资产')
      expect(result!.departmentName).toBe('测试部门')
    })

    it('应该返回null当资产不存在', async () => {
      const result = await service.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('应该创建新资产', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.create({
        assetCode: 'ASSET001',
        name: '新资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
      })

      expect(result.id).toBeDefined()
      expect(result.assetCode).toBe('ASSET001')

      const asset = await db.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, result.id),
      })
      expect(asset).toBeDefined()
      expect(asset?.status).toBe('in_use')
      expect(asset?.currentValueCents).toBe(100000)
    })

    it('应该设置默认状态和当前价值', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.create({
        assetCode: 'ASSET001',
        name: '新资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
      })

      const asset = await db.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, result.id),
      })
      expect(asset?.status).toBe('in_use')
      expect(asset?.currentValueCents).toBe(100000)
    })

    it('应该拒绝重复的资产代码', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const existing = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '已存在',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(existing).execute()

      await expect(
        service.create({
          assetCode: 'ASSET001',
          name: '重复资产',
          category: '设备',
          purchaseDate: '2024-01-01',
          purchasePriceCents: 100000,
          currency: 'CNY',
        })
      ).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('应该更新资产信息', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '原名称',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(asset).execute()

      const originalUpdatedAt = asset.updatedAt
      await service.update(asset.id, {
        name: '新名称',
        category: '家具',
      })

      const updated = await db.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, asset.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.category).toBe('家具')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('应该记录状态变更日志', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(asset).execute()

      await service.update(asset.id, {
        status: 'scrapped',
        createdBy: 'user123',
      })

      const changes = await db.query.fixedAssetChanges.findMany({
        where: eq(fixedAssetChanges.assetId, asset.id),
      })
      expect(changes).toHaveLength(1)
      expect(changes[0].fromStatus).toBe('in_use')
      expect(changes[0].toStatus).toBe('scrapped')
    })

    it('应该抛出错误当资产不存在', async () => {
      await expect(
        service.update('non-existent', {
          name: '新名称',
        })
      ).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('应该删除资产', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '删除资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(asset).execute()

      const result = await service.delete(asset.id)

      expect(result!.id).toBe(asset.id)
      expect(result!.name).toBe('删除资产')

      const deleted = await db.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, asset.id),
      })
      expect(deleted).toBeUndefined()
    })

    it('应该拒绝删除有折旧记录的资产', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const asset = {
        id: uuid(),
        assetCode: 'ASSET001',
        name: '有折旧的资产',
        category: '设备',
        purchaseDate: '2024-01-01',
        purchasePriceCents: 100000,
        currency: 'CNY',
        status: 'in_use',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(fixedAssets).values(asset).execute()

      const depreciation = {
        id: uuid(),
        assetId: asset.id,
        depreciationDate: '2024-01-01',
        depreciationAmountCents: 1000,
        accumulatedDepreciationCents: 1000,
        remainingValueCents: 99000,
        createdAt: Date.now(),
      }
      await db.insert(fixedAssetDepreciations).values(depreciation).execute()

      await expect(service.delete(asset.id)).rejects.toThrow()
    })

    it('应该抛出错误当资产不存在', async () => {
      await expect(service.delete('non-existent')).rejects.toThrow()
    })
  })
})
