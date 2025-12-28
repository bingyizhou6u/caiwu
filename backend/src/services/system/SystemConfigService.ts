import { eq } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { systemConfig } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class SystemConfigService {
  private kv?: KVNamespace

  constructor(db: DrizzleD1Database<typeof schema>, kv?: KVNamespace) {
    this.db = db
    this.kv = kv
  }

  private db: DrizzleD1Database<typeof schema>

  /**
   * 获取配置项（优先从 KV 缓存读取）
   * TTL: 5 分钟
   */
  async get(key: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    // 优先从 KV 缓存读取
    if (this.kv) {
      try {
        const cached = await this.kv.get(`config:${key}`, 'json')
        if (cached !== null) {
          return cached as { key: string; value: any; description: string | null }
        }
      } catch {
        // KV 读取失败，降级到数据库
      }
    }

    const result = await query(
      this.db,
      'SystemConfigService.get',
      () => this.db.select().from(systemConfig).where(eq(systemConfig.key, key)).get(),
      c
    )
    if (!result) { return null }

    let parsed
    try {
      parsed = {
        ...result,
        value: JSON.parse(result.value),
      }
    } catch {
      parsed = result
    }

    // 写入 KV 缓存（5分钟 TTL）
    if (this.kv && parsed) {
      try {
        await this.kv.put(`config:${key}`, JSON.stringify(parsed), { expirationTtl: 300 })
      } catch {
        // 缓存写入失败，忽略
      }
    }

    return parsed
  }

  async getAll(c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const results = await query(
      this.db,
      'SystemConfigService.getAll',
      () => this.db.select().from(systemConfig).all(),
      c
    )
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

    // 更新缓存
    if (this.kv) {
      try {
        const cached = { key, value, description }
        await this.kv.put(`config:${key}`, JSON.stringify(cached), { expirationTtl: 300 })
      } catch {
        // 缓存写入失败，忽略
      }
    }
  }
}

