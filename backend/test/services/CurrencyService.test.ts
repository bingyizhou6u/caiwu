import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { CurrencyService } from '../../src/services/CurrencyService.js'
import { currencies, accounts } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('CurrencyService', () => {
  let service: CurrencyService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new CurrencyService(db)
  })

  beforeEach(async () => {
    await db.delete(accounts).execute()
    await db.delete(currencies).execute()
  })

  describe('getCurrencies', () => {
    it('应该返回所有币种', async () => {
      const currency1 = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      const currency2 = {
        code: 'USD',
        name: '美元',
        active: 1,
      }
      await db.insert(currencies).values([currency1, currency2]).execute()

      const result = await service.getCurrencies()

      expect(result).toHaveLength(2)
      expect(result.map(c => c.code)).toContain('CNY')
      expect(result.map(c => c.code)).toContain('USD')
    })

    it('应该按代码排序', async () => {
      const currency1 = {
        code: 'USD',
        name: '美元',
        active: 1,
      }
      const currency2 = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values([currency1, currency2]).execute()

      const result = await service.getCurrencies()

      expect(result[0].code).toBe('CNY')
      expect(result[1].code).toBe('USD')
    })

    it('应该支持搜索功能（代码）', async () => {
      const currency1 = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      const currency2 = {
        code: 'USD',
        name: '美元',
        active: 1,
      }
      const currency3 = {
        code: 'EUR',
        name: '欧元',
        active: 1,
      }
      await db.insert(currencies).values([currency1, currency2, currency3]).execute()

      const result = await service.getCurrencies('CN')

      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('CNY')
    })

    it('应该支持搜索功能（名称）', async () => {
      const currency1 = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      const currency2 = {
        code: 'USD',
        name: '美元',
        active: 1,
      }
      await db.insert(currencies).values([currency1, currency2]).execute()

      const result = await service.getCurrencies('人民')

      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('CNY')
    })
  })

  describe('createCurrency', () => {
    it('应该创建新币种', async () => {
      const result = await service.createCurrency({
        code: 'EUR',
        name: '欧元',
      })

      expect(result.code).toBe('EUR')
      expect(result.name).toBe('欧元')

      const currency = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'EUR'),
      })
      expect(currency).toBeDefined()
      expect(currency?.active).toBe(1)
    })

    it('应该自动转换为大写代码', async () => {
      const result = await service.createCurrency({
        code: 'usd', // 小写
        name: '美元',
      })

      expect(result.code).toBe('USD')
      const currency = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'USD'),
      })
      expect(currency).toBeDefined()
    })

    it('应该拒绝重复的币种代码', async () => {
      const existing = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(existing).execute()

      await expect(
        service.createCurrency({
          code: 'CNY',
          name: '重复币种',
        })
      ).rejects.toThrow(Errors.DUPLICATE)
    })

    it('应该拒绝重复的币种代码（大小写不敏感）', async () => {
      const existing = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(existing).execute()

      await expect(
        service.createCurrency({
          code: 'cny', // 小写
          name: '重复币种',
        })
      ).rejects.toThrow(Errors.DUPLICATE)
    })
  })

  describe('updateCurrency', () => {
    it('应该更新币种信息', async () => {
      const currency = {
        code: 'CNY',
        name: '原名称',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      await service.updateCurrency('CNY', {
        name: '新名称',
      })

      const updated = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'CNY'),
      })
      expect(updated?.name).toBe('新名称')
    })

    it('应该支持部分更新', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      await service.updateCurrency('CNY', {
        name: '更新后的名称',
      })

      const updated = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'CNY'),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.active).toBe(1) // 未更新的字段保持不变
    })

    it('应该可以停用币种', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      await service.updateCurrency('CNY', {
        active: 0,
      })

      const updated = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'CNY'),
      })
      expect(updated?.active).toBe(0)
    })

    it('应该自动转换为大写代码', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      await service.updateCurrency('cny', {
        // 小写
        name: '新名称',
      })

      const updated = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'CNY'),
      })
      expect(updated?.name).toBe('新名称')
    })

    it('应该返回 ok 当没有更新字段', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.updateCurrency('CNY', {})

      expect(result.ok).toBe(true)
    })
  })

  describe('deleteCurrency', () => {
    it('应该删除币种', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.deleteCurrency('CNY')

      expect(result.ok).toBe(true)
      expect(result.name).toBe('人民币')

      const deleted = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'CNY'),
      })
      expect(deleted).toBeUndefined()
    })

    it('应该拒绝删除有账户使用的币种', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: 'account-id',
        name: '账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await expect(service.deleteCurrency('CNY')).rejects.toThrow(Errors.BUSINESS_ERROR)
    })

    it('应该抛出错误当币种不存在', async () => {
      await expect(service.deleteCurrency('NONEXISTENT')).rejects.toThrow(Errors.NOT_FOUND)
    })

    it('应该自动转换为大写代码', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.deleteCurrency('cny') // 小写

      expect(result.ok).toBe(true)
    })
  })
})
