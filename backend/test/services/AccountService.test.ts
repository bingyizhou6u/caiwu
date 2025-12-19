import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { AccountService } from '../../src/services/finance/AccountService.js'
import { accounts, currencies, cashFlows, categories, accountTransactions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { AppError } from '../../src/utils/errors.js'

describe('AccountService', () => {
  let service: AccountService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // 初始化数据库 schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new AccountService(db)
  })

  beforeEach(async () => {
    // 清理测试数据
    await db.delete(accountTransactions).execute()
    await db.delete(cashFlows).execute()
    await db.delete(accounts).execute()
    await db.delete(currencies).execute()

    // 插入默认币种
    await db
      .insert(currencies)
      .values([
        { code: 'CNY', name: '人民币', active: 1 },
        { code: 'USD', name: '美元', active: 1 },
        { code: 'INACTIVE', name: '停用币种', active: 0 },
      ])
      .execute()
  })

  describe('getAccounts', () => {
    it('应该返回所有账户', async () => {
      await db
        .insert(accounts)
        .values([
          { id: uuid(), name: '工商银行', type: 'bank', currency: 'CNY', active: 1 },
          { id: uuid(), name: '招商银行', type: 'bank', currency: 'CNY', active: 1 },
        ])
        .execute()

      const result = await service.getAccounts()

      expect(result).toHaveLength(2)
      expect(result.map(a => a.name)).toContain('工商银行')
      expect(result.map(a => a.name)).toContain('招商银行')
    })

    it('应该按名称排序', async () => {
      await db
        .insert(accounts)
        .values([
          { id: uuid(), name: 'B账户', type: 'bank', currency: 'CNY', active: 1 },
          { id: uuid(), name: 'A账户', type: 'bank', currency: 'CNY', active: 1 },
        ])
        .execute()

      const result = await service.getAccounts()

      expect(result[0].name).toBe('A账户')
      expect(result[1].name).toBe('B账户')
    })

    it('应该支持搜索', async () => {
      await db
        .insert(accounts)
        .values([
          { id: uuid(), name: '工商银行', type: 'bank', currency: 'CNY', alias: 'ICBC', active: 1 },
          { id: uuid(), name: '招商银行', type: 'bank', currency: 'CNY', accountNumber: '123456', active: 1 },
          { id: uuid(), name: '建设银行', type: 'bank', currency: 'CNY', active: 1 },
        ])
        .execute()

      // 按名称搜索
      const result1 = await service.getAccounts('工商')
      expect(result1).toHaveLength(1)
      expect(result1[0].name).toBe('工商银行')

      // 按别名搜索
      const result2 = await service.getAccounts('icbc')
      expect(result2).toHaveLength(1)
      expect(result2[0].alias).toBe('ICBC')

      // 按账号搜索
      const result3 = await service.getAccounts('123456')
      expect(result3).toHaveLength(1)
      expect(result3[0].accountNumber).toBe('123456')
    })

    it('应该返回币种名称', async () => {
      await db
        .insert(accounts)
        .values({ id: uuid(), name: '测试账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      const result = await service.getAccounts()

      expect(result[0].currencyName).toBe('人民币')
    })
  })

  describe('createAccount', () => {
    it('应该创建新账户', async () => {
      const data = {
        name: '新建账户',
        type: 'bank',
        currency: 'CNY',
        alias: 'TEST',
        accountNumber: '9876543210',
        openingCents: 100000,
      }

      const result = await service.createAccount(data)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('新建账户')
      expect(result.currency).toBe('CNY')

      // 验证数据库记录
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, result.id),
      })
      expect(account?.name).toBe('新建账户')
      expect(account?.openingCents).toBe(100000)
    })

    it('应该使用默认币种 CNY', async () => {
      const result = await service.createAccount({
        name: '默认币种账户',
        type: 'cash',
      })

      expect(result.currency).toBe('CNY')
    })

    it('应该设置默认期初余额为 0', async () => {
      const result = await service.createAccount({
        name: '零余额账户',
        type: 'bank',
      })

      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, result.id),
      })
      expect(account?.openingCents).toBe(0)
    })

    it('应该拒绝无效的币种', async () => {
      await expect(
        service.createAccount({
          name: '无效币种账户',
          type: 'bank',
          currency: 'INVALID',
        })
      ).rejects.toThrow('不存在')
    })

    it('应该拒绝停用的币种', async () => {
      await expect(
        service.createAccount({
          name: '停用币种账户',
          type: 'bank',
          currency: 'INACTIVE',
        })
      ).rejects.toThrow('不存在')
    })
  })

  describe('updateAccount', () => {
    it('应该更新账户信息', async () => {
      const id = uuid()
      await db
        .insert(accounts)
        .values({ id, name: '原名称', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      const result = await service.updateAccount(id, {
        name: '新名称',
        alias: '新别名',
      })

      expect(result.ok).toBe(true)

      const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) })
      expect(account?.name).toBe('新名称')
      expect(account?.alias).toBe('新别名')
    })

    it('应该支持更新币种', async () => {
      const id = uuid()
      await db
        .insert(accounts)
        .values({ id, name: '测试账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      await service.updateAccount(id, { currency: 'usd' }) // 测试大小写处理

      const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) })
      expect(account?.currency).toBe('USD')
    })

    it('应该拒绝更新为无效币种', async () => {
      const id = uuid()
      await db
        .insert(accounts)
        .values({ id, name: '测试账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      await expect(service.updateAccount(id, { currency: 'INVALID' })).rejects.toThrow('不存在')
    })

    it('应该拒绝空更新', async () => {
      const id = uuid()
      await db
        .insert(accounts)
        .values({ id, name: '测试账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      await expect(service.updateAccount(id, {})).rejects.toThrow('没有需要更新的字段')
    })
  })

  describe('deleteAccount', () => {
    it('应该删除账户', async () => {
      const id = uuid()
      await db
        .insert(accounts)
        .values({ id, name: '待删除账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()

      const result = await service.deleteAccount(id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('待删除账户')

      const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) })
      expect(account).toBeUndefined()
    })

    it('应该拒绝删除不存在的账户', async () => {
      await expect(service.deleteAccount('non-existent')).rejects.toThrow('不存在')
    })

    it('应该拒绝删除有流水记录的账户', async () => {
      const accountId = uuid()
      const categoryId = uuid()

      await db.insert(categories).values({ id: categoryId, name: '测试类别', kind: 'expense', active: 1 }).execute()
      await db
        .insert(accounts)
        .values({ id: accountId, name: '有流水账户', type: 'bank', currency: 'CNY', active: 1 })
        .execute()
      await db
        .insert(cashFlows)
        .values({
          id: uuid(),
          accountId,
          categoryId,
          type: 'expense',
          amountCents: 1000,
          bizDate: '2024-01-01',
          createdAt: Date.now(),
        })
        .execute()

      await expect(service.deleteAccount(accountId)).rejects.toThrow('无法删除')
    })
  })
})
