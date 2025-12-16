import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { arApDocs, settlements, sites, accounts, cashFlows } from '../db/schema'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors'
import { FinanceService } from './FinanceService'

export class ArApService {
  constructor(
    private db: DrizzleD1Database<any>,
    private financeService: FinanceService
  ) {}

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

  async list(page: number = 1, pageSize: number = 20, whereClause?: any) {
    const offset = (page - 1) * pageSize

    // 1. Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(1)` })
      .from(arApDocs)
      .where(whereClause)
      .get()
    const total = countResult?.count ?? 0

    // 2. Get paged data
    const docs = await this.db
      .select()
      .from(arApDocs)
      .where(whereClause)
      .orderBy(desc(arApDocs.issueDate))
      .limit(pageSize)
      .offset(offset)
      .execute()

    const docIds = docs.map(d => d.id)
    const siteIds = new Set(docs.map(d => d.siteId).filter(Boolean) as string[])

    const [settlementsList, sitesList] = await Promise.all([
      docIds.length > 0
        ? this.db
            .select({
              docId: settlements.docId,
              sumSettle: sql<number>`sum(${settlements.settleAmountCents})`,
            })
            .from(settlements)
            .where(inArray(settlements.docId, docIds))
            .groupBy(settlements.docId)
            .execute()
        : [],
      siteIds.size > 0
        ? this.db
            .select()
            .from(sites)
            .where(inArray(sites.id, Array.from(siteIds)))
            .execute()
        : [],
    ])

    const settledMap = new Map(settlementsList.map(s => [s.docId, s.sumSettle]))
    const siteMap = new Map(sitesList.map(s => [s.id, s]))

    const list = docs.map(doc => ({
      doc,
      settledCents: settledMap.get(doc.id) || 0,
      siteName: doc.siteId ? siteMap.get(doc.siteId)?.name || null : null,
    }))

    return { total, list }
  }

  async create(data: {
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
    const docNo = data.docNo ?? (await this.getNextDocNo(data.kind, issueDate))

    await this.db
      .insert(arApDocs)
      .values({
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
        createdAt: Date.now(),
      })
      .execute()

    return { id, docNo }
  }

  async refreshStatus(docId: string, tx?: any) {
    const db = tx || this.db
    const doc = await db.select().from(arApDocs).where(eq(arApDocs.id, docId)).get()
    if (!doc) {return}

    const result = await db
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

    await db.update(arApDocs).set({ status }).where(eq(arApDocs.id, docId)).execute()
  }

  async settle(
    data: {
      docId: string
      flowId: string
      amountCents: number
      settleDate?: string
    },
    tx?: any
  ) {
    const db = tx || this.db
    const id = uuid()
    await db
      .insert(settlements)
      .values({
        id,
        docId: data.docId,
        flowId: data.flowId,
        settleAmountCents: data.amountCents,
        settleDate: data.settleDate ?? new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
      })
      .execute()

    await this.refreshStatus(data.docId, db)
    return { id }
  }

  async getSettlements(docId: string) {
    return await this.db
      .select()
      .from(settlements)
      .where(eq(settlements.docId, docId))
      .orderBy(desc(settlements.settleDate))
      .execute()
  }

  async confirm(data: {
    docId: string
    accountId: string
    bizDate: string
    categoryId?: string
    method?: string
    voucherUrl?: string
    createdBy?: string
    memo?: string
  }) {
    return await this.db.transaction(async tx => {
      const doc = await tx.select().from(arApDocs).where(eq(arApDocs.id, data.docId)).get()
      if (!doc) {throw Errors.NOT_FOUND('单据')}
      if (doc.status === 'confirmed') {throw Errors.BUSINESS_ERROR('单据已确认')}

      const account = await tx.select().from(accounts).where(eq(accounts.id, data.accountId)).get()
      if (!account || !account.active) {throw Errors.BUSINESS_ERROR('账户不存在或已停用')}

      const transactionType = doc.kind === 'AR' ? 'income' : 'expense'

      // 创建现金流水 via FinanceService
      const flowResult = await this.financeService.createCashFlow(
        {
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
          createdBy: data.createdBy,
        },
        tx
      )

      // 更新单据状态
      await tx
        .update(arApDocs)
        .set({ status: 'confirmed' })
        .where(eq(arApDocs.id, data.docId))
        .execute()

      // 创建结算记录
      await this.settle(
        {
          docId: data.docId,
          flowId: flowResult.id,
          amountCents: doc.amountCents,
          settleDate: data.bizDate,
        },
        tx
      )

      return { ok: true, flowId: flowResult.id, voucherNo: flowResult.voucherNo }
    })
  }

  async getById(id: string) {
    return await this.db.select().from(arApDocs).where(eq(arApDocs.id, id)).get()
  }

  async update(id: string, data: Partial<typeof arApDocs.$inferInsert>) {
    await this.db
      .update(arApDocs)
      .set({
        ...data,
        updatedAt: Date.now(),
      })
      .where(eq(arApDocs.id, id))
      .execute()
  }

  async delete(id: string) {
    await this.db.delete(arApDocs).where(eq(arApDocs.id, id)).execute()
  }
}
