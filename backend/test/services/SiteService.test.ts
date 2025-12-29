import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { SiteService } from '../../src/services/system/SiteService.js'
import { sites, projects } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('SiteService', () => {
  let service: SiteService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new SiteService(db)
  })

  beforeEach(async () => {
    await db.delete(sites).execute()
    await db.delete(projects).execute()
  })

  describe('getSites', () => {
    it('应该返回所有站点及其项目信息', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site1 = {
        id: uuid(),
        projectId: dept.id,
        name: '站点1',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const site2 = {
        id: uuid(),
        projectId: dept.id,
        name: '站点2',
        siteCode: 'SITE002',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values([site1, site2]).execute()

      const result = await service.getSites()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('站点1')
      expect(result[0].projectName).toBe('测试项目')
      expect(result[1].name).toBe('站点2')
    })

    it('应该按名称排序', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site1 = {
        id: uuid(),
        projectId: dept.id,
        name: 'B站点',
        siteCode: 'SITE002',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const site2 = {
        id: uuid(),
        projectId: dept.id,
        name: 'A站点',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values([site1, site2]).execute()

      const result = await service.getSites()

      expect(result[0].name).toBe('A站点')
      expect(result[1].name).toBe('B站点')
    })
  })

  describe('createSite', () => {
    it('应该创建新站点', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const result = await service.createSite({
        name: '新站点',
        projectId: dept.id,
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('新站点')
      expect(result.projectId).toBe(dept.id)

      const site = await db.query.sites.findFirst({
        where: eq(sites.id, result.id),
      })
      expect(site).toBeDefined()
      expect(site?.active).toBe(1)
    })

    it('应该拒绝重复的站点名称（同一项目）', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const existing = {
        id: uuid(),
        projectId: dept.id,
        name: '已存在站点',
        siteCode: 'EXISTING',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(existing).execute()

      await expect(
        service.createSite({
          name: '已存在站点',
          projectId: dept.id,
        })
      ).rejects.toThrow()
    })

    it('应该允许不同项目使用相同站点名称', async () => {
      const dept1 = {
        id: uuid(),
        hqId: 'hq',
        name: '项目1',
        code: 'PROJ001',
        active: 1,
      }
      const dept2 = {
        id: uuid(),
        hqId: 'hq',
        name: '项目2',
        code: 'PROJ002',
        active: 1,
      }
      await db.insert(projects).values([dept1, dept2]).execute()

      const site1 = {
        id: uuid(),
        projectId: dept1.id,
        name: '相同名称',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(site1).execute()

      const result = await service.createSite({
        name: '相同名称',
        projectId: dept2.id,
      })

      expect(result.name).toBe('相同名称')
      expect(result.projectId).toBe(dept2.id)
    })
  })

  describe('updateSite', () => {
    it('应该更新站点信息', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site = {
        id: uuid(),
        projectId: dept.id,
        name: '原名称',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(site).execute()

      const originalUpdatedAt = site.updatedAt
      await service.updateSite(site.id, {
        name: '新名称',
        projectId: dept.id,
      })

      const updated = await db.query.sites.findFirst({
        where: eq(sites.id, site.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('应该支持部分更新', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site = {
        id: uuid(),
        projectId: dept.id,
        name: '站点',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(site).execute()

      await service.updateSite(site.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.sites.findFirst({
        where: eq(sites.id, site.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.siteCode).toBe('SITE001') // 未更新的字段保持不变
    })

    it('应该可以停用站点', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site = {
        id: uuid(),
        projectId: dept.id,
        name: '站点',
        siteCode: 'SITE001',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(site).execute()

      await service.updateSite(site.id, {
        active: 0,
      })

      const updated = await db.query.sites.findFirst({
        where: eq(sites.id, site.id),
      })
      expect(updated?.active).toBe(0)
    })

    it('应该抛出错误当站点不存在', async () => {
      await expect(
        service.updateSite('non-existent', {
          name: '新名称',
        })
      ).rejects.toThrow()
    })
  })

  describe('deleteSite', () => {
    it('应该删除站点', async () => {
      const dept = {
        id: uuid(),
        hqId: 'hq',
        name: '测试项目',
        code: 'PROJ001',
        active: 1,
      }
      await db.insert(projects).values(dept).execute()

      const site = {
        id: uuid(),
        projectId: dept.id,
        name: '删除站点',
        siteCode: 'DELETE',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.insert(sites).values(site).execute()

      const result = await service.deleteSite(site.id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('删除站点')

      const deleted = await db.query.sites.findFirst({
        where: eq(sites.id, site.id),
      })
      expect(deleted).toBeUndefined()
    })

    it('应该抛出错误当站点不存在', async () => {
      await expect(service.deleteSite('non-existent')).rejects.toThrow()
    })
  })
})
