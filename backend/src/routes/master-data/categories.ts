import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { isHQDirector, isHQFinance } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { uuid } from '../../utils/db.js'
import { Errors } from '../../utils/errors.js'
import { validateJson, getValidatedData } from '../../utils/validator.js'
import { createCategorySchema, updateCategorySchema } from '../../schemas/business.schema.js'
import { z } from 'zod'

export const categoriesRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

categoriesRoutes.get('/', async (c) => {
    // 所有人都可以查看

    const rows = await c.env.DB.prepare('select * from categories order by kind,name').all()
    const results = rows.results ?? []

    return c.json({ results })
})

categoriesRoutes.post('/', validateJson(createCategorySchema), async (c) => {
    if (!isHQFinance(c)) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createCategorySchema>>(c)

    // 检查类别名称是否已存在
    const existed = await c.env.DB.prepare('select id from categories where name=?').bind(body.name).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('类别名称')

    const id = uuid()
    await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,?)')
        .bind(id, body.name, body.kind, body.parent_id ?? null).run()

    logAuditAction(c, 'create', 'category', id, JSON.stringify({ name: body.name, kind: body.kind }))
    return c.json({ id, ...body })
})

// Update category (no delete allowed). Only name/kind allowed, and kind restricted to income|expense
categoriesRoutes.put('/:id', validateJson(updateCategorySchema), async (c) => {
    if (!isHQFinance(c)) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = getValidatedData<z.infer<typeof updateCategorySchema>>(c)

    const updates: string[] = []
    const binds: any[] = []
    if (body.name !== undefined) {
        // 检查名称是否与其他类别重复
        const existed = await c.env.DB.prepare('select id from categories where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
        if (existed?.id) throw Errors.DUPLICATE('类别名称')
        updates.push('name=?'); binds.push(body.name)
    }
    if (body.kind !== undefined) {
        updates.push('kind=?'); binds.push(body.kind)
    }

    if (updates.length === 0) return c.json({ ok: true })

    binds.push(id)
    await c.env.DB.prepare(`update categories set ${updates.join(',')} where id=?`).bind(...binds).run()

    logAuditAction(c, 'update', 'category', id, JSON.stringify(body))
    return c.json({ ok: true })
})

categoriesRoutes.delete('/:id', async (c) => {
    if (!isHQDirector(c)) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const category = await c.env.DB.prepare('select name from categories where id=?').bind(id).first<{ name: string }>()
    if (!category) throw Errors.NOT_FOUND('类别')
    // 检查是否有流水使用此类别
    const flows = await c.env.DB.prepare('select count(1) as cnt from cash_flows where category_id=?').bind(id).first<{ cnt: number }>()
    if (flows && Number(flows.cnt) > 0) {
        throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')
    }
    await c.env.DB.prepare('delete from categories where id=?').bind(id).run()

    logAuditAction(c, 'delete', 'category', id, JSON.stringify({ name: category.name }))
    return c.json({ ok: true })
})
