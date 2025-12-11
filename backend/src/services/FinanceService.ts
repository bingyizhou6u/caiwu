import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, inArray, gte, lte, aliasedTable } from 'drizzle-orm'
import {
    cashFlows,
    accountTransactions,
    accounts,
    categories,
    sites,
    departments,
    accountTransfers,
    arApDocs,
    settlements,
    borrowings,
    repayments,
    siteBills,
    employees,
    currencies
} from '../db/schema.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'

export class FinanceService {
    constructor(private db: DrizzleD1Database<any>) { }

    // --- Cash Flows ---

    async getNextVoucherNo(date: string) {
        const result = await this.db
            .select({ count: sql<number>`count(1)` })
            .from(cashFlows)
            .where(eq(cashFlows.bizDate, date))
            .get()

        const count = result?.count ?? 0
        const seq = (count + 1).toString().padStart(3, '0')
        const day = date.replace(/-/g, '')
        return `JZ${day}-${seq}`
    }

    async getAccountBalanceBefore(accountId: string, date: string, timestamp: number) {
        // 查找此日期/时间之前的最后一笔交易
        // 逻辑：transaction_date < date OR (transaction_date = date AND created_at < timestamp)
        // 按 transaction_date 降序, created_at 降序排列，取第一条
        // 如果找到，返回 balance_after_cents。如果未找到，返回 opening_cents。

        const lastTx = await this.db
            .select()
            .from(accountTransactions)
            .where(and(
                eq(accountTransactions.accountId, accountId),
                sql`(${accountTransactions.transactionDate} < ${date} OR (${accountTransactions.transactionDate} = ${date} AND ${accountTransactions.createdAt} < ${timestamp}))`
            ))
            .orderBy(desc(accountTransactions.transactionDate), desc(accountTransactions.createdAt))
            .limit(1)
            .get()

        if (lastTx) {
            return lastTx.balanceAfterCents
        }

        const account = await this.db
            .select()
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .get()

        return account?.openingCents ?? 0
    }

    async createCashFlow(data: {
        bizDate: string
        type: 'income' | 'expense'
        accountId: string
        amountCents: number
        categoryId?: string | null
        method?: string | null
        siteId?: string | null
        departmentId?: string | null
        counterparty?: string | null
        memo?: string | null
        voucherUrls?: string[]
        createdBy?: string
        voucherNo?: string
    }) {
        const id = uuid()
        const now = Date.now()
        const voucherNo = data.voucherNo ?? await this.getNextVoucherNo(data.bizDate)
        const voucherUrlJson = JSON.stringify(data.voucherUrls ?? [])

        // 计算之前的余额
        const balanceBefore = await this.getAccountBalanceBefore(data.accountId, data.bizDate, now)
        const delta = data.type === 'income' ? data.amountCents : -data.amountCents
        const balanceAfter = balanceBefore + delta

        await this.db.insert(cashFlows).values({
            id,
            voucherNo,
            bizDate: data.bizDate,
            type: data.type,
            accountId: data.accountId,
            categoryId: data.categoryId,
            method: data.method,
            amountCents: data.amountCents,
            siteId: data.siteId,
            departmentId: data.departmentId,
            counterparty: data.counterparty,
            memo: data.memo,
            voucherUrl: voucherUrlJson,
            createdBy: data.createdBy ?? 'system',
            createdAt: now
        }).execute()

        const transactionId = uuid()
        await this.db.insert(accountTransactions).values({
            id: transactionId,
            accountId: data.accountId,
            flowId: id,
            transactionDate: data.bizDate,
            transactionType: data.type,
            amountCents: data.amountCents,
            balanceBeforeCents: balanceBefore,
            balanceAfterCents: balanceAfter,
            createdAt: now
        }).execute()

        return { id, voucherNo }
    }

    async updateCashFlowVoucher(id: string, voucherUrls: string[]) {
        const voucherUrlJson = JSON.stringify(voucherUrls)
        await this.db.update(cashFlows)
            .set({ voucherUrl: voucherUrlJson })
            .where(eq(cashFlows.id, id))
            .execute()
    }

