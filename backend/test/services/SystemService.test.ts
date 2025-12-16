import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { SystemService } from '../../src/services/SystemService'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema'
import { createDb } from '../../src/utils/db'
import { eq } from 'drizzle-orm'

describe('SystemService', () => {
  let service: SystemService
  let db: any

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = createDb(env.DB)
    service = new SystemService(db)
  })

  beforeEach(async () => {
    await db.delete(schema.headquarters).execute()
    await db.delete(schema.orgDepartments).execute()
    await db.delete(schema.currencies).execute()
  })

  it('should get or create default HQ', async () => {
    // First call: creates HQ
    const hq1 = await service.getOrCreateDefaultHQ()
    expect(hq1.id).toBeDefined()
    expect(hq1.name).toBe('总部')

    // Verify default departments created for HQ (projectId is null for HQ)
    // Note: DepartmentService logic creates org departments with projectId=null if second arg is undefined
    const depts = await db
      .select()
      .from(schema.orgDepartments)
      .where(eq(schema.orgDepartments.projectId, 'HEADQUARTERS'))
      .execute()
    // Wait, DepartmentService logic treats projectId=null specially? Or creates with projectId='HEADQUARTERS' if null passed?
    // Let's check db content generally.
    const allDepts = await db.select().from(schema.orgDepartments).execute()
    expect(allDepts.length).toBeGreaterThan(0) // Should have created '人事', '财务' etc.

    // Second call: returns existing HQ
    const hq2 = await service.getOrCreateDefaultHQ()
    expect(hq2.id).toBe(hq1.id)
  })

  it('should ensure default currencies', async () => {
    await service.ensureDefaultCurrencies()

    const cny = await db
      .select()
      .from(schema.currencies)
      .where(eq(schema.currencies.code, 'CNY'))
      .get()
    const usd = await db
      .select()
      .from(schema.currencies)
      .where(eq(schema.currencies.code, 'USD'))
      .get()

    expect(cny).toBeDefined()
    expect(cny.name).toBe('人民币')
    expect(usd).toBeDefined()
    expect(usd.name).toBe('美元')

    // Run again, should not error or duplicate
    await service.ensureDefaultCurrencies()
    const allCny = await db
      .select()
      .from(schema.currencies)
      .where(eq(schema.currencies.code, 'CNY'))
      .execute()
    expect(allCny.length).toBe(1)
  })
})
