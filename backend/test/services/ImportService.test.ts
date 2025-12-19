import { describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '../../src/services/finance/ImportService.js'
import { FinanceService } from '../../src/services/finance/FinanceService.js'
import { createDb } from '../../src/db/index.js'
import { applySchema } from '../setup.js'
import { accounts, cashFlows, accountTransactions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { env } from 'cloudflare:test'

describe('ImportService', () => {
  let db: ReturnType<typeof createDb>
  let importService: ImportService

  beforeEach(async () => {
    db = createDb(env.DB)
    // @ts-ignore
    db.transaction = async cb => cb(db)
    await applySchema(env.DB)
    importService = new ImportService(db)
  })

  it('should import flows from CSV', async () => {
    // Setup: Create an account
    const accountId = uuid()
    await db
      .insert(accounts)
      .values({
        id: accountId,
        name: 'Test Account',
        type: 'cash',
        currency: 'CNY',
        openingCents: 0,
        active: 1,
      })
      .run()

    const csv = `biz_date,type,account_id,amount,voucher_no,method,memo
2023-01-01,income,${accountId},100.00,V001,cash,Test Income
2023-01-02,expense,${accountId},50.00,V002,card,Test Expense`

    const result = await importService.importFlows(csv, 'test-user')
    expect(result.inserted).toBe(2)

    // Verify cash flows
    const flows = await db.select().from(cashFlows).orderBy(cashFlows.bizDate).all()
    expect(flows.length).toBe(2)
    expect(flows[0].amountCents).toBe(10000)
    expect(flows[0].type).toBe('income')
    expect(flows[1].amountCents).toBe(5000)
    expect(flows[1].type).toBe('expense')

    // Verify transactions and balances
    const txs = await db
      .select()
      .from(accountTransactions)
      .orderBy(accountTransactions.transactionDate)
      .all()
    expect(txs.length).toBe(2)

    // First transaction: 0 -> 100
    expect(txs[0].balanceBeforeCents).toBe(0)
    expect(txs[0].balanceAfterCents).toBe(10000)

    // Second transaction: 100 -> 50
    expect(txs[1].balanceBeforeCents).toBe(10000)
    expect(txs[1].balanceAfterCents).toBe(5000)
  })

  it('should throw error for invalid CSV', async () => {
    const csv = `invalid,csv`
    await expect(importService.importFlows(csv, 'test-user')).rejects.toThrow('没有数据行')
  })
})