    async listCashFlows(limit: number = 200, whereClause?: any) {
        return await this.db
            .select({
                flow: cashFlows,
                accountName: accounts.name,
                categoryName: categories.name
            })
            .from(cashFlows)
            .leftJoin(accounts, eq(accounts.id, cashFlows.accountId))
            .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
            .where(whereClause)
            .orderBy(desc(cashFlows.bizDate), desc(cashFlows.createdAt))
            .limit(limit)
            .execute()
    }

    async listAccountTransfers(limit: number = 200, whereClause?: any) {
        const transfers = await this.db
            .select()
            .from(accountTransfers)
            .where(whereClause)
            .orderBy(desc(accountTransfers.transferDate), desc(accountTransfers.createdAt))
            .limit(limit)
            .execute()

        const accountIds = new Set<string>()
        transfers.forEach(t => {
            accountIds.add(t.fromAccountId)
            accountIds.add(t.toAccountId)
        })

        const accountsList = await this.db.select().from(accounts).where(inArray(accounts.id, Array.from(accountIds))).execute()
        const accountMap = new Map(accountsList.map(a => [a.id, a]))

        return transfers.map(t => ({
            transfer: t,
            fromAccountName: accountMap.get(t.fromAccountId)?.name || null,
            fromAccountCurrency: accountMap.get(t.fromAccountId)?.currency || null,
            toAccountName: accountMap.get(t.toAccountId)?.name || null,
            toAccountCurrency: accountMap.get(t.toAccountId)?.currency || null
        }))
    }

    async createAccountTransfer(data: {
        transferDate: string
        fromAccountId: string
        toAccountId: string
        fromAmountCents: number
        toAmountCents: number
        exchangeRate?: number
        memo?: string
        voucherUrls?: string[]
        createdBy?: string
    }) {
        const id = uuid()
        const now = Date.now()
        const voucherUrlJson = JSON.stringify(data.voucherUrls ?? [])

        // 1. 创建转账记录
        await this.db.insert(accountTransfers).values({
            id,
            transferDate: data.transferDate,
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            fromCurrency: (await this.getAccountCurrency(data.fromAccountId)) || 'CNY', // Helper needed or assumption
            toCurrency: (await this.getAccountCurrency(data.toAccountId)) || 'CNY',
            fromAmountCents: data.fromAmountCents,
            toAmountCents: data.toAmountCents,
            exchangeRate: data.exchangeRate,
            memo: data.memo,
            voucherUrl: voucherUrlJson,
            createdBy: data.createdBy,
            createdAt: now
        }).execute()

        // 2. 创建转出账户交易 (Out)
        const fromBalanceBefore = await this.getAccountBalanceBefore(data.fromAccountId, data.transferDate, now)
        const fromBalanceAfter = fromBalanceBefore - data.fromAmountCents
        await this.db.insert(accountTransactions).values({
            id: uuid(),
            accountId: data.fromAccountId,
            flowId: id, // 关联到转账 ID
            transactionDate: data.transferDate,
            transactionType: 'transfer_out',
            amountCents: -data.fromAmountCents,
            balanceBeforeCents: fromBalanceBefore,
            balanceAfterCents: fromBalanceAfter,
            createdAt: now
        }).execute()

        // 3. 创建转入账户交易 (In)
        const toBalanceBefore = await this.getAccountBalanceBefore(data.toAccountId, data.transferDate, now)
        const toBalanceAfter = toBalanceBefore + data.toAmountCents
        await this.db.insert(accountTransactions).values({
            id: uuid(),
            accountId: data.toAccountId,
            flowId: id, // 关联到转账 ID
            transactionDate: data.transferDate,
            transactionType: 'transfer_in',
            amountCents: data.toAmountCents,
            balanceBeforeCents: toBalanceBefore,
            balanceAfterCents: toBalanceAfter,
            createdAt: now
        }).execute()

        return { id }
    }

