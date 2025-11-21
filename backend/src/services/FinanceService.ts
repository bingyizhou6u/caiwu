export class FinanceService {
    constructor(private db: D1Database) { }

    // 计算账户当前余额（账变前金额）
    async getAccountBalanceBefore(accountId: string, transactionDate: string, transactionTime: number): Promise<number> {
        // 期初余额
        const ob = await this.db.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
            .bind(accountId).first<{ ob: number }>()

        // 计算账变前的所有交易
        // 需要考虑同一天的情况：只计算在此交易时间之前的交易
        const pre = await this.db.prepare(`
      select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
      from cash_flows 
      where account_id=? 
      and (biz_date < ? or (biz_date = ? and created_at < ?))
    `).bind(accountId, transactionDate, transactionDate, transactionTime).first<{ s: number }>()

        return (ob?.ob ?? 0) + (pre?.s ?? 0)
    }
}
