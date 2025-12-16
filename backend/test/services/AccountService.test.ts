import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { AccountService } from '../../src/services/AccountService.js'
import { accounts, currencies, cashFlows, accountTransactions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'
import { Errors } from '../../src/utils/errors.js'

describe('AccountService', () => {
  let service: AccountService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new AccountService(db)
  })

  beforeEach(async () => {
    await db.delete(accountTransactions).execute()
    await db.delete(cashFlows).execute()
    await db.delete(accounts).execute()
    await db.delete(currencies).execute()
  })

  describe('getAccounts', () => {
    it('应该返回所有账户及其币种信息', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account1 = {
        id: uuid(),
        name: '账户1',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      const account2 = {
        id: uuid(),
        name: '账户2',
        type: 'cash',
        currency: 'CNY',
        openingCents: 50000,
        active: 1,
      }
      await db.insert(accounts).values([account1, account2]).execute()

      const result = await service.getAccounts()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('账户1')
      expect(result[0].currencyName).toBe('人民币')
      expect(result[1].name).toBe('账户2')
    })

    it('应该支持搜索功能', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account1 = {
        id: uuid(),
        name: '中国银行账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      const account2 = {
        id: uuid(),
        name: '工商银行账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 50000,
        active: 1,
      }
      const account3 = {
        id: uuid(),
        name: '现金账户',
        type: 'cash',
        currency: 'CNY',
        openingCents: 0,
        active: 1,
      }
      await db.insert(accounts).values([account1, account2, account3]).execute()

      const result = await service.getAccounts('银行')

      expect(result).toHaveLength(2)
      expect(result.map(a => a.name)).toContain('中国银行账户')
      expect(result.map(a => a.name)).toContain('工商银行账户')
      expect(result.map(a => a.name)).not.toContain('现金账户')
    })

    it('应该按名称排序', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account1 = {
        id: uuid(),
        name: 'B账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 0,
        active: 1,
      }
      const account2 = {
        id: uuid(),
        name: 'A账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 0,
        active: 1,
      }
      await db.insert(accounts).values([account1, account2]).execute()

      const result = await service.getAccounts()

      expect(result[0].name).toBe('A账户')
      expect(result[1].name).toBe('B账户')
    })
  })

  describe('getAccountTransactions', () => {
    it('应该返回账户交易记录', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '测试账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      const flow1 = {
        id: uuid(),
        accountId: account.id,
        type: 'income',
        amountCents: 50000,
        transactionDate: '2024-01-01',
        voucherNo: 'V001',
        createdAt: Date.now(),
      }
      const flow2 = {
        id: uuid(),
        accountId: account.id,
        type: 'expense',
        amountCents: 20000,
        transactionDate: '2024-01-02',
        voucherNo: 'V002',
        createdAt: Date.now(),
      }
      await db.insert(cashFlows).values([flow1, flow2]).execute()

      const trans1 = {
        id: uuid(),
        accountId: account.id,
        flowId: flow1.id,
        transactionDate: '2024-01-01',
        transactionType: 'income',
        amountCents: 50000,
        balanceBeforeCents: 100000,
        balanceAfterCents: 150000,
        createdAt: Date.now(),
      }
      const trans2 = {
        id: uuid(),
        accountId: account.id,
        flowId: flow2.id,
        transactionDate: '2024-01-02',
        transactionType: 'expense',
        amountCents: 20000,
        balanceBeforeCents: 150000,
        balanceAfterCents: 130000,
        createdAt: Date.now(),
      }
      await db.insert(accountTransactions).values([trans1, trans2]).execute()

      const result = await service.getAccountTransactions(account.id, 1, 20)

      expect(result.total).toBe(2)
      expect(result.list).toHaveLength(2)
      expect(result.list[0].voucherNo).toBe('V002') // 按日期倒序
      expect(result.list[1].voucherNo).toBe('V001')
    })

    it('应该支持分页', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '测试账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      // 创建多条交易记录
      const flows = []
      const transactions = []
      for (let i = 0; i < 25; i++) {
        const flowId = uuid()
        flows.push({
          id: flowId,
          accountId: account.id,
          type: 'income',
          amountCents: 1000,
          transactionDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
          voucherNo: `V${String(i + 1).padStart(3, '0')}`,
          createdAt: Date.now() + i,
        })
        transactions.push({
          id: uuid(),
          accountId: account.id,
          flowId: flowId,
          transactionDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
          transactionType: 'income',
          amountCents: 1000,
          balanceBeforeCents: 100000 + i * 1000,
          balanceAfterCents: 100000 + (i + 1) * 1000,
          createdAt: Date.now() + i,
        })
      }
      await db.insert(cashFlows).values(flows).execute()
      await db.insert(accountTransactions).values(transactions).execute()

      const page1 = await service.getAccountTransactions(account.id, 1, 10)
      expect(page1.total).toBe(25)
      expect(page1.list).toHaveLength(10)

      const page2 = await service.getAccountTransactions(account.id, 2, 10)
      expect(page2.list).toHaveLength(10)

      const page3 = await service.getAccountTransactions(account.id, 3, 10)
      expect(page3.list).toHaveLength(5)
    })
  })

  describe('createAccount', () => {
    it('应该创建新账户', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.createAccount({
        name: '新账户',
        type: 'bank',
        currency: 'CNY',
        alias: '别名',
        accountNumber: '1234567890',
        openingCents: 100000,
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('新账户')
      expect(result.currency).toBe('CNY')

      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, result.id),
      })
      expect(account).toBeDefined()
      expect(account?.active).toBe(1)
      expect(account?.openingCents).toBe(100000)
    })

    it('应该使用默认币种 CNY', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.createAccount({
        name: '默认币种账户',
        type: 'bank',
      })

      expect(result.currency).toBe('CNY')
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, result.id),
      })
      expect(account?.currency).toBe('CNY')
    })

    it('应该自动转换为大写币种代码', async () => {
      const currency = {
        code: 'USD',
        name: '美元',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const result = await service.createAccount({
        name: '美元账户',
        type: 'bank',
        currency: 'usd', // 小写
      })

      expect(result.currency).toBe('USD')
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, result.id),
      })
      expect(account?.currency).toBe('USD')
    })

    it('应该抛出错误当币种不存在', async () => {
      await expect(
        service.createAccount({
          name: '账户',
          type: 'bank',
          currency: 'INVALID',
        })
      ).rejects.toThrow(Errors.NOT_FOUND)
    })

    it('应该抛出错误当币种已停用', async () => {
      const currency = {
        code: 'INACTIVE',
        name: '停用币种',
        active: 0, // 停用
      }
      await db.insert(currencies).values(currency).execute()

      await expect(
        service.createAccount({
          name: '账户',
          type: 'bank',
          currency: 'INACTIVE',
        })
      ).rejects.toThrow(Errors.NOT_FOUND)
    })
  })

  describe('updateAccount', () => {
    it('应该更新账户信息', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '原名称',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await service.updateAccount(account.id, {
        name: '新名称',
        alias: '新别名',
      })

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, account.id),
      })
      expect(updated?.name).toBe('新名称')
      expect(updated?.alias).toBe('新别名')
    })

    it('应该支持部分更新', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await service.updateAccount(account.id, {
        name: '更新后的名称',
      })

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, account.id),
      })
      expect(updated?.name).toBe('更新后的名称')
      expect(updated?.type).toBe('bank') // 未更新的字段保持不变
    })

    it('应该可以更新币种', async () => {
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

      const account = {
        id: uuid(),
        name: '账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await service.updateAccount(account.id, {
        currency: 'USD',
      })

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, account.id),
      })
      expect(updated?.currency).toBe('USD')
    })

    it('应该可以停用账户', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await service.updateAccount(account.id, {
        active: 0,
      })

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, account.id),
      })
      expect(updated?.active).toBe(0)
    })

    it('应该抛出错误当没有更新字段', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      await expect(service.updateAccount(account.id, {})).rejects.toThrow(Errors.VALIDATION_ERROR)
    })
  })

  describe('deleteAccount', () => {
    it('应该删除账户', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '删除账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      const result = await service.deleteAccount(account.id)

      expect(result.ok).toBe(true)
      expect(result.name).toBe('删除账户')

      const deleted = await db.query.accounts.findFirst({
        where: eq(accounts.id, account.id),
      })
      expect(deleted).toBeUndefined()
    })

    it('应该拒绝删除有流水记录的账户', async () => {
      const currency = {
        code: 'CNY',
        name: '人民币',
        active: 1,
      }
      await db.insert(currencies).values(currency).execute()

      const account = {
        id: uuid(),
        name: '有流水的账户',
        type: 'bank',
        currency: 'CNY',
        openingCents: 100000,
        active: 1,
      }
      await db.insert(accounts).values(account).execute()

      const flow = {
        id: uuid(),
        accountId: account.id,
        type: 'income',
        amountCents: 50000,
        transactionDate: '2024-01-01',
        createdAt: Date.now(),
      }
      await db.insert(cashFlows).values(flow).execute()

      await expect(service.deleteAccount(account.id)).rejects.toThrow(Errors.BUSINESS_ERROR)
    })

    it('应该抛出错误当账户不存在', async () => {
      await expect(service.deleteAccount('non-existent')).rejects.toThrow(Errors.NOT_FOUND)
    })
  })
})
