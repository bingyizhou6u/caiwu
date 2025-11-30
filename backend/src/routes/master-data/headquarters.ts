/**
 * 总部路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { isHQDirector, isHQFinance } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'

export const headquartersRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取总部列表
headquartersRoutes.get('/', async (c) => {
  // 所有人都可以查看
  const rows = await c.env.DB.prepare('select * from headquarters').all()
  return c.json(rows.results ?? [])
})

// HQ创建已禁用（单一默认总部）
headquartersRoutes.post('/', async (c) => {
  throw Errors.BUSINESS_ERROR('总部配置已禁用')
})

// 更新总部
headquartersRoutes.put('/:id', async (c) => {
  if (!isHQDirector(c) && !isHQFinance(c)) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string; active?: number }>()
  
  const hq = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  if (!hq) throw Errors.NOT_FOUND('总部')
  
  if (body.name !== undefined) {
    await c.env.DB.prepare('update headquarters set name=?, updated_at=? where id=?')
      .bind(body.name, Date.now(), id).run()
  }
  
  if (body.active !== undefined) {
    await c.env.DB.prepare('update headquarters set active=?, updated_at=? where id=?')
      .bind(body.active, Date.now(), id).run()
  }
  
  logAuditAction(c, 'update', 'headquarters', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除总部（软删除）
headquartersRoutes.delete('/:id', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  const hq = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  if (!hq) throw Errors.NOT_FOUND('总部')
  
  await c.env.DB.prepare('update headquarters set active=0 where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'headquarters', id, JSON.stringify({ name: hq.name }))
  return c.json({ ok: true })
})

