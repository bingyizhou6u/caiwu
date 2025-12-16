import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { SystemConfigService } from '../../src/services/SystemConfigService'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema'
import { systemConfig } from '../../src/db/schema' // Import the table definition
import { createDb } from '../../src/utils/db'
import { eq } from 'drizzle-orm'

describe('SystemConfigService', () => {
  let service: SystemConfigService
  let db: any

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = createDb(env.DB)
    service = new SystemConfigService(db)
  })

  beforeEach(async () => {
    // Use delete directly on the table object
    await db.delete(systemConfig).execute()
  })

  it('should set and get a config value', async () => {
    const key = 'test_key'
    const value = { foo: 'bar' }
    const description = 'Test config'
    const userId = 'user1'

    await service.set(key, value, description, userId)

    const result = await service.get(key)
    expect(result).toBeDefined()
    expect(result?.key).toBe(key)
    expect(result?.value).toEqual(value) // Should be parsed back to object
    expect(result?.description).toBe(description)
    expect(result?.updatedBy).toBe(userId)
  })

  it('should update an existing config value', async () => {
    const key = 'update_key'
    const initialValue = 'initial'
    const userId = 'user1'

    await service.set(key, initialValue, null, userId)

    const newValue = 'updated'
    await service.set(key, newValue, 'Updated desc', userId)

    const result = await service.get(key)
    expect(result?.value).toBe(newValue)
    expect(result?.description).toBe('Updated desc')
  })

  it('should return null for non-existent key', async () => {
    const result = await service.get('non_existent')
    expect(result).toBeNull()
  })

  it('should get all configs', async () => {
    await service.set('key1', 'val1', null, 'u1')
    await service.set('key2', { obj: true }, null, 'u1')

    const results = await service.getAll()
    expect(results.length).toBe(2)

    const k1 = results.find(r => r.key === 'key1')
    const k2 = results.find(r => r.key === 'key2')

    expect(k1?.value).toBe('val1')
    expect(k2?.value).toEqual({ obj: true })
  })

  it('should handle raw string values gracefully when parsing', async () => {
    // Directly insert a non-JSON string into DB (simulating legacy data or plain strings)
    // Though service.set wraps generic strings in JSON.stringify if object,
    // let's test if we insert a plain string that looks like json but isn't, or just a simple string.
    // Actually the service.set logic: typeof value === 'string' ? value : JSON.stringify(value)
    // So if I pass "some string", it saves "some string".
    // get logic: try { JSON.parse } catch { return result }
    // JSON.parse("some string") throws SyntaxError. So it should return the string as is.

    const key = 'raw_string'
    const value = 'just a string'
    await service.set(key, value, null, 'u1')

    const result = await service.get(key)
    expect(result?.value).toBe(value)
  })
})
