import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { cashFlows, accountTransactions, accounts } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { parseCsv } from '../../utils/csv.js'
import { FinanceService } from './FinanceService.js'
import { Errors } from '../../utils/errors.js'

export class ImportService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async importFlows(csvContent: string, userId: string) {
    const rows = parseCsv(csvContent)
    if (rows.length < 2) {
      throw Errors.VALIDATION_ERROR('CSV文件没有数据行')
    }

    const header = rows[0].map(h => h.toLowerCase())
    const data = rows.slice(1)

    const idx = (name: string) => header.indexOf(name)
    const ix = {
      biz_date: idx('biz_date'),
      type: idx('type'),
      account_id: idx('account_id'),
      amount: idx('amount'),
      site_id: idx('site_id'),
      project_id: idx('project_id'),
      counterparty: idx('counterparty'),
      memo: idx('memo'),
      category_id: idx('category_id'),
      voucher_no: idx('voucher_no'),
      method: idx('method'),
    }

    // 验证必要表头
    if (ix.biz_date === -1 || ix.type === -1 || ix.account_id === -1 || ix.amount === -1) {
      throw Errors.VALIDATION_ERROR('缺少必要列: biz_date, type, account_id, amount')
    }

    // 按日期排序以确保余额计算正确
    const sortedData = [...data].sort((a, b) => {
      const dateA = a[ix.biz_date] || ''
      const dateB = b[ix.biz_date] || ''
      if (dateA !== dateB) {return dateA.localeCompare(dateB)}
      return 0
    })

    let inserted = 0
    const financeService = new FinanceService(this.db)

    // 分块处理或逐个处理。为了简单和余额计算，逐个处理更安全。
    // 我们对整批数据使用一个事务
    await this.db.transaction(async tx => {
      // 使用 tx 重新实例化财务服务
      // 注意：FinanceService 需要兼容 tx。
      // 目前 FinanceService 在构造函数中接收 db。我们可能需要将 tx 传递给它或用 tx 实例化它。
      // 假设我们可以用 tx 实例化，因为它主要匹配 DrizzleD1Database 接口。
      const txFinanceService = new FinanceService(tx as any)

      for (const r of sortedData) {
        if (!r[ix.biz_date] || !r[ix.type] || !r[ix.account_id] || !r[ix.amount]) {continue}

        const id = uuid()
        const amount = Math.round(Number(r[ix.amount]) * 100)
        // 使用递增时间戳以保持同一毫秒内的顺序
        const now = Date.now() + inserted

        // 计算之前的余额
        const balanceBefore = await txFinanceService.getAccountBalanceBefore(
          r[ix.account_id],
          r[ix.biz_date],
          now
        )

        // 计算之后的余额
        const delta = r[ix.type] === 'income' ? amount : r[ix.type] === 'expense' ? -amount : 0
        const balanceAfter = balanceBefore + delta

        // 插入现金流水
        await tx
          .insert(cashFlows)
          .values({
            id,
            voucherNo: r[ix.voucher_no] || null,
            bizDate: r[ix.biz_date],
            type: r[ix.type] as 'income' | 'expense' | 'transfer_out' | 'transfer_in',
            accountId: r[ix.account_id],
            categoryId: r[ix.category_id] || null,
            method: r[ix.method] || null,
            amountCents: amount,
            siteId: r[ix.site_id] || null,
            projectId: r[ix.project_id] || null,
            counterparty: r[ix.counterparty] || null,
            memo: r[ix.memo] || null,
            createdBy: 'import',
            createdAt: now,
          })
          .run()

        // 插入交易记录
        const transactionId = uuid()
        await tx
          .insert(accountTransactions)
          .values({
            id: transactionId,
            accountId: r[ix.account_id],
            flowId: id,
            transactionDate: r[ix.biz_date],
            transactionType: r[ix.type] as 'income' | 'expense' | 'transfer_out' | 'transfer_in',
            amountCents: amount,
            balanceBeforeCents: balanceBefore,
            balanceAfterCents: balanceAfter,
            createdAt: now,
          })
          .run()

        inserted++
      }
    })

    return { inserted }
  }
}
