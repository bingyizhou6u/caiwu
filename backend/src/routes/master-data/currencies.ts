import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { validateJson, getValidatedData } from '../../utils/validator.js'
import { createCurrencySchema, updateCurrencySchema } from '../../schemas/business.schema.js'
import { z } from 'zod'

export const currenciesRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

currenciesRoutes.get('/', async (c) => {
    // 所有人都可以查看
    const search = c.req.query('search')

    if (search) {
        // 搜索查询不缓存（结果动态）
        const like = `%${search.toUpperCase()}%`
        const rows = await c.env.DB.prepare('select * from currencies where upper(code) like ? or upper(name) like ? order by code')
            .bind(like, like).all()
        return c.json({ results: rows.results ?? [] })
    }

    const rows = await c.env.DB.prepare('select * from currencies order by code').all()
    const results = rows.results ?? []

    return c.json({ results })
})

currenciesRoutes.post('/', validateJson(createCurrencySchema), async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'create')) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createCurrencySchema>>(c)
    const code = body.code

    // 检查币种代码是否已存在
    const existed = await c.env.DB.prepare('select code from currencies where code=?').bind(code).first<{ code: string }>()
    if (existed?.code) throw Errors.DUPLICATE('币种代码')

    await c.env.DB.prepare('insert into currencies(code,name,active) values(?,?,1)').bind(code, body.name).run()
    logAuditAction(c, 'create', 'currency', code, JSON.stringify({ name: body.name }))
    return c.json({ code, name: body.name })
})

currenciesRoutes.put('/:code', validateJson(updateCurrencySchema), async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'update')) throw Errors.FORBIDDEN()
    const code = c.req.param('code').toUpperCase()
    const body = getValidatedData<z.infer<typeof updateCurrencySchema>>(c)

    const updates: string[] = []
    const binds: any[] = []
    if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
    if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active ? 1 : 0) }

    binds.push(code)
    await c.env.DB.prepare(`update currencies set ${updates.join(',')} where code=?`).bind(...binds).run()
    logAuditAction(c, 'update', 'currency', code, JSON.stringify(body))
    return c.json({ ok: true })
})

currenciesRoutes.delete('/:code', async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'delete')) throw Errors.FORBIDDEN()
    const code = c.req.param('code').toUpperCase()
    const currency = await c.env.DB.prepare('select name from currencies where code=?').bind(code).first<{ name: string }>()
    if (!currency) throw Errors.NOT_FOUND('币种')
    // 检查是否有账户使用此币种（包括所有账户，不只是active的）
    const accounts = await c.env.DB.prepare('select count(1) as cnt from accounts where currency=?').bind(code).first<{ cnt: number }>()
    if (accounts && Number(accounts.cnt) > 0) {
        throw Errors.BUSINESS_ERROR('无法删除，该币种还有账户使用')
    }
    await c.env.DB.prepare('delete from currencies where code=?').bind(code).run()
    logAuditAction(c, 'delete', 'currency', code, JSON.stringify({ name: currency.name }))
    return c.json({ ok: true })
})
