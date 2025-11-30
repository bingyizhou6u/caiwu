/**
 * 应收应付报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition, hasPermission, getDataAccessFilter, getUserEmployee } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const arApReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// AR汇总报表
arApReportsRoutes.get('/ar-summary', async (c) => {
  if (!hasPermission(c, 'report', 'view', 'ar_ap') && !hasPermission(c, 'report', 'view', 'all')) {
    throw Errors.FORBIDDEN('没有查看应收应付报表的权限')
  }
  
  const kind = c.req.query('kind') // AR|AP
  const start = c.req.query('start')
  const end = c.req.query('end')
  
  if (!kind || !['AR', 'AP'].includes(kind)) throw Errors.VALIDATION_ERROR('kind必须为AR或AP')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    where d.kind=? and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [kind, start, end]
  
  const docs = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0
  let settled = 0
  
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status] || 0) + (r.amount_cents || 0)
  }
  
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AR明细报表
arApReportsRoutes.get('/ar-detail', async (c) => {
  if (!hasPermission(c, 'report', 'view', 'ar_ap') && !hasPermission(c, 'report', 'view', 'all')) {
    throw Errors.FORBIDDEN('没有查看应收应付报表的权限')
  }
  
  const kind = c.req.query('kind') // AR|AP
  const start = c.req.query('start')
  const end = c.req.query('end')
  
  if (!kind || !['AR', 'AP'].includes(kind)) throw Errors.VALIDATION_ERROR('kind必须为AR或AP')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents, p.name as party_name
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    left join parties p on p.id=d.party_id
    where d.kind=? and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [kind, start, end]
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  return c.json({ rows: rows.results ?? [] })
})

// AP汇总报表
arApReportsRoutes.get('/ap-summary', async (c) => {
  if (!hasPermission(c, 'report', 'view', 'ar_ap') && !hasPermission(c, 'report', 'view', 'all')) {
    throw Errors.FORBIDDEN('没有查看应收应付报表的权限')
  }
  
  const start = c.req.query('start')
  const end = c.req.query('end')
  
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    where d.kind='AP' and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [start, end]
  
  const docs = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0
  let settled = 0
  
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status] || 0) + (r.amount_cents || 0)
  }
  
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AP明细报表
arApReportsRoutes.get('/ap-detail', async (c) => {
  if (!hasPermission(c, 'report', 'view', 'ar_ap') && !hasPermission(c, 'report', 'view', 'all')) {
    throw Errors.FORBIDDEN('没有查看应收应付报表的权限')
  }
  
  const start = c.req.query('start')
  const end = c.req.query('end')
  
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents, p.name as party_name
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    left join parties p on p.id=d.party_id
    where d.kind='AP' and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [start, end]
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  return c.json({ rows: rows.results ?? [] })
})

