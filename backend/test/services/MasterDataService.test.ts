import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { env } from 'cloudflare:test'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { createDb } from '../../src/utils/db.js'
import { MasterDataService } from '../../src/services/system/MasterDataService.js'
import * as schema from '../../src/db/schema.js'
import schemaSql from '../../src/db/schema.sql?raw'

describe('MasterDataService', () => {
  let db: DrizzleD1Database<typeof schema>
  let service: MasterDataService

  beforeAll(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
  })

  beforeEach(async () => {
    db = createDb(env.DB)
    service = new MasterDataService(db)

    // Cleanup
    await db.delete(schema.departments).execute()
    await db.delete(schema.sites).execute()
    await db.delete(schema.accounts).execute()
    await db.delete(schema.vendors).execute()
    await db.delete(schema.currencies).execute()
    await db.delete(schema.categories).execute()
    await db.delete(schema.positions).execute()
    await db.delete(schema.orgDepartments).execute()
    await db.delete(schema.headquarters).execute()
  })

  describe('Departments', () => {
    it('should create and get departments', async () => {
      const dept = await service.createDepartment({ name: 'Test Dept', code: 'TD' })
      expect(dept.id).toBeDefined()
      expect(dept.name).toBe('Test Dept')

      const list = await service.getDepartments()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Test Dept')
    })

    it('should update department', async () => {
      const dept = await service.createDepartment({ name: 'Old Name' })
      await service.updateDepartment(dept.id, { name: 'New Name' })

      const list = await service.getDepartments()
      expect(list[0].name).toBe('New Name')
    })

    it('should delete department', async () => {
      const dept = await service.createDepartment({ name: 'To Delete' })
      await service.deleteDepartment(dept.id)

      const list = await service.getDepartments()
      expect(list.length).toBe(0)
    })
  })

  describe('Sites', () => {
    it('should create and get sites', async () => {
      const dept = await service.createDepartment({ name: 'Dept' })
      const site = await service.createSite({ name: 'Site 1', departmentId: dept.id })

      expect(site.id).toBeDefined()

      const list = await service.getSites()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Site 1')
      expect(list[0].departmentName).toBe('Dept')
    })
  })

  describe('Accounts', () => {
    it('should create and get accounts', async () => {
      await service.createCurrency({ code: 'CNY', name: 'Yuan' })
      const acc = await service.createAccount({
        name: 'Bank 1',
        type: 'bank',
        currency: 'CNY',
        openingCents: 1000,
      })

      expect(acc.id).toBeDefined()
      expect(acc.openingCents).toBe(1000)

      const list = await service.getAccounts()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Bank 1')
    })
  })

  describe('Vendors', () => {
    it('should create and get vendors', async () => {
      const vendor = await service.createVendor({ name: 'Vendor 1', contact: 'John' })
      expect(vendor.id).toBeDefined()

      const list = await service.getVendors()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Vendor 1')
    })
  })

  describe('Currencies', () => {
    it('should create and get currencies', async () => {
      await service.createCurrency({ code: 'USD', name: 'Dollar' })
      const list = await service.getCurrencies()
      expect(list.length).toBe(1)
      expect(list[0].code).toBe('USD')
    })
  })

  describe('Categories', () => {
    it('should create and get categories', async () => {
      const cat = await service.createCategory({ name: 'Food', kind: 'expense' })
      expect(cat.id).toBeDefined()

      const list = await service.getCategories()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Food')
    })
  })

  describe('Positions', () => {
    it('should get positions', async () => {
      // I will insert directly to DB to test get
      await db
        .insert(schema.positions)
        .values({
          id: 'pos1',
          code: 'P1',
          name: 'Dev',
          level: 2,
          functionRole: 'developer',
          active: 1,
        })
        .execute()

      const list = await service.getPositions()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Dev')
    })
  })

  describe('OrgDepartments', () => {
    it('should get org departments', async () => {
      // Insert manually as I didn't implement createOrgDepartment
      await db
        .insert(schema.orgDepartments)
        .values({
          id: 'od1',
          name: 'Tech',
          active: 1,
        })
        .execute()

      const list = await service.getOrgDepartments()
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Tech')
    })
  })
})
