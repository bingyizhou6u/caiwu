import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead, canWrite } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const vendorsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// List vendors
vendorsRoutes.get('/', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select id, name, contact, phone, email, address, memo, active from vendors where active = 1 order by name').all()
  return c.json({ results: rows.results ?? [] })
})

// Get vendor by ID
vendorsRoutes.get('/:id', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('select * from vendors where id = ?').bind(id).first()
  if (!row) throw Errors.NOT_FOUND('供应商不存在')
  return c.json(row)
})

// Create vendor
vendorsRoutes.post('/', async (c) => {
  if (!canWrite(c)) throw Errors.FORBIDDEN()
  const body = await c.req.json()
  const now = Date.now()
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'insert into vendors (id, name, contact, phone, email, address, memo, active, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(id, body.name, body.contact || null, body.phone || null, body.email || null, body.address || null, body.memo || null, now, now).run()
  return c.json({ id, ok: true })
})

// Update vendor
vendorsRoutes.put('/:id', async (c) => {
  if (!canWrite(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = Date.now()
  await c.env.DB.prepare(
    'update vendors set name = ?, contact = ?, phone = ?, email = ?, address = ?, memo = ?, updated_at = ? where id = ?'
  ).bind(body.name, body.contact || null, body.phone || null, body.email || null, body.address || null, body.memo || null, now, id).run()
  return c.json({ ok: true })
})

// Delete vendor (soft delete)
vendorsRoutes.delete('/:id', async (c) => {
  if (!canWrite(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  await c.env.DB.prepare('update vendors set active = 0, updated_at = ? where id = ?').bind(Date.now(), id).run()
  return c.json({ ok: true })
})