    async getAccountCurrency(accountId: string) {
        const account = await this.db.select({ currency: accounts.currency }).from(accounts).where(eq(accounts.id, accountId)).get()
        return account?.currency
    }

    async getAccountTransfer(id: string) {
        const transfer = await this.db.select().from(accountTransfers).where(eq(accountTransfers.id, id)).get()
        if (!transfer) return null

        const [fromAccount, toAccount] = await Promise.all([
            this.db.select().from(accounts).where(eq(accounts.id, transfer.fromAccountId)).get(),
            this.db.select().from(accounts).where(eq(accounts.id, transfer.toAccountId)).get()
        ])

        return {
            transfer,
            fromAccountName: fromAccount?.name || null,
            fromAccountCurrency: fromAccount?.currency || null,
            toAccountName: toAccount?.name || null,
            toAccountCurrency: toAccount?.currency || null
        }
    }

    // --- AR/AP ---

    async getNextDocNo(kind: 'AR' | 'AP', date: string) {
        const result = await this.db
            .select({ count: sql<number>`count(1)` })
            .from(arApDocs)
            .where(and(eq(arApDocs.kind, kind), eq(arApDocs.issueDate, date)))
            .get()

        const count = result?.count ?? 0
        const seq = (count + 1).toString().padStart(3, '0')
        const day = date.replace(/-/g, '')
        return `${kind}${day}-${seq}`
    }

    async listArApDocs(limit: number = 200, whereClause?: any) {
        const docs = await this.db
            .select()
            .from(arApDocs)
            .where(whereClause)
            .orderBy(desc(arApDocs.issueDate))
            .limit(limit)
            .execute()

        const docIds = docs.map(d => d.id)
        const siteIds = new Set(docs.map(d => d.siteId).filter(Boolean) as string[])

        const [settlementsList, sitesList] = await Promise.all([
            docIds.length > 0 ? this.db.select({
                docId: settlements.docId,
                sumSettle: sql<number>`sum(${settlements.settleAmountCents})`
            }).from(settlements).where(inArray(settlements.docId, docIds)).groupBy(settlements.docId).execute() : [],
            siteIds.size > 0 ? this.db.select().from(sites).where(inArray(sites.id, Array.from(siteIds))).execute() : []
        ])

        const settledMap = new Map(settlementsList.map(s => [s.docId, s.sumSettle]))
        const siteMap = new Map(sitesList.map(s => [s.id, s]))

        return docs.map(doc => ({
            doc,
            settledCents: settledMap.get(doc.id) || 0,
            siteName: doc.siteId ? siteMap.get(doc.siteId)?.name || null : null
        }))
    }

    async createArApDoc(data: {
        kind: 'AR' | 'AP'
        amountCents: number
        issueDate?: string
        dueDate?: string
        partyId?: string
        siteId?: string
        departmentId?: string
        memo?: string
        docNo?: string
    }) {
        const id = uuid()
        const issueDate = data.issueDate ?? new Date().toISOString().split('T')[0]
        const docNo = data.docNo ?? await this.getNextDocNo(data.kind, issueDate)

        await this.db.insert(arApDocs).values({
            id,
            kind: data.kind,
            docNo,
            partyId: data.partyId,
            siteId: data.siteId,
            departmentId: data.departmentId,
            issueDate,
            dueDate: data.dueDate,
            amountCents: data.amountCents,
            status: 'open',
            memo: data.memo,
            createdAt: Date.now()
        }).execute()

        return { id, docNo }
    }

    async refreshDocStatus(docId: string) {
        const doc = await this.db.select().from(arApDocs).where(eq(arApDocs.id, docId)).get()
        if (!doc) return

        const result = await this.db
            .select({ sum: sql<number>`sum(settle_amount_cents)` })
            .from(settlements)
            .where(eq(settlements.docId, docId))
            .get()

        const totalSettled = result?.sum ?? 0
        let status = 'open'
        if (totalSettled >= doc.amountCents) {
            status = 'settled'
        } else if (totalSettled > 0) {
            status = 'partially_settled'
        }

        await this.db.update(arApDocs).set({ status }).where(eq(arApDocs.id, docId)).execute()
    }

