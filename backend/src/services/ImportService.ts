import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { cashFlows, accountTransactions, accounts } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { parseCsv } from '../utils/csv.js'
import { FinanceService } from './FinanceService.js'

export class ImportService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async importFlows(csvContent: string, userId: string) {
        const rows = parseCsv(csvContent)
        if (rows.length < 2) throw new Error('没有数据行')

        const header = rows[0].map(h => h.toLowerCase())
        const data = rows.slice(1)

        const idx = (name: string) => header.indexOf(name)
        const ix = {
            biz_date: idx('biz_date'),
            type: idx('type'),
            account_id: idx('account_id'),
            amount: idx('amount'),
            site_id: idx('site_id'),
            department_id: idx('department_id'),
            counterparty: idx('counterparty'),
            memo: idx('memo'),
            category_id: idx('category_id'),
            voucher_no: idx('voucher_no'),
            method: idx('method')
        }

        // Validate required headers
        if (ix.biz_date === -1 || ix.type === -1 || ix.account_id === -1 || ix.amount === -1) {
            throw new Error('缺少必要列: biz_date, type, account_id, amount')
        }

        // Sort by date to ensure correct balance calculation
        const sortedData = [...data].sort((a, b) => {
            const dateA = a[ix.biz_date] || ''
            const dateB = b[ix.biz_date] || ''
            if (dateA !== dateB) return dateA.localeCompare(dateB)
            return 0
        })

        let inserted = 0
        const financeService = new FinanceService(this.db)

        // Process in chunks or one by one. For simplicity and balance calculation, one by one is safer.
        // We use a transaction for the whole batch
        await this.db.transaction(async (tx) => {
            // Re-instantiate finance service with tx
            // Note: FinanceService needs to be compatible with tx. 
            // Currently FinanceService takes db in constructor. We might need to pass tx to it or instantiate it with tx.
            // Assuming we can instantiate with tx as it matches DrizzleD1Database interface mostly.
            const txFinanceService = new FinanceService(tx as any)

            for (const r of sortedData) {
                if (!r[ix.biz_date] || !r[ix.type] || !r[ix.account_id] || !r[ix.amount]) continue

                const id = uuid()
                const amount = Math.round(Number(r[ix.amount]) * 100)
                // Use incrementing timestamp to preserve order within same ms
                const now = Date.now() + inserted

                // Calculate balance before
                const balanceBefore = await txFinanceService.getAccountBalanceBefore(r[ix.account_id], r[ix.biz_date], now)

                // Calculate balance after
                const delta = r[ix.type] === 'income' ? amount : (r[ix.type] === 'expense' ? -amount : 0)
                const balanceAfter = balanceBefore + delta

                // Insert cash flow
                await tx.insert(cashFlows).values({
                    id,
                    voucherNo: r[ix.voucher_no] || null,
                    bizDate: r[ix.biz_date],
                    type: r[ix.type] as 'income' | 'expense' | 'transfer_out' | 'transfer_in',
                    accountId: r[ix.account_id],
                    categoryId: r[ix.category_id] || null,
                    method: r[ix.method] || null,
                    amountCents: amount,
                    siteId: r[ix.site_id] || null,
                    departmentId: r[ix.department_id] || null,
                    counterparty: r[ix.counterparty] || null,
                    memo: r[ix.memo] || null,
                    createdBy: 'import',
                    createdAt: now
                }).run()

                // Insert transaction
                const transactionId = uuid()
                await tx.insert(accountTransactions).values({
                    id: transactionId,
                    accountId: r[ix.account_id],
                    flowId: id,
                    transactionDate: r[ix.biz_date],
                    transactionType: r[ix.type] as 'income' | 'expense' | 'transfer_out' | 'transfer_in',
                    amountCents: amount,
                    balanceBeforeCents: balanceBefore,
                    balanceAfterCents: balanceAfter,
                    createdAt: now
                }).run()

                inserted++
            }
        })

        return { inserted }
    }
}
