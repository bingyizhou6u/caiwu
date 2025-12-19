import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { CurrencyService } from '../../src/services/system/CurrencyService.js'
import { currencies, accounts } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { AppError } from '../../src/utils/errors.js'
import { v4 as uuid } from 'uuid'

describe('CurrencyService', () => {
  let service: CurrencyService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // 初始化数据库 schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new CurrencyService(db)
  })

  beforeEach(async () => {
    // 清理测试数据
    await db.delete(accounts).execute()
    await db.delete(currencies).execute()
  })

  describe('getCurrencies', () => {
    it('应该返回所有币种', async () => {
      await db
        .insert(currencies)
        .values([
          { code: 'CNY', name: '人民币', active: 1 },
          { code: 'USD', name: '美元', active: 1 },
          { code: 'EUR', name: '欧元', active: 1 },
        ])
        .execute()

      const result = await service.getCurrencies()

      expect(result).toHaveLength(3)
      expect(result.map(c => c.code)).toContain('CNY')
      expect(result.map(c => c.code)).toContain('USD')
      expect(result.map(c => c.code)).toContain('EUR')
    })

    it('应该按代码排序', async () => {
      await db
        .insert(currencies)
        .values([
          { code: 'USD', name: '美元', active: 1 },
          { code: 'CNY', name: '人民币', active: 1 },
          { code: 'EUR', name: '欧元', active: 1 },
        ])
        .execute()

      const result = await service.getCurrencies()

      expect(result[0].code).toBe('CNY')
      expect(result[1].code).toBe('EUR')
      expect(result[2].code).toBe('USD')
    })

    it('应该支持按代码搜索', async () => {
      await db
        .insert(currencies)
        .values([
          { code: 'CNY', name: '人民币', active: 1 },
          { code: 'USD', name: '美元', active: 1 },
        ])
        .execute()

      const result = await service.getCurrencies('cny')

      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('CNY')
    })

    it('应该支持按名称搜索', async () => {
      await db
        .insert(currencies)
        .values([
          { code: 'CNY', name: '人民币', active: 1 },
          { code: 'USD', name: '美元', active: 1 },
        ])
        .execute()

      const result = await service.getCurrencies('人民')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('人民币')
    })
  })

  describe('createCurrency', () => {
    it('应该创建新币种', async () => {
      const result = await service.createCurrency({
        code: 'JPY',
        name: '日元',
      })

      expect(result.code).toBe('JPY')
      expect(result.name).toBe('日元')

      // 验证数据库记录
      const currency = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'JPY'),
      })
      expect(currency?.name).toBe('日元')
      expect(currency?.active).toBe(1)
    })

    it('应该将代码转换为大写', async () => {
      const result = await service.createCurrency({
        code: 'gbp',
        name: '英镑',
      })

      expect(result.code).toBe('GBP')

      const currency = await db.query.currencies.findFirst({
        where: eq(currencies.code, 'GBP'),
      })
      expect(currency).toBeDefined()
    })

    it('应该拒绝重复的币种代码', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      await expect(
        service.createCurrency({
          code: 'CNY',
          name: '重复币种',
        })
      ).rejects.toThrow('已存在')
    })

    it('应该拒绝重复的币种代码（大小写不敏感）', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      await expect(
        service.createCurrency({
          code: 'cny',
          name: '重复币种',
        })
      ).rejects.toThrow('已存在')
    })
  })

  describe('updateCurrency', () => {
    it('应该更新币种信息', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      const result = await service.updateCurrency('CNY', {
        name: '中国人民币',
      })

      expect(result.ok).toBe(true)

      const currency = await db.query.currencies.findFirst({ where: eq(currencies.code, 'CNY') })
      expect(currency?.name).toBe('中国人民币')
    })

    it('应该支持停用币种', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      await service.updateCurrency('CNY', { active: 0 })

      const currency = await db.query.currencies.findFirst({ where: eq(currencies.code, 'CNY') })
      expect(currency?.active).toBe(0)
    })

    it('应该处理大小写', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      await service.updateCurrency('cny', { name: '更新后名称' })

      const currency = await db.query.currencies.findFirst({ where: eq(currencies.code, 'CNY') })
      expect(currency?.name).toBe('更新后名称')
    })

    it('空更新应该返回成功', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()

      const result = await service.updateCurrency('CNY', {})

      expect(result.ok).toBe(true)
    })
  })

  describe('deleteCurrency', () => {
    it('应该删除币种', async () => {
      await db.insert(currencies).values({ code: 'TEST', name: '测试币种', active: 1 }).execute()

      const result = await service.deleteCurrency('TEST')

      expect(result.ok).toBe(true)
      expect(result.name).toBe('测试币种')

      const currency = await db.query.currencies.findFirst({ where: eq(currencies.code, 'TEST') })
      expect(currency).toBeUndefined()
    })

    it('应该处理大小写', async () => {
      await db.insert(currencies).values({ code: 'TEST', name: '测试币种', active: 1 }).execute()

      const result = await service.deleteCurrency('test')

      expect(result.ok).toBe(true)
    })

    it('应该拒绝删除不存在的币种', async () => {
      await expect(service.deleteCurrency('INVALID')).rejects.toThrow('不存在')
    })

    it('应该拒绝删除有账户使用的币种', async () => {
      await db.insert(currencies).values({ code: 'CNY', name: '人民币', active: 1 }).execute()
      await db.insert(accounts).values({ id: uuid(), name: '测试账户', type: 'bank', currency: 'CNY', active: 1 }).execute()

      await expect(service.deleteCurrency('CNY')).rejects.toThrow('无法删除')
    })
  })
})
