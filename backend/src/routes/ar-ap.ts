import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getDataAccessFilter } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { FinanceService } from '../services/FinanceService.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { createArApDocSchema, createSettlementSchema, confirmArApDocSchema, idQuerySchema } from '../schemas/business.schema.js'
import { docIdQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const ar_apRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

function todayStr() { const d = new Date(); const y = d.getFullYear(); const m = ('0' + (d.getMonth() + 1)).slice(-2); const dd = ('0' + d.getDate()).slice(-2); return `${y}-${m}-${dd}` }
async function nextDocNo(db: D1Database, kind: 'AR' | 'AP', date: string) {
  const count = await db.prepare('select count(1) as n from ar_ap_docs where kind=? and issue_date=?').bind(kind, date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const day = date.replace(/-/g, '')
  return `${kind}${day}-${seq}`
}

ar_apRoutes.get('/ar/docs', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const kind = c.req.query('kind') // AR|AP optional
  const status = c.req.query('status') // optional
  let sql = 'select d.*, coalesce(s.sum_settle,0) as settled_cents, st.name as site_name from ar_ap_docs d left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id left join sites st on st.id=d.site_id'
  const conds: string[] = []
  const binds: any[] = []
  if (kind) { conds.push('d.kind=?'); binds.push(kind) }
  if (status) { conds.push('d.status=?'); binds.push(status) }
  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by d.issue_date desc'

  // 应用数据权限过滤
  const { where, binds: scopeBinds } = getDataAccessFilter(c, 'd')
  if (where !== '1=1') {
    sql += conds.length > 0 ? ` and ${where}` : ` where ${where}`
    binds.push(...scopeBinds)
  }
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})


ar_apRoutes.post('/ar/docs', validateJson(createArApDocSchema), async (c) => {
  if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createArApDocSchema>>(c)
  const id = uuid()
  const issue = body.issue_date ?? todayStr()
  const amount = body.amount_cents
  const docNo = body.doc_no ?? await nextDocNo(c.env.DB, body.kind, issue)
  await c.env.DB.prepare(`
    insert into ar_ap_docs(id,kind,doc_no,party_id,site_id,department_id,issue_date,due_date,amount_cents,status,memo)
    values(?,?,?,?,?,?,?,?,?,'open',?)
  `).bind(id, body.kind, docNo, body.party_id ?? null, body.site_id ?? null, body.department_id ?? null, issue, body.due_date ?? null, amount, body.memo ?? null).run()
  logAuditAction(c, 'create', 'ar_ap_doc', id, JSON.stringify({ kind: body.kind, doc_no: docNo, amount_cents: amount }))
  return c.json({ id, doc_no: docNo })
})


ar_apRoutes.get('/ar/settlements', validateQuery(docIdQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const rows = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(query.doc_id).all()
  return c.json({ results: rows.results ?? [] })
})

async function refreshDocStatus(db: D1Database, docId: string) {
  const doc = await db.prepare('select amount_cents from ar_ap_docs where id=?').bind(docId).first<{ amount_cents: number }>()
  if (!doc) return
  const s = await db.prepare('select coalesce(sum(settle_amount_cents),0) as s from settlements where doc_id=?').bind(docId).first<{ s: number }>()
  const total = s?.s ?? 0
  const status = total <= 0 ? 'open' : (total < (doc.amount_cents ?? 0) ? 'partially_settled' : 'settled')
  await db.prepare('update ar_ap_docs set status=? where id=?').bind(status, docId).run()
}


ar_apRoutes.post('/ar/settlements', validateJson(createSettlementSchema), async (c) => {
  if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createSettlementSchema>>(c)
  const id = uuid()
  const amount = body.settle_amount_cents
  await c.env.DB.prepare('insert into settlements(id,doc_id,flow_id,settle_amount_cents,settle_date) values(?,?,?,?,?)')
    .bind(id, body.doc_id, body.flow_id, amount, body.settle_date ?? todayStr()).run()
  await refreshDocStatus(c.env.DB, body.doc_id)
  logAuditAction(c, 'settle', 'ar_ap_doc', body.doc_id, JSON.stringify({ settlement_id: id, amount_cents: amount }))
  return c.json({ id })
})

// Statement

ar_apRoutes.get('/ar/statement', validateQuery(docIdQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const docId = query.doc_id

  // 优化：并行查询文档和settlements
  const [doc, settlements] = await Promise.all([
    c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(docId).first<any>(),
    c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(docId).all<any>()
  ])

  if (!doc) throw Errors.NOT_FOUND('单据')

  const settled = (settlements.results ?? []).reduce((a: number, b: any) => a + (b.settle_amount_cents || 0), 0)
  const remaining = (doc?.amount_cents ?? 0) - settled
  return c.json({ doc, settlements: settlements.results ?? [], settled_cents: settled, remaining_cents: remaining })
})

// 确认AR/AP文档，生成对应的收入/支出记录

ar_apRoutes.post('/ar/confirm', validateJson(confirmArApDocSchema), async (c) => {
  if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof confirmArApDocSchema>>(c)
  const docId = body.doc_id

  // 获取文档信息
  const doc = await c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(docId).first<any>()
  if (!doc) throw Errors.NOT_FOUND('单据')
  if (doc.status === 'confirmed') throw Errors.BUSINESS_ERROR('单据已确认')

  // 验证账户存在且币种匹配
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')

  // 确定交易类型：AR -> income, AP -> expense
  const transactionType = doc.kind === 'AR' ? 'income' : 'expense'

  const flowId = uuid()
  const now = Date.now()
  const amount = doc.amount_cents

  // 生成凭证号
  const day = String(body.biz_date).replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(body.biz_date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`

  // 计算账变前金额
  const balanceBefore = await new FinanceService(c.env.DB).getAccountBalanceBefore(body.account_id, body.biz_date, now)

  // 计算账变金额（收入为正，支出为负）
  const delta = transactionType === 'income' ? amount : -amount
  const balanceAfter = balanceBefore + delta

  // 插入cash_flow记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    flowId, voucherNo, body.biz_date, transactionType, body.account_id, body.category_id,
    body.method ?? null, amount, doc.site_id ?? null, doc.department_id ?? null,
    doc.party_id ?? null, body.memo ?? doc.memo ?? null, body.voucher_url,
    body.created_by ?? c.get('userId') ?? 'system', now
  ).run()

  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, flowId, body.biz_date, transactionType, amount,
    balanceBefore, balanceAfter, now
  ).run()

  // 更新文档状态为confirmed
  await c.env.DB.prepare('update ar_ap_docs set status=? where id=?').bind('confirmed', docId).run()

  // 创建settlement记录（确认时全额核销）
  const settlementId = uuid()
  await c.env.DB.prepare('insert into settlements(id,doc_id,flow_id,settle_amount_cents,settle_date) values(?,?,?,?,?)')
    .bind(settlementId, docId, flowId, amount, body.biz_date).run()

  await refreshDocStatus(c.env.DB, docId)

  logAuditAction(c, 'confirm', 'ar_ap_doc', docId, JSON.stringify({
    kind: doc.kind, flow_id: flowId, transaction_type: transactionType, amount_cents: amount
  }))

  return c.json({ ok: true, flow_id: flowId, voucher_no: voucherNo })
})

// ================= Reports V1 =================
// Department cash summary
