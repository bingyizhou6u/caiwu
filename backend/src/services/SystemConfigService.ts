import { eq } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { systemConfig } from '../db/schema.js'
import * as schema from '../db/schema.js'

export class SystemConfigService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async get(key: string) {
    const result = await this.db.select().from(systemConfig).where(eq(systemConfig.key, key)).get()
    if (!result) {return null}

    try {
      return {
        ...result,
        value: JSON.parse(result.value),
      }
    } catch {
      return result
    }
  }

  async getAll() {
    const results = await this.db.select().from(systemConfig).all()
    return results.map(row => {
      try {
        return {
          ...row,
          value: JSON.parse(row.value),
        }
      } catch {
        return row
      }
    })
  }

  async set(key: string, value: any, description: string | null, userId: string) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
    const now = Date.now()

    await this.db
      .insert(systemConfig)
      .values({
        key,
        value: valueStr,
        description,
        updatedAt: now,
        updatedBy: userId,
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: valueStr,
          description,
          updatedAt: now,
          updatedBy: userId,
        },
      })
  }
}