    async settleArApDoc(data: {
        docId: string
        flowId: string
        amountCents: number
        settleDate?: string
    }) {
        const id = uuid()
        await this.db.insert(settlements).values({
            id,
            docId: data.docId,
            flowId: data.flowId,
            settleAmountCents: data.amountCents,
            settleDate: data.settleDate ?? new Date().toISOString().split('T')[0],
            createdAt: Date.now()
        }).execute()

        await this.refreshDocStatus(data.docId)
        return { id }
    }

    async getSettlementsByDocId(docId: string) {
        return await this.db
            .select()
            .from(settlements)
            .where(eq(settlements.docId, docId))
            .orderBy(desc(settlements.settleDate))
            .execute()
    }

    async confirmArApDoc(data: {
        docId: string
        accountId: string
        bizDate: string
        categoryId?: string
        method?: string
        voucherUrl?: string
        createdBy?: string
        memo?: string
    }) {
        const doc = await this.db.select().from(arApDocs).where(eq(arApDocs.id, data.docId)).get()
        if (!doc) throw Errors.NOT_FOUND('单据')
        if (doc.status === 'confirmed') throw Errors.BUSINESS_ERROR('单据已确认')

        const account = await this.db.select().from(accounts).where(eq(accounts.id, data.accountId)).get()
        if (!account || !account.active) throw Errors.BUSINESS_ERROR('账户不存在或已停用')

        const transactionType = doc.kind === 'AR' ? 'income' : 'expense'

        // 创建现金流水
        const flowResult = await this.createCashFlow({
            bizDate: data.bizDate,
            type: transactionType,
            accountId: data.accountId,
            amountCents: doc.amountCents,
            categoryId: data.categoryId,
            method: data.method,
            siteId: doc.siteId,
            departmentId: doc.departmentId,
            counterparty: doc.partyId,
            memo: data.memo ?? doc.memo,
            voucherUrls: data.voucherUrl ? [data.voucherUrl] : [],
            createdBy: data.createdBy
        })

        // 更新单据状态
        await this.db.update(arApDocs).set({ status: 'confirmed' }).where(eq(arApDocs.id, data.docId)).execute()

        // 创建结算记录
        await this.settleArApDoc({
            docId: data.docId,
            flowId: flowResult.id,
            amountCents: doc.amountCents,
            settleDate: data.bizDate
        })

        return { ok: true, flowId: flowResult.id, voucherNo: flowResult.voucherNo }
    }

    // --- Borrowings ---

    async listBorrowings(limit: number = 200, whereClause?: any) {
        const borrowingsList = await this.db
            .select()
            .from(borrowings)
            .where(whereClause)
            .orderBy(desc(borrowings.borrowDate), desc(borrowings.createdAt))
            .limit(limit)
            .execute()

        const userIds = new Set<string>()
        const accountIds = new Set<string>()
        borrowingsList.forEach(b => {
            userIds.add(b.userId)
            accountIds.add(b.accountId)
        })

        const [usersList, accountsList] = await Promise.all([
            this.db.select().from(employees).where(inArray(employees.id, Array.from(userIds))).execute(),
            this.db.select().from(accounts).where(inArray(accounts.id, Array.from(accountIds))).execute()
        ])

        const userMap = new Map(usersList.map(u => [u.id, u]))
        const accountMap = new Map(accountsList.map(a => [a.id, a]))

        // 还需要员工姓名。将 email 从用户映射到员工
        const emails = usersList.map(u => u.email).filter(Boolean) as string[]
        const employeesList = emails.length > 0 ? await this.db.select().from(employees).where(inArray(employees.email, emails)).execute() : []
        const employeeMap = new Map(employeesList.map(e => [e.email, e]))

        return borrowingsList.map(b => {
            const user = userMap.get(b.userId)
            const employee = user ? employeeMap.get(user.email) : null
            const account = accountMap.get(b.accountId)
            return {
                borrowing: b,
                borrowerName: employee?.name || null,
                borrowerEmail: user?.email || null,
                accountName: account?.name || null,
                accountCurrency: account?.currency || null
            }
        })
    }

