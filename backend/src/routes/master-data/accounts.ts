import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { isHQDirector, isHQFinance } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { uuid } from '../../utils/db.js'
import { Errors } from '../../utils/errors.js'
import { validateJson, getValidatedData } from '../../utils/validator.js'
import { createAccountSchema, updateAccountSchema } from '../../schemas/business.schema.js'
import { z } from 'zod'

export const accountsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

accountsRoutes.get('/', async (c) => {
    // 所有人都可以查看
    const search = c.req.query('search')

    if (search) {
        // 搜索查询不缓存（结果动态）
        const like = `%${search.toLowerCase()}%`
        const rows = await c.env.DB.prepare(`
      select a.*, c.name as currency_name
      from accounts a left join currencies c on c.code = a.currency
      where lower(a.name) like ? or lower(ifnull(a.alias,'')) like ? or lower(ifnull(a.account_number,'')) like ?
      order by a.name
    `).bind(like, like, like).all()
        return c.json({ results: rows.results ?? [] })
    }

    const rows = await c.env.DB.prepare('select a.*, c.name as currency_name from accounts a left join currencies c on c.code = a.currency order by a.name').all()
    const results = rows.results ?? []

    return c.json({ results })
})

// 账户明细查询：查询指定账户的所有账变记录
accountsRoutes.get('/:id/transactions', async (c) => {
    // 所有人都可以查看
    try {
        const accountId = c.req.param('id')
        const limit = parseInt(c.req.query('limit') || '100')
        const offset = parseInt(c.req.query('offset') || '0')

        const rows = await c.env.DB.prepare(`
      select 
        t.id, t.transaction_date, t.transaction_type, t.amount_cents,
        t.balance_before_cents, t.balance_after_cents, t.created_at,
        f.voucher_no, f.memo, f.counterparty, f.voucher_url,
        c.name as category_name
      from account_transactions t
      left join cash_flows f on f.id = t.flow_id
      left join categories c on c.id = f.category_id
      where t.account_id = ?
      order by t.transaction_date desc, t.created_at desc
      limit ? offset ?
    `).bind(accountId, limit, offset).all<any>()

        return c.json({ results: rows.results ?? [] })
    } catch (err: any) {
        console.error('Account transactions error:', err)
        if (err && typeof err === 'object' && 'statusCode' in err) throw err
        throw Errors.INTERNAL_ERROR(err.message || '查询失败')
    }
})

accountsRoutes.post('/', async (c) => {
    if (!isHQFinance(c)) throw Errors.FORBIDDEN()
    const body = await c.req.json<{ name: string, type: string, currency?: string, alias?: string, account_number?: string, opening_cents?: number, manager?: string }>()
    const id = uuid()
    const currency = (body.currency ?? 'CNY').trim().toUpperCase()
    const cur = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(currency).first<{ code: string }>()
    if (!cur?.code) throw Errors.NOT_FOUND(`币种 ${currency}`)
    await c.env.DB.prepare('insert into accounts(id,name,type,currency,alias,account_number,opening_cents,active,manager) values(?,?,?,?,?,?,?,1,?)')
        .bind(id, body.name, body.type, currency, body.alias ?? null, body.account_number ?? null, body.opening_cents ?? 0, body.manager ?? null).run()
    logAuditAction(c, 'create', 'account', id, JSON.stringify({ name: body.name, type: body.type, currency }))
    return c.json({ id, ...body, currency })
})

accountsRoutes.put('/:id', async (c) => {
    if (!isHQFinance(c)) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = await c.req.json<{ name?: string, type?: string, currency?: string, alias?: string, account_number?: string, active?: number, manager?: string }>()
    const updates: string[] = []
    const binds: any[] = []
    if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
    if (body.type !== undefined) { updates.push('type=?'); binds.push(body.type) }
    if (body.currency !== undefined) {
        const code = body.currency.trim().toUpperCase()
        const cur = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(code).first<{ code: string }>()
        if (!cur?.code) throw Errors.NOT_FOUND(`币种 ${code}`)
        updates.push('currency=?'); binds.push(code)
    }
    if (body.alias !== undefined) { updates.push('alias=?'); binds.push(body.alias) }
    if (body.account_number !== undefined) { updates.push('account_number=?'); binds.push(body.account_number) }
    if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
    if (body.manager !== undefined) { updates.push('manager=?'); binds.push(body.manager ?? null) }
    if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
    binds.push(id)
    await c.env.DB.prepare(`update accounts set ${updates.join(',')} where id=?`).bind(...binds).run()
    logAuditAction(c, 'update', 'account', id, JSON.stringify(body))
    return c.json({ ok: true })
})

accountsRoutes.delete('/:id', async (c) => {
    if (!isHQDirector(c)) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const account = await c.env.DB.prepare('select name from accounts where id=?').bind(id).first<{ name: string }>()
    if (!account) throw Errors.NOT_FOUND('账户')
    // 检查是否有流水使用此账户
    const flows = await c.env.DB.prepare('select count(1) as cnt from cash_flows where account_id=?').bind(id).first<{ cnt: number }>()
    if (flows && Number(flows.cnt) > 0) {
        throw Errors.BUSINESS_ERROR('无法删除，该账户还有流水记录')
    }
    await c.env.DB.prepare('delete from accounts where id=?').bind(id).run()
    logAuditAction(c, 'delete', 'account', id, JSON.stringify({ name: account.name }))
    return c.json({ ok: true })
})