    async createBorrowing(data: {
        userId: string
        accountId: string
        amountCents: number
        currency: string
        borrowDate: string
        memo?: string
        createdBy?: string
    }) {
        const id = uuid()
        await this.db.insert(borrowings).values({
            id,
            userId: data.userId,
            accountId: data.accountId,
            amountCents: data.amountCents,
            currency: data.currency,
            borrowDate: data.borrowDate,
            memo: data.memo,
            status: 'outstanding',
            createdAt: Date.now()
        }).execute()
        return { id }
    }

    async createRepayment(data: {
        borrowingId: string
        accountId: string
        amountCents: number
        currency: string
        repayDate: string
        memo?: string
        createdBy?: string
    }) {
        const id = uuid()
        await this.db.insert(repayments).values({
            id,
            borrowingId: data.borrowingId,
            accountId: data.accountId,
            amountCents: data.amountCents,
            currency: data.currency,
            repayDate: data.repayDate,
            memo: data.memo,
            createdBy: data.createdBy,
            createdAt: Date.now()
        }).execute()
        return { id }
    }

    // --- Site Bills ---

    async listSiteBills(limit: number = 200, whereClause?: any) {
        return await this.db
            .select({
                bill: siteBills,
                siteName: sites.name,
                siteCode: sites.siteCode,
                accountName: accounts.name,
                categoryName: categories.name,
                currencyName: currencies.name,
                creatorName: employees.name
            })
            .from(siteBills)
            .leftJoin(sites, eq(sites.id, siteBills.siteId))
            .leftJoin(accounts, eq(accounts.id, siteBills.accountId))
            .leftJoin(categories, eq(categories.id, siteBills.categoryId))
            .leftJoin(currencies, eq(currencies.code, siteBills.currency))
            .leftJoin(employees, eq(employees.id, siteBills.createdBy))
            .where(whereClause)
            .orderBy(desc(siteBills.billDate), desc(siteBills.createdAt))
            .limit(limit)
            .execute()
    }

    async createSiteBill(data: {
        siteId: string
        billDate: string
        billType: string
        amountCents: number
        currency: string
        description?: string
        accountId?: string
        categoryId?: string
        status?: string
        paymentDate?: string
        memo?: string
        createdBy?: string
    }) {
        const id = uuid()
        const now = Date.now()
        await this.db.insert(siteBills).values({
            id,
            siteId: data.siteId,
            billDate: data.billDate,
            billType: data.billType,
            amountCents: data.amountCents,
            currency: data.currency,
            description: data.description,
            accountId: data.accountId,
            categoryId: data.categoryId,
            status: data.status ?? 'pending',
            paymentDate: data.paymentDate,
            memo: data.memo,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now
        }).execute()
        return { id }
    }

    async updateSiteBill(id: string, data: Partial<typeof siteBills.$inferInsert>) {
        const updates: any = { updatedAt: Date.now() }
        if (data.billDate !== undefined) updates.billDate = data.billDate
        if (data.billType !== undefined) updates.billType = data.billType
        if (data.amountCents !== undefined) updates.amountCents = data.amountCents
        if (data.currency !== undefined) updates.currency = data.currency
        if (data.description !== undefined) updates.description = data.description
        if (data.accountId !== undefined) updates.accountId = data.accountId
        if (data.categoryId !== undefined) updates.categoryId = data.categoryId
        if (data.status !== undefined) updates.status = data.status
        if (data.paymentDate !== undefined) updates.paymentDate = data.paymentDate
        if (data.memo !== undefined) updates.memo = data.memo

        await this.db.update(siteBills).set(updates).where(eq(siteBills.id, id)).execute()
        return { ok: true }
    }

    async deleteSiteBill(id: string) {
        await this.db.delete(siteBills).where(eq(siteBills.id, id)).execute()
        return { ok: true }
    }
}
