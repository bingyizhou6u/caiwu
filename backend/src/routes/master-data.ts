import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, canRead, canReadAsync, canViewReports } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid , getUserDepartmentId } from '../utils/db.js'
import { getOrCreateDefaultHQ, createDefaultOrgDepartments } from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { headquartersRoutes } from './master-data/headquarters.js'
import { departmentsRoutes } from './master-data/departments.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { createDepartmentSchema, createSiteSchema, updateDepartmentSchema, updateSiteSchema } from '../schemas/master-data.schema.js'
import { createCurrencySchema, updateCurrencySchema, createCategorySchema, updateCategorySchema, createCashFlowSchema, createArApDocSchema, createSettlementSchema, confirmArApDocSchema } from '../schemas/business.schema.js'
import { dateQuerySchema, idQuerySchema, docIdQuerySchema, csvImportQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'
import { getCache, setCache, deleteCache, cacheKeys } from '../utils/cache.js'

export const master_dataRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 挂载子模块路由
master_dataRoutes.route('/hq', headquartersRoutes)
master_dataRoutes.route('/', departmentsRoutes)


// 获取职位列表
master_dataRoutes.get('/positions', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from positions where active=1 order by sort_order, name').all()
  return c.json({ results: rows.results ?? [] })
})

// 根据部门类型识别部门功能类别
function detectDepartmentType(code: string | null, name: string): 'HR' | 'FINANCE' | 'ADMIN' | 'TECH' | 'OTHER' {
  const key = (code || name || '').toLowerCase()
  if (key.includes('hr') || key.includes('人事')) return 'HR'
  if (key.includes('finance') || key.includes('财务')) return 'FINANCE'
  if (key.includes('admin') || key.includes('行政')) return 'ADMIN'
  if (key.includes('tech') || key.includes('技术') || key.includes('开发')) return 'TECH'
  return 'OTHER'
}

// 根据部门获取可用职位列表
master_dataRoutes.get('/positions/available', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const orgDepartmentId = c.req.query('org_department_id')
  
  if (!orgDepartmentId) {
    throw Errors.VALIDATION_ERROR('org_department_id参数必填')
  }
  
  // 获取部门信息
  const dept = await c.env.DB.prepare(`
    select od.*, 
           CASE WHEN od.project_id IS NULL THEN 'hq' ELSE d.id END as project_id_value,
           CASE WHEN od.project_id IS NULL THEN '总部' ELSE d.name END as project_name,
           p.code as parent_code,
           p.name as parent_name
    from org_departments od
    left join departments d on d.id = od.project_id
    left join org_departments p on p.id = od.parent_id
    where od.id = ?
  `).bind(orgDepartmentId).first<{
    id: string
    project_id: string | null
    project_id_value: string
    project_name: string
    code: string | null
    name: string
    parent_id: string | null
    parent_code: string | null
    parent_name: string | null
  }>()
  
  if (!dept) {
    throw Errors.NOT_FOUND('部门')
  }
  
  // 识别部门类型
  const departmentType = detectDepartmentType(dept.code, dept.name)
  
  let positionLevels: string[] = []
  const recommendedCodes: string[] = []
  
  // 情况1：总部部门（project_id IS NULL）
  // 总部部门可以显示所有总部级别的职位（level='hq'）
  if (dept.project_id === null) {
    positionLevels = ['hq']
    
    // 根据部门类型推荐职位
    if (departmentType === 'HR') {
      recommendedCodes.push('hq_hr')
    } else if (departmentType === 'FINANCE') {
      recommendedCodes.push('hq_finance', 'hq_finance_director')
    } else if (departmentType === 'ADMIN') {
      recommendedCodes.push('hq_admin_dept')
    }
    // 总部负责人职位始终可用
    recommendedCodes.push('hq_admin')
  }
  // 情况2：项目部门
  else {
    // 2.1 顶级部门（没有父部门）
    // 项目顶级部门可以显示项目级别和员工级别的职位
    if (!dept.parent_id) {
      positionLevels = ['project', 'employee']
      
      // 根据部门类型推荐职位
      if (departmentType === 'HR') {
        recommendedCodes.push('project_hr')
      } else if (departmentType === 'FINANCE') {
        recommendedCodes.push('project_finance')
      } else if (departmentType === 'ADMIN') {
        recommendedCodes.push('project_admin_dept')
      }
      // 项目负责人职位始终可用
      recommendedCodes.push('project_manager')
    }
    // 2.2 技术部门（部门代码为tech或名称包含"技术"）
    // 技术部门可以显示部门级别、组级别和员工级别的职位
    else if (dept.code === 'tech' || dept.name?.includes('技术')) {
      positionLevels = ['department', 'group', 'employee']
      
      // 检查是否有技术部门的子组
      const subGroups = await c.env.DB.prepare(`
        select code from org_departments 
        where parent_id = ? and active = 1
      `).bind(orgDepartmentId).all<{ code: string }>()
      
      const groupCodes = subGroups.results?.map(g => g.code) || []
      
      // 如果有子组，需要过滤出对应的组长职位
      if (groupCodes.includes('frontend_group')) {
        positionLevels.push('frontend_group')
        recommendedCodes.push('frontend_group_leader')
      }
      if (groupCodes.includes('backend_group')) {
        positionLevels.push('backend_group')
        recommendedCodes.push('backend_group_leader')
      }
      if (groupCodes.includes('product_group')) {
        positionLevels.push('product_group')
        recommendedCodes.push('product_group_leader')
      }
      if (groupCodes.includes('qa_group')) {
        positionLevels.push('qa_group')
        recommendedCodes.push('qa_group_leader')
      }
    }
    // 2.3 技术部门的子组
    // 子组可以显示组级别和员工级别的职位
    else if (dept.parent_code === 'tech' || dept.parent_name?.includes('技术')) {
      // 根据子组代码确定对应的组长职位
      if (dept.code === 'frontend_group') {
        positionLevels = ['group', 'employee']
        recommendedCodes.push('frontend_group_leader')
      } else if (dept.code === 'backend_group') {
        positionLevels = ['group', 'employee']
        recommendedCodes.push('backend_group_leader')
      } else if (dept.code === 'product_group') {
        positionLevels = ['group', 'employee']
        recommendedCodes.push('product_group_leader')
      } else if (dept.code === 'qa_group') {
        positionLevels = ['group', 'employee']
        recommendedCodes.push('qa_group_leader')
      } else {
        positionLevels = ['employee']
      }
    }
    // 2.4 其他部门（非技术部门，有父部门）
    // 普通部门可以显示部门级别和员工级别的职位
    else {
      positionLevels = ['department', 'employee']
      
      // 根据部门类型推荐职位
      if (departmentType === 'HR') {
        recommendedCodes.push('dept_hr')
      } else if (departmentType === 'FINANCE') {
        recommendedCodes.push('dept_finance')
      } else if (departmentType === 'ADMIN') {
        recommendedCodes.push('dept_admin')
      }
      recommendedCodes.push('dept_manager')
    }
  }
  
  // 构建查询条件
  let query = 'select * from positions where active = 1 and level in ('
  const binds: any[] = []
  
  // 处理特殊职位代码（组长职位）
  const specialGroupPositions: string[] = []
  if (positionLevels.includes('frontend_group')) {
    specialGroupPositions.push('frontend_group_leader')
    positionLevels = positionLevels.filter(l => l !== 'frontend_group')
  }
  if (positionLevels.includes('backend_group')) {
    specialGroupPositions.push('backend_group_leader')
    positionLevels = positionLevels.filter(l => l !== 'backend_group')
  }
  if (positionLevels.includes('product_group')) {
    specialGroupPositions.push('product_group_leader')
    positionLevels = positionLevels.filter(l => l !== 'product_group')
  }
  if (positionLevels.includes('qa_group')) {
    specialGroupPositions.push('qa_group_leader')
    positionLevels = positionLevels.filter(l => l !== 'qa_group')
  }
  
  // 如果有特殊职位代码，添加额外的查询条件
  if (specialGroupPositions.length > 0) {
    const placeholders = positionLevels.map(() => '?').join(',')
    const specialPlaceholders = specialGroupPositions.map(() => '?').join(',')
    query += `${placeholders}) or code in (${specialPlaceholders})`
    binds.push(...positionLevels, ...specialGroupPositions)
  } else {
    const placeholders = positionLevels.map(() => '?').join(',')
    query += `${placeholders})`
    binds.push(...positionLevels)
  }
  
  query += ' order by '
  
  // 如果有关推荐的职位代码，优先显示推荐职位
  // 注意：推荐职位已经包含在查询结果中，这里只是用来排序
  if (recommendedCodes.length > 0) {
    const recommendedPlaceholders = recommendedCodes.map(() => '?').join(',')
    query += `CASE WHEN code IN (${recommendedPlaceholders}) THEN 0 ELSE 1 END, `
    binds.push(...recommendedCodes) // 只添加一次，用于排序
  }
  
  query += 'sort_order, name'
  
  const rows = await c.env.DB.prepare(query).bind(...binds).all()
  
  // 如果没有任何职位，返回空结果
  if (!rows.results || rows.results.length === 0) {
    return c.json({
      results: [],
      department_info: {
        project_id: dept.project_id_value,
        project_name: dept.project_name,
        department_id: orgDepartmentId,
        department_name: dept.name,
      }
    })
  }
  
  // 标记推荐职位
  const results = (rows.results || []).map((pos: any) => ({
    ...pos,
    recommended: recommendedCodes.includes(pos.code)
  }))
  
  // 返回职位列表和部门信息（用于前端自动确定项目）
  return c.json({
    results,
    department_info: {
      project_id: dept.project_id_value,
      project_name: dept.project_name,
      department_id: orgDepartmentId,
      department_name: dept.name,
    }
  })
})

// 部门和站点路由已迁移到 master-data/departments.ts
// 以下代码保留用于向后兼容，将在后续完全移除

// master_dataRoutes.get('/departments', ...)  // 已迁移
// master_dataRoutes.post('/departments', ...)  // 已迁移
// master_dataRoutes.put('/departments/:id', ...)  // 已迁移
// master_dataRoutes.delete('/departments/:id', ...)  // 已迁移
// master_dataRoutes.get('/sites', ...)  // 已迁移
// master_dataRoutes.post('/sites', ...)  // 已迁移
// master_dataRoutes.put('/sites/:id', ...)  // 已迁移
// master_dataRoutes.delete('/sites/:id', ...)  // 已迁移

// 临时保留原始代码以确保兼容性（TODO: 完全移除）
master_dataRoutes.post('/departments', validateJson(createDepartmentSchema), async (c) => {
  try {
    if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createDepartmentSchema>>(c)
    const hq = body.hq_id ? { id: body.hq_id } : await getOrCreateDefaultHQ(c.env.DB)
    // 检查项目名称是否全局唯一
    const existed = await c.env.DB.prepare('select id from departments where name=?').bind(body.name).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('项目名称')
    const id = uuid()
    await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
      .bind(id, hq.id, body.name).run()
    
    // 确保userId存在后再记录审计日志
    const userId = c.get('userId') as string | undefined
    if (userId) {
      await logAudit(c.env.DB, userId, 'create', 'department', id, JSON.stringify({ name: body.name, hq_id: hq.id }))
    }
    
    // 为新创建的项目自动创建默认部门（人事部、财务部、行政部、开发部）
    await createDefaultOrgDepartments(c.env.DB, id, userId)
    
    return c.json({ id, hq_id: hq.id, name: body.name })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})


master_dataRoutes.get('/sites', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare(`
    select s.*, d.name as department_name
    from sites s
    left join departments d on d.id = s.department_id
    order by s.name
  `).all()
  return c.json({ results: rows.results ?? [] })
})


master_dataRoutes.post('/sites', validateJson(createSiteSchema), async (c) => {
  try {
    if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createSiteSchema>>(c)
    
    // 同一项目下站点重名校验
    const existed = await c.env.DB.prepare('select id from sites where department_id=? and name=? and active=1')
      .bind(body.department_id, body.name).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('名称')
    
    // 如果提供了站点编号，检查是否重复
    if (body.site_code) {
      const codeExisted = await c.env.DB.prepare('select id from sites where site_code=?').bind(body.site_code).first<{ id: string }>()
      if (codeExisted?.id) throw Errors.DUPLICATE('站点代码')
    }
    
    const id = uuid()
    await c.env.DB.prepare(`
      insert into sites(id,department_id,name,site_code,theme_style,theme_color,frontend_url,active) 
      values(?,?,?,?,?,?,?,1)
    `).bind(
      id, 
      body.department_id, 
      body.name,
      body.site_code || null,
      body.theme_style || null,
      body.theme_color || null,
      body.frontend_url || null
    ).run()
    logAuditAction(c, 'create', 'site', id, JSON.stringify({ 
      name: body.name, 
      department_id: body.department_id,
      site_code: body.site_code,
      theme_style: body.theme_style,
      theme_color: body.theme_color,
      frontend_url: body.frontend_url
    }))
    return c.json({ 
      id, 
      department_id: body.department_id,
      name: body.name,
      site_code: body.site_code,
      theme_style: body.theme_style,
      theme_color: body.theme_color,
      frontend_url: body.frontend_url
    })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// Update and delete operations

master_dataRoutes.put('/hq/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const hq = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update headquarters set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'headquarters', id, JSON.stringify(body))
  return c.json({ ok: true })
})


master_dataRoutes.delete('/hq/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const dept = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  await c.env.DB.prepare('update headquarters set active=0 where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'headquarters', id, JSON.stringify({ name: dept?.name }))
  return c.json({ ok: true })
})


master_dataRoutes.put('/departments/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, hq_id?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) {
    // 检查名称是否与其他项目重复
    const existed = await c.env.DB.prepare('select id from departments where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('项目名称')
    updates.push('name=?'); binds.push(body.name)
  }
  if (body.hq_id !== undefined) { updates.push('hq_id=?'); binds.push(body.hq_id) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update departments set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'update', 'department', id, JSON.stringify(body))
  }
  
  return c.json({ ok: true })
})


master_dataRoutes.delete('/departments/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('部门')
  // 检查是否有站点使用此项目（包括所有站点，不只是active的）
  const sites = await c.env.DB.prepare('select count(1) as cnt from sites where department_id=?').bind(id).first<{ cnt: number }>()
  if (sites && Number(sites.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')
  }
  await c.env.DB.prepare('delete from departments where id=?').bind(id).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'delete', 'department', id, JSON.stringify({ name: dept.name }))
  }
  
  return c.json({ ok: true })
})


master_dataRoutes.put('/sites/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ 
    name?: string
    department_id?: string
    site_code?: string
    theme_style?: string
    theme_color?: string
    frontend_url?: string
    active?: number 
  }>()
  const updates = []
  const binds = []
  
  if (body.name !== undefined) { 
    // 检查名称是否在同一项目下重复
    const existing = await c.env.DB.prepare('select department_id from sites where id=?').bind(id).first<{ department_id: string }>()
    const deptId = body.department_id || existing?.department_id
    if (deptId) {
      const existed = await c.env.DB.prepare('select id from sites where department_id=? and name=? and id!=? and active=1')
        .bind(deptId, body.name, id).first<{ id: string }>()
      if (existed?.id) throw Errors.DUPLICATE('名称')
    }
    updates.push('name=?'); binds.push(body.name) 
  }
  
  if (body.department_id !== undefined) { 
    // 如果更新项目，检查名称是否在新项目下重复
    if (body.name === undefined) {
      const existing = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
      if (existing?.name) {
        const existed = await c.env.DB.prepare('select id from sites where department_id=? and name=? and id!=? and active=1')
          .bind(body.department_id, existing.name, id).first<{ id: string }>()
        if (existed?.id) throw Errors.DUPLICATE('新部门中的名称')
      }
    }
    updates.push('department_id=?'); binds.push(body.department_id) 
  }
  
  if (body.site_code !== undefined) {
    // 检查站点编号是否重复
    if (body.site_code) {
      const codeExisted = await c.env.DB.prepare('select id from sites where site_code=? and id!=?').bind(body.site_code, id).first<{ id: string }>()
      if (codeExisted?.id) throw Errors.DUPLICATE('站点代码')
    }
    updates.push('site_code=?'); binds.push(body.site_code || null)
  }
  
  if (body.theme_style !== undefined) { updates.push('theme_style=?'); binds.push(body.theme_style || null) }
  if (body.theme_color !== undefined) { updates.push('theme_color=?'); binds.push(body.theme_color || null) }
  if (body.frontend_url !== undefined) { updates.push('frontend_url=?'); binds.push(body.frontend_url || null) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update sites set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'site', id, JSON.stringify(body))
  return c.json({ ok: true })
})


master_dataRoutes.delete('/sites/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')
  await c.env.DB.prepare('delete from sites where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'site', id, JSON.stringify({ name: site.name }))
  return c.json({ ok: true })
})

// Accounts

master_dataRoutes.get('/accounts', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const search = c.req.query('search')
  if (search) {
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
  return c.json({ results: rows.results ?? [] })
})

// 账户明细查询：查询指定账户的所有账变记录（必须在 /api/accounts/:id 之前定义）

master_dataRoutes.get('/accounts/:id/transactions', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
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


master_dataRoutes.post('/accounts', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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


master_dataRoutes.put('/accounts/:id', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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


master_dataRoutes.delete('/accounts/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
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


master_dataRoutes.get('/currencies', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const search = c.req.query('search')
  if (search) {
    const like = `%${search.toUpperCase()}%`
    const rows = await c.env.DB.prepare('select * from currencies where upper(code) like ? or upper(name) like ? order by code')
      .bind(like, like).all()
    return c.json({ results: rows.results ?? [] })
  }
  const rows = await c.env.DB.prepare('select * from currencies order by code').all()
  return c.json({ results: rows.results ?? [] })
})


master_dataRoutes.post('/currencies', validateJson(createCurrencySchema), async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCurrencySchema>>(c)
  const code = body.code
  
  // 检查币种代码是否已存在
  const existed = await c.env.DB.prepare('select code from currencies where code=?').bind(code).first<{ code: string }>()
  if (existed?.code) throw Errors.DUPLICATE('币种代码')
  
  await c.env.DB.prepare('insert into currencies(code,name,active) values(?,?,1)').bind(code, body.name).run()
  logAuditAction(c, 'create', 'currency', code, JSON.stringify({ name: body.name }))
  return c.json({ code, name: body.name })
})


master_dataRoutes.put('/currencies/:code', validateJson(updateCurrencySchema), async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
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


master_dataRoutes.delete('/currencies/:code', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
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

// Categories

master_dataRoutes.get('/categories', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  
  // 尝试从缓存获取
  const cached = getCache<any[]>(cacheKeys.categories)
  if (cached) {
    return c.json({ results: cached })
  }
  
  // 查询数据库
  const rows = await c.env.DB.prepare('select * from categories order by kind,name').all()
  const results = rows.results ?? []
  
  // 缓存5分钟
  setCache(cacheKeys.categories, results, 5 * 60 * 1000)
  
  return c.json({ results })
})


master_dataRoutes.post('/categories', validateJson(createCategorySchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCategorySchema>>(c)
  
  // 检查类别名称是否已存在
  const existed = await c.env.DB.prepare('select id from categories where name=?').bind(body.name).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('类别名称')
  
  const id = uuid()
  await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,?)')
    .bind(id, body.name, body.kind, body.parent_id ?? null).run()
  
  // 清除缓存
  deleteCache(cacheKeys.categories)
  deleteCache(cacheKeys.categoriesByKind(body.kind))
  
  logAuditAction(c, 'create', 'category', id, JSON.stringify({ name: body.name, kind: body.kind }))
  return c.json({ id, ...body })
})

// Update category (no delete allowed). Only name/kind allowed, and kind restricted to income|expense

master_dataRoutes.put('/categories/:id', validateJson(updateCategorySchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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
  
  // 清除缓存
  deleteCache(cacheKeys.categories)
  if (body.kind) {
    deleteCache(cacheKeys.categoriesByKind(body.kind))
  }
  
  logAuditAction(c, 'update', 'category', id, JSON.stringify(body))
  return c.json({ ok: true })
})


master_dataRoutes.delete('/categories/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const category = await c.env.DB.prepare('select name from categories where id=?').bind(id).first<{ name: string }>()
  if (!category) throw Errors.NOT_FOUND('类别')
  // 检查是否有流水使用此类别
  const flows = await c.env.DB.prepare('select count(1) as cnt from cash_flows where category_id=?').bind(id).first<{ cnt: number }>()
  if (flows && Number(flows.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')
  }
  await c.env.DB.prepare('delete from categories where id=?').bind(id).run()
  
  // 清除缓存
  deleteCache(cacheKeys.categories)
  
  logAuditAction(c, 'delete', 'category', id, JSON.stringify({ name: category.name }))
  return c.json({ ok: true })
})

// Simple cash flow create/list
master_dataRoutes.get('/flows', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  let sql = `
    select f.*, a.name as account_name, coalesce(c.name,'') as category_name
    from cash_flows f
    left join accounts a on a.id=f.account_id
    left join categories c on c.id=f.category_id
  `
  let binds: any[] = []
  const scoped = await applyDataScope(c, sql, binds)
  sql = scoped.sql + ' order by f.biz_date desc, f.created_at desc limit 200'
  binds = scoped.binds
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(rows.results ?? [])
})

// 文件上传：凭证上传
master_dataRoutes.post('/upload/voucher', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) throw Errors.VALIDATION_ERROR('文件必填')
  
  // 限制文件大小（10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) throw Errors.VALIDATION_ERROR('文件过大（最大10MB）')
  
  // 限制文件类型：只允许图片格式
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw Errors.VALIDATION_ERROR('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
  }
  
  // 后端只接收WebP格式（前端已转换）
  // 如果不是WebP格式，返回错误
  if (file.type !== 'image/webp') {
    throw Errors.VALIDATION_ERROR('请在前端将图片转换为WebP格式后上传')
  }
  
  try {
    // 生成唯一文件名：时间戳-随机字符串.webp
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${random}.webp`
    const key = `vouchers/${fileName}`
    
    // 上传到R2（已经是WebP格式）
    const bucket = c.env.VOUCHERS as R2Bucket
    await bucket.put(key, file, {
      httpMetadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
      },
      customMetadata: {
        originalName: file.name,
        originalType: file.type,
        uploadedAt: new Date().toISOString(),
      },
    })
    
    // 返回文件URL（使用相对路径，通过Pages Functions代理）
    const url = `/api/vouchers/${key}`
    return c.json({ url, key })
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(`上传失败: ${error.message}`)
  }
})

// 文件下载：凭证访问 - 使用通配符路由
master_dataRoutes.get('/vouchers/*', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  
  // 获取完整路径（去掉 /api/vouchers/ 前缀）
  const requestPath = c.req.path
  const fullPath = requestPath.replace('/api/vouchers/', '')
  
  // 如果路径为空或格式不正确，返回错误
  if (!fullPath || !fullPath.startsWith('vouchers/')) {
    throw Errors.VALIDATION_ERROR(`无效路径: ${fullPath}`)
  }
  
  try {
    const bucket = c.env.VOUCHERS as R2Bucket
    const object = await bucket.get(fullPath)
    if (!object) {
      // 返回更详细的错误信息用于调试
      throw Errors.NOT_FOUND('凭证文件')
    }
    
    const headers = new Headers()
    headers.set('Content-Type', 'image/webp') // 统一返回WebP格式
    headers.set('Cache-Control', 'public, max-age=31536000')
    
    return new Response(object.body, { headers })
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(`下载失败: ${error.message}`)
  }
})

// 计算账户当前余额（账变前金额）
async function getAccountBalanceBefore(db: D1Database, accountId: string, transactionDate: string, transactionTime: number): Promise<number> {
  // 期初余额
  const ob = await db.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
    .bind(accountId).first<{ ob: number }>()
  
  // 计算账变前的所有交易
  // 需要考虑同一天的情况：只计算在此交易时间之前的交易
  const pre = await db.prepare(`
    select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
    from cash_flows 
    where account_id=? 
    and (biz_date < ? or (biz_date = ? and created_at < ?))
  `).bind(accountId, transactionDate, transactionDate, transactionTime).first<{ s: number }>()
  
  return (ob?.ob ?? 0) + (pre?.s ?? 0)
}

master_dataRoutes.post('/flows', validateJson(createCashFlowSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCashFlowSchema>>(c)
  const id = uuid()
  const now = Date.now()
  const amount = body.amount_cents
  
  // 支持单个URL或URL数组，转换为JSON字符串存储
  let voucherUrls: string[] = []
  if (body.voucher_urls && Array.isArray(body.voucher_urls)) {
    voucherUrls = body.voucher_urls.filter((url: string) => url && url.trim())
  } else if (body.voucher_url) {
    // 向后兼容：单个URL也支持
    voucherUrls = [body.voucher_url]
  }
  const voucherUrlJson = JSON.stringify(voucherUrls)

  // 归属规则：owner_scope=hq => department_id=null；owner_scope=department => 需提供 department_id 或 site_id
  let ownerScope = body.owner_scope as ('hq'|'department'|undefined)
  let departmentId = body.department_id ?? null
  if (!departmentId && body.site_id) {
    const r = await c.env.DB.prepare('select department_id from sites where id=?').bind(body.site_id).first<{ department_id: string }>()
    if (r?.department_id) departmentId = r.department_id
  }
  if (ownerScope === 'hq') {
    departmentId = null
  } else if (ownerScope === 'department') {
    if (!departmentId) throw Errors.VALIDATION_ERROR('department所有者需要提供department_id或site_id')
  } else {
    // 未显式声明时：若仍无departmentId则视为hq
    if (!departmentId) ownerScope = 'hq'
  }

  const method = body.method ?? null
  let voucherNo = body.voucher_no ?? null
  if (!voucherNo && body.biz_date) {
    const day = String(body.biz_date).replace(/-/g, '')
    const count = await c.env.DB
      .prepare('select count(1) as n from cash_flows where biz_date=?')
      .bind(body.biz_date).first<{ n: number }>()
    const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
    voucherNo = `JZ${day}-${seq}`
  }
  
  // 计算账变前金额
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, body.biz_date, now)
  
  // 计算账变金额（收入为正，支出为负）
  const delta = body.type === 'income' ? amount : (body.type === 'expense' ? -amount : 0)
  const balanceAfter = balanceBefore + delta
  
  // 插入流水记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, voucherNo, body.biz_date, body.type, body.account_id, body.category_id, method,
    amount, body.site_id ?? null, departmentId, body.counterparty ?? null, body.memo ?? null,
    voucherUrlJson, body.created_by ?? 'system', now
  ).run()
  
  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, id, body.biz_date, body.type, amount,
    balanceBefore, balanceAfter, now
  ).run()
  
  logAuditAction(c, 'create', 'cash_flow', id, JSON.stringify({ voucher_no: voucherNo, type: body.type, amount_cents: amount }))
  return c.json({ id })
})

// ================= AR/AP =================
function todayStr() { const d = new Date(); const y=d.getFullYear(); const m=('0'+(d.getMonth()+1)).slice(-2); const dd=('0'+d.getDate()).slice(-2); return `${y}-${m}-${dd}` }
async function nextDocNo(db: D1Database, kind: 'AR'|'AP', date: string) {
  const count = await db.prepare('select count(1) as n from ar_ap_docs where kind=? and issue_date=?').bind(kind, date).first<{ n:number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3,'0')
  const day = date.replace(/-/g,'')
  return `${kind}${day}-${seq}`
}

master_dataRoutes.get('/ar/docs', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
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
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json(rows.results ?? [])
})

master_dataRoutes.post('/ar/docs', validateJson(createArApDocSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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

master_dataRoutes.get('/ar/settlements', validateQuery(docIdQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const rows = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(query.doc_id).all()
  return c.json(rows.results ?? [])
})

async function refreshDocStatus(db: D1Database, docId: string) {
  const doc = await db.prepare('select amount_cents from ar_ap_docs where id=?').bind(docId).first<{ amount_cents:number }>()
  if (!doc) return
  const s = await db.prepare('select coalesce(sum(settle_amount_cents),0) as s from settlements where doc_id=?').bind(docId).first<{ s:number }>()
  const total = s?.s ?? 0
  const status = total <= 0 ? 'open' : (total < (doc.amount_cents ?? 0) ? 'partially_settled' : 'settled')
  await db.prepare('update ar_ap_docs set status=? where id=?').bind(status, docId).run()
}

master_dataRoutes.post('/ar/settlements', validateJson(createSettlementSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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
master_dataRoutes.get('/ar/statement', validateQuery(docIdQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const docId = query.doc_id
  
  const doc = await c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(docId).first<any>()
  const settlements = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(docId).all<any>()
  const settled = (settlements.results ?? []).reduce((a:number,b:any)=>a+(b.settle_amount_cents||0),0)
  const remaining = (doc?.amount_cents ?? 0) - settled
  return c.json({ doc, settlements: settlements.results ?? [], settled_cents: settled, remaining_cents: remaining })
})

// 确认AR/AP文档，生成对应的收入/支出记录
master_dataRoutes.post('/ar/confirm', validateJson(confirmArApDocSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
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
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, body.biz_date, now)
  
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
master_dataRoutes.get('/reports/department-cash', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  let sql = `
    select d.id as department_id, d.name as department_name,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents
    from departments d
    left join cash_flows f on f.department_id=d.id and f.biz_date>=? and f.biz_date<=?
  `
  let binds: any[] = [start, end]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' where d.id=?'
      binds.push(deptId)
    }
  }
  
  sql += ' group by d.id, d.name order by d.name'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  const mapped = (rows.results ?? []).map((r:any)=>({ ...r, net_cents: (r.income_cents||0) - (r.expense_cents||0) }))
  return c.json({ rows: mapped })
})

// Site cash summary + growth vs previous equal-length period
master_dataRoutes.get('/reports/site-growth', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  const startDate = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime())/86400000)+1)
  const prevEnd = new Date(startDate.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (days-1)*86400000)
  const prevStartStr = prevStart.toISOString().slice(0,10)
  const prevEndStr = prevEnd.toISOString().slice(0,10)

  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let curSql = `
    select s.id as site_id, s.name as site_name,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
  `
  let curBinds: any[] = [start, end]
  
  let prevSql = `
    select s.id as site_id,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
  `
  let prevBinds: any[] = [prevStartStr, prevEndStr]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      curSql += ' where s.department_id=?'
      curBinds.push(deptId)
      prevSql += ' where s.department_id=?'
      prevBinds.push(deptId)
    }
  }
  
  curSql += ' group by s.id, s.name'
  prevSql += ' group by s.id'
  
  const cur = await c.env.DB.prepare(curSql).bind(...curBinds).all<any>()
  const prev = await c.env.DB.prepare(prevSql).bind(...prevBinds).all<any>()
  
  const prevMap = new Map((prev.results ?? []).map((r:any)=>[r.site_id, r.income_cents||0]))
  const rows = (cur.results ?? []).map((r:any)=>{
    const net = (r.income_cents||0) - (r.expense_cents||0)
    const prevIncome = prevMap.get(r.site_id) || 0
    const growth_rate = prevIncome === 0 ? (r.income_cents>0? 1 : 0) : (r.income_cents - prevIncome)/prevIncome
    return { ...r, net_cents: net, prev_income_cents: prevIncome, growth_rate }
  })
  return c.json({ rows, prev_range: { start: prevStartStr, end: prevEndStr } })
})

// AR/AP summary by status and totals for period
master_dataRoutes.get('/reports/ar-summary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const kind = c.req.query('kind') // AR|AP
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!kind || !['AR','AP'].includes(kind)) throw Errors.VALIDATION_ERROR('kind AR|AP参数必填')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    where d.kind=? and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [kind, start, end]
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0, settled = 0
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status]||0) + (r.amount_cents||0)
  }
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AR detail - 应收账款明细
master_dataRoutes.get('/reports/ar-detail', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  try {
    const start = c.req.query('start')
    const end = c.req.query('end')
    let sql = `
      select d.*, coalesce(s.sum_settle,0) as settled_cents,
        (d.amount_cents - coalesce(s.sum_settle,0)) as remaining_cents
      from ar_ap_docs d
      left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
      where d.kind='AR'
    `
    let binds: any[] = []
    if (start && end) {
      sql += ' and d.issue_date>=? and d.issue_date<=?'
      binds.push(start, end)
    }
    sql += ' order by d.issue_date desc, d.doc_no desc'
    
    // 应用数据权限过滤
    const scoped = await applyDataScope(c, sql, binds)
    const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
    return c.json({ rows: docs.results ?? [] })
  } catch (err: any) {
    console.error('AR detail error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// AP summary - 应付账款汇总
master_dataRoutes.get('/reports/ap-summary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
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
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0, settled = 0
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status]||0) + (r.amount_cents||0)
  }
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AP detail - 应付账款明细
master_dataRoutes.get('/reports/ap-detail', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  try {
    const start = c.req.query('start')
    const end = c.req.query('end')
    let sql = `
      select d.*, coalesce(s.sum_settle,0) as settled_cents,
        (d.amount_cents - coalesce(s.sum_settle,0)) as remaining_cents
      from ar_ap_docs d
      left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
      where d.kind='AP'
    `
    let binds: any[] = []
    if (start && end) {
      sql += ' and d.issue_date>=? and d.issue_date<=?'
      binds.push(start, end)
    }
    sql += ' order by d.issue_date desc, d.doc_no desc'
    
    // 应用数据权限过滤
    const scoped = await applyDataScope(c, sql, binds)
    const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
    return c.json({ rows: docs.results ?? [] })
  } catch (err: any) {
    console.error('AP detail error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// Daily expense summary by category - 日常支出汇总
master_dataRoutes.get('/reports/expense-summary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select c.id as category_id, c.name as category_name,
      coalesce(sum(f.amount_cents),0) as total_cents,
      count(*) as count
    from categories c
    left join cash_flows f on f.category_id=c.id and f.type='expense' and f.biz_date>=? and f.biz_date<=?
    where c.kind='expense'
  `
  let binds: any[] = [start, end]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and (f.department_id=? or f.department_id is null)'
      binds.push(deptId)
    }
  }
  
  sql += ' group by c.id, c.name having count(*) > 0 order by total_cents desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  let total = 0
  for (const r of rows.results ?? []) {
    total += r.total_cents || 0
  }
  return c.json({ total_cents: total, rows: rows.results ?? [] })
})

// Daily expense detail by category - 日常支出明细
master_dataRoutes.get('/reports/expense-detail', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const start = c.req.query('start')
  const end = c.req.query('end')
  const categoryId = c.req.query('category_id')
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select f.id, f.voucher_no, f.biz_date, f.amount_cents, f.counterparty, f.memo,
      c.name as category_name, a.name as account_name,
      d.name as department_name, s.name as site_name
    from cash_flows f
    left join categories c on c.id=f.category_id
    left join accounts a on a.id=f.account_id
    left join departments d on d.id=f.department_id
    left join sites s on s.id=f.site_id
    where f.type='expense' and f.biz_date>=? and f.biz_date<=?
  `
  let binds: any[] = [start, end]
  
  if (categoryId) {
    sql += ' and f.category_id=?'
    binds.push(categoryId)
  }
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and (f.department_id=? or f.department_id is null)'
      binds.push(deptId)
    }
  }
  
  sql += ' order by f.biz_date desc, f.created_at desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  return c.json({ rows: rows.results ?? [] })
})

// Site revenue - 站点收费（站点的收入统计）
// Account balance summary - 账号余额汇总
master_dataRoutes.get('/reports/account-balance', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const asOf = c.req.query('as_of') // YYYY-MM-DD，查询截至日期的余额
  if (!asOf) throw Errors.VALIDATION_ERROR('as_of参数必填（格式：YYYY-MM-DD）')
  
  // 获取所有活跃账户
  const accounts = await c.env.DB.prepare('select id, name, type, currency, account_number from accounts where active=1 order by name').all<any>()
  
  const rows = []
  for (const acc of (accounts.results || [])) {
    // 期初余额：opening_balances + 截至asOf之前的交易
    const ob = await c.env.DB.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
      .bind(acc.id).first<{ ob: number }>()
    
    const pre = await c.env.DB.prepare(`
      select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
      from cash_flows where account_id=? and biz_date<?
    `).bind(acc.id, asOf).first<{ s: number }>()
    
    const opening = (ob?.ob ?? 0) + (pre?.s ?? 0)
    
    // 截至asOf当天的交易
    const period = await c.env.DB.prepare(`
      select 
        coalesce(sum(case when type='income' then amount_cents else 0 end),0) as income_cents,
        coalesce(sum(case when type='expense' then amount_cents else 0 end),0) as expense_cents
      from cash_flows where account_id=? and biz_date=?
    `).bind(acc.id, asOf).first<{ income_cents: number, expense_cents: number }>()
    
    const closing = opening + (period?.income_cents ?? 0) - (period?.expense_cents ?? 0)
    
    rows.push({
      account_id: acc.id,
      account_name: acc.name,
      account_type: acc.type,
      account_number: acc.account_number,
      currency: acc.currency,
      opening_cents: opening,
      income_cents: period?.income_cents ?? 0,
      expense_cents: period?.expense_cents ?? 0,
      closing_cents: closing
    })
  }
  
  return c.json({ rows, as_of: asOf })
})

// 借款报表 - 按个人汇总
// 员工薪资表 - 按月份统计每个员工的薪资
master_dataRoutes.get('/reports/employee-salary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const year = c.req.query('year') || new Date().getFullYear().toString()
  const month = c.req.query('month') // 可选，如果提供则只显示该月
  
  // 查询所有活跃员工
  const employees = await c.env.DB.prepare(`
    select 
      e.id,
      e.name,
      e.department_id,
      d.name as department_name,
      e.join_date,
      e.probation_salary_cents,
      e.regular_salary_cents,
      e.status,
      e.regular_date
    from employees e
    left join departments d on e.department_id = d.id
    where e.active = 1
    order by d.name, e.name
  `).all<any>()
  
  const rows = []
  const yearNum = parseInt(year)
  const monthNum = month ? parseInt(month) : null
  
  for (const emp of (employees.results || [])) {
    const joinDate = new Date(emp.join_date + 'T00:00:00Z')
    const joinYear = joinDate.getFullYear()
    const joinMonth = joinDate.getMonth() + 1
    
    // 如果指定了月份，只计算该月
    if (monthNum) {
      // 检查员工在该月是否在职
      if (joinYear > yearNum || (joinYear === yearNum && joinMonth > monthNum)) {
        continue // 还未入职
      }
      
      // 计算该月应发工资
      let salaryCents = 0
      let workDays = 0
      
      if (emp.status === 'regular' && emp.regular_date) {
        // 已转正，检查转正日期
        const regularDate = new Date(emp.regular_date + 'T00:00:00Z')
        const regularYear = regularDate.getFullYear()
        const regularMonth = regularDate.getMonth() + 1
        
        if (regularYear < yearNum || (regularYear === yearNum && regularMonth < monthNum)) {
          // 转正日期早于该月，使用转正工资
          salaryCents = emp.regular_salary_cents
        } else if (regularYear === yearNum && regularMonth === monthNum) {
          // 该月转正，需要按比例计算
          const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
          const regularDay = regularDate.getDate()
          const probationDays = regularDay - 1
          const regularDays = daysInMonth - regularDay + 1
          salaryCents = Math.round(
            (emp.probation_salary_cents * probationDays + emp.regular_salary_cents * regularDays) / daysInMonth
          )
        } else {
          // 还未转正，使用试用期工资
          salaryCents = emp.probation_salary_cents
        }
      } else {
        // 未转正，使用试用期工资
        salaryCents = emp.probation_salary_cents
      }
      
      // 计算该月实际工作天数
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
      if (joinYear === yearNum && joinMonth === monthNum) {
        // 该月入职
        workDays = daysInMonth - joinDate.getDate() + 1
      } else {
        workDays = daysInMonth
      }
      
      // 查询该员工在该月的请假记录（仅已批准的）
      const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
      const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const leaves = await c.env.DB.prepare(`
        select leave_type, start_date, end_date, days
        from employee_leaves
        where employee_id = ? 
          and status = 'approved'
          and start_date <= ?
          and end_date >= ?
      `).bind(emp.id, monthEnd, monthStart).all<any>()
      
      // 计算需要扣除的请假天数（非年假）
      let leaveDaysToDeduct = 0
      for (const leave of (leaves.results || [])) {
        if (leave.leave_type !== 'annual') {
          // 非年假需要扣除，需要计算在该月的实际天数
          const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
          const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
          const monthStartDate = new Date(monthStart + 'T00:00:00Z')
          const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
          
          // 计算请假记录与当前月份的交集
          const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
          const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
          
          if (overlapStart <= overlapEnd) {
            const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            leaveDaysToDeduct += overlapDays
          }
        }
      }
      
      // 从工作天数中扣除非年假的请假天数
      workDays = Math.max(0, workDays - leaveDaysToDeduct)
      
      // 计算应发工资（按实际工作天数）
      const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)
      
      rows.push({
        employee_id: emp.id,
        employee_name: emp.name,
        department_id: emp.department_id,
        department_name: emp.department_name,
        year: yearNum,
        month: monthNum,
        join_date: emp.join_date,
        status: emp.status,
        regular_date: emp.regular_date,
        base_salary_cents: salaryCents,
        work_days: workDays,
        days_in_month: daysInMonth,
        leave_days: leaveDaysToDeduct,
        actual_salary_cents: actualSalaryCents,
      })
    } else {
      // 未指定月份，计算全年12个月
      for (let m = 1; m <= 12; m++) {
        // 检查员工在该月是否在职
        if (joinYear > yearNum || (joinYear === yearNum && joinMonth > m)) {
          continue // 还未入职
        }
        
        // 计算该月应发工资
        let salaryCents = 0
        let workDays = 0
        
        if (emp.status === 'regular' && emp.regular_date) {
          const regularDate = new Date(emp.regular_date + 'T00:00:00Z')
          const regularYear = regularDate.getFullYear()
          const regularMonth = regularDate.getMonth() + 1
          
          if (regularYear < yearNum || (regularYear === yearNum && regularMonth < m)) {
            salaryCents = emp.regular_salary_cents
          } else if (regularYear === yearNum && regularMonth === m) {
            const daysInMonth = new Date(yearNum, m, 0).getDate()
            const regularDay = regularDate.getDate()
            const probationDays = regularDay - 1
            const regularDays = daysInMonth - regularDay + 1
            salaryCents = Math.round(
              (emp.probation_salary_cents * probationDays + emp.regular_salary_cents * regularDays) / daysInMonth
            )
          } else {
            salaryCents = emp.probation_salary_cents
          }
        } else {
          salaryCents = emp.probation_salary_cents
        }
        
        const daysInMonth = new Date(yearNum, m, 0).getDate()
        if (joinYear === yearNum && joinMonth === m) {
          workDays = daysInMonth - joinDate.getDate() + 1
        } else {
          workDays = daysInMonth
        }
        
        // 查询该员工在该月的请假记录（仅已批准的）
        const monthStart = `${yearNum}-${String(m).padStart(2, '0')}-01`
        const monthEnd = `${yearNum}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
        
        const leaves = await c.env.DB.prepare(`
          select leave_type, start_date, end_date, days
          from employee_leaves
          where employee_id = ? 
            and status = 'approved'
            and start_date <= ?
            and end_date >= ?
        `).bind(emp.id, monthEnd, monthStart).all<any>()
        
        // 计算需要扣除的请假天数（非年假）
        let leaveDaysToDeduct = 0
        for (const leave of (leaves.results || [])) {
          if (leave.leave_type !== 'annual') {
            // 非年假需要扣除，需要计算在该月的实际天数
            const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
            const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
            const monthStartDate = new Date(monthStart + 'T00:00:00Z')
            const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
            
            // 计算请假记录与当前月份的交集
            const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
            const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
            
            if (overlapStart <= overlapEnd) {
              const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              leaveDaysToDeduct += overlapDays
            }
          }
        }
        
        // 从工作天数中扣除非年假的请假天数
        workDays = Math.max(0, workDays - leaveDaysToDeduct)
        
        const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)
        
        rows.push({
          employee_id: emp.id,
          employee_name: emp.name,
          department_id: emp.department_id,
          department_name: emp.department_name,
          year: yearNum,
          month: m,
          join_date: emp.join_date,
          status: emp.status,
          regular_date: emp.regular_date,
          base_salary_cents: salaryCents,
          work_days: workDays,
          days_in_month: daysInMonth,
          leave_days: leaveDaysToDeduct,
          actual_salary_cents: actualSalaryCents,
        })
      }
    }
  }
  
  return c.json({ results: rows })
})

master_dataRoutes.get('/reports/borrowing-summary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  // 查询每个人的借款汇总（按币种分组）
  const sql = `
    select 
      br.id as borrower_id, 
      br.name as borrower_name, 
      br.position,
      b.currency,
      coalesce(sum(b.amount_cents), 0) as total_borrowed_cents,
      coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.borrower_id = b.borrower_id and b2.currency = b.currency
        )
      ), 0) as total_repaid_cents,
      (coalesce(sum(b.amount_cents), 0) - coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.borrower_id = b.borrower_id and b2.currency = b.currency
        )
      ), 0)) as balance_cents
    from borrowers br
    inner join borrowings b on b.borrower_id = br.id
    where br.active = 1
    group by br.id, br.name, br.position, b.currency
    having balance_cents != 0
    order by br.name, b.currency
  `
  
  const rows = await c.env.DB.prepare(sql).all()
  return c.json(rows.results ?? [])
})

// 借款报表 - 个人明细（借款和还款记录）
master_dataRoutes.get('/reports/borrowing-detail/:borrower_id', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const borrowerId = c.req.param('borrower_id')
  
  // 优化：并行查询借款人信息、借款记录和还款记录
  const [borrower, borrowings, repayments] = await Promise.all([
    c.env.DB.prepare('select * from borrowers where id=?').bind(borrowerId).first<any>(),
    c.env.DB.prepare(`
      select b.*, 
        a.name as account_name, a.currency as account_currency,
        u.name as creator_name
      from borrowings b
      left join accounts a on a.id=b.account_id
      left join users u on u.id=b.created_by
      where b.borrower_id=?
      order by b.borrow_date desc, b.created_at desc
    `).bind(borrowerId).all(),
    c.env.DB.prepare(`
      select r.*, 
        b.borrower_id, b.borrow_date,
        a.name as account_name, a.currency as account_currency,
        u.name as creator_name
      from repayments r
      left join borrowings b on b.id=r.borrowing_id
      left join accounts a on a.id=r.account_id
      left join users u on u.id=r.created_by
      where b.borrower_id=?
      order by r.repay_date desc, r.created_at desc
    `).bind(borrowerId).all()
  ])
  
  if (!borrower) throw Errors.NOT_FOUND('borrower')
  
  return c.json({
    borrower: {
      id: borrower.id,
      name: borrower.name,
      position: borrower.position,
      contact: borrower.contact,
    },
    borrowings: borrowings.results || [],
    repayments: repayments.results || [],
  })
})

master_dataRoutes.get('/reports/new-site-revenue', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const start = c.req.query('start')
  const end = c.req.query('end')
  const days = Number(c.req.query('days')) || 30 // 站点的定义：创建后N天内
  if (!start || !end) throw Errors.VALIDATION_ERROR('start和end参数必填')
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select s.id as site_id, s.name as site_name, s.created_at as site_created_at,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents,
      count(distinct case when f.type='income' then f.id end) as income_count
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
    where julianday(?) - julianday(datetime(s.created_at/1000, 'unixepoch')) <= ?
    and s.created_at is not null
  `
  let binds: any[] = [start, end, end, days]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and s.department_id=?'
      binds.push(deptId)
    }
  }
  
  sql += ' group by s.id, s.name, s.created_at order by s.created_at desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  const mapped = (rows.results ?? []).map((r:any)=>({ 
    ...r, 
    net_cents: (r.income_cents||0) - (r.expense_cents||0) 
  }))
  return c.json({ rows: mapped })
})

// ================= CSV Import =================
function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
  return lines.map(l => {
    // very naive CSV split (no complex quotes support for MVP)
    return l.split(',').map(s => s.trim())
  })
}

master_dataRoutes.post('/import', validateQuery(csvImportQuerySchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof csvImportQuerySchema>>(c)
  const kind = query.kind
  const csv = await c.req.text()
  const rows = parseCsv(csv)
  if (rows.length < 2) throw Errors.VALIDATION_ERROR('没有数据行')
  const header = rows[0].map(h => h.toLowerCase())
  const data = rows.slice(1)
  let inserted = 0

  if (kind === 'flows') {
    // expected headers: biz_date,type,account_id,amount,site_id,department_id,counterparty,memo,category_id,voucher_no,method
    const idx = (name: string) => header.indexOf(name)
    const ix = {
      biz_date: idx('biz_date'), type: idx('type'), account_id: idx('account_id'), amount: idx('amount'),
      site_id: idx('site_id'), department_id: idx('department_id'), counterparty: idx('counterparty'), memo: idx('memo'),
      category_id: idx('category_id'), voucher_no: idx('voucher_no'), method: idx('method')
    }
    
    // 先按日期排序，确保账变记录的计算顺序正确
    const sortedData = [...data].sort((a, b) => {
      const dateA = a[ix.biz_date] || ''
      const dateB = b[ix.biz_date] || ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return 0
    })
    
    for (const r of sortedData) {
      if (!r[ix.biz_date] || !r[ix.type] || !r[ix.account_id] || !r[ix.amount]) continue
      const id = uuid()
      const amount = Math.round(Number(r[ix.amount]) * 100)
      // 使用递增的时间戳，确保同一天的记录按顺序处理
      const now = Date.now() + inserted
      
      // 计算账变前金额
      const balanceBefore = await getAccountBalanceBefore(c.env.DB, r[ix.account_id], r[ix.biz_date], now)
      
      // 计算账变金额（收入为正，支出为负）
      const delta = r[ix.type] === 'income' ? amount : (r[ix.type] === 'expense' ? -amount : 0)
      const balanceAfter = balanceBefore + delta
      
      await c.env.DB.prepare(`
        insert into cash_flows(id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,site_id,department_id,counterparty,memo,created_by,created_at)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, r[ix.voucher_no] || null, r[ix.biz_date], r[ix.type], r[ix.account_id], r[ix.category_id] || null, r[ix.method] || null,
        amount, r[ix.site_id] || null, r[ix.department_id] || null, r[ix.counterparty] || null, r[ix.memo] || null,
        'import', now
      ).run()
      
      // 生成账变记录
      const transactionId = uuid()
      await c.env.DB.prepare(`
        insert into account_transactions(
          id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
          balance_before_cents, balance_after_cents, created_at
        ) values(?,?,?,?,?,?,?,?,?)
      `).bind(
        transactionId, r[ix.account_id], id, r[ix.biz_date], r[ix.type], amount,
        balanceBefore, balanceAfter, now
      ).run()
      
      inserted++
    }
    logAuditAction(c, 'import', 'cash_flow', undefined, JSON.stringify({ kind, rows: inserted }))
    return c.json({ ok: true, inserted })
  }

  if (kind === 'AR' || kind === 'AP') {
    // expected headers: issue_date,due_date,amount,party_id,site_id,department_id,memo
    const idx = (name: string) => header.indexOf(name)
    const ix = {
      issue_date: idx('issue_date'), due_date: idx('due_date'), amount: idx('amount'), party_id: idx('party_id'),
      site_id: idx('site_id'), department_id: idx('department_id'), memo: idx('memo')
    }
    for (const r of data) {
      if (!r[ix.issue_date] || !r[ix.amount]) continue
      const id = uuid()
      const amount = Math.round(Number(r[ix.amount]) * 100)
      const docNo = await nextDocNo(c.env.DB, kind as 'AR'|'AP', r[ix.issue_date])
      await c.env.DB.prepare(`
        insert into ar_ap_docs(id,kind,doc_no,party_id,site_id,department_id,issue_date,due_date,amount_cents,status,memo)
        values(?,?,?,?,?,?,?,?,?,'open',?)
      `).bind(id, kind, docNo, r[ix.party_id] || null, r[ix.site_id] || null, r[ix.department_id] || null, r[ix.issue_date], r[ix.due_date] || null, amount, r[ix.memo] || null).run()
      inserted++
    }
    logAuditAction(c, 'import', 'ar_ap_doc', undefined, JSON.stringify({ kind, rows: inserted }))
    return c.json({ ok: true, inserted })
  }

  if (kind === 'opening') {
    // expected headers: type,ref_id,amount,as_of
    const idx = (name: string) => header.indexOf(name)
    const ix = { type: idx('type'), ref_id: idx('ref_id'), amount: idx('amount'), as_of: idx('as_of') }
    for (const r of data) {
      if (!r[ix.type] || !r[ix.ref_id] || !r[ix.amount] || !r[ix.as_of]) continue
      const id = uuid()
      const amount = Math.round(Number(r[ix.amount]) * 100)
      await c.env.DB.prepare('insert into opening_balances(id,type,ref_id,amount_cents,as_of) values(?,?,?,?,?)')
        .bind(id, r[ix.type], r[ix.ref_id], amount, r[ix.as_of]).run()
      inserted++
    }
    logAuditAction(c, 'import', 'opening_balance', undefined, JSON.stringify({ kind, rows: inserted }))
    return c.json({ ok: true, inserted })
  }

  throw Errors.VALIDATION_ERROR('不支持的类型')
})

// ================= 个人借支管理 =================

// 供应商管理 - 列表

master_dataRoutes.get('/vendors', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from vendors order by name').all()
  return c.json({ results: rows.results ?? [] })
})

// 供应商管理 - 创建

master_dataRoutes.post('/vendors', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = await c.req.json<{ name: string, contact?: string }>()
  if (!body.name) throw Errors.VALIDATION_ERROR('name参数必填')
  
  // 检查名称是否重复
  const existed = await c.env.DB.prepare('select id from vendors where name=?').bind(body.name).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('供应商名称')
  
  const id = uuid()
  await c.env.DB.prepare('insert into vendors(id,name,contact) values(?,?,?)')
    .bind(id, body.name, body.contact || null).run()
  
  logAuditAction(c, 'create', 'vendor', id, JSON.stringify({ name: body.name }))
  return c.json({ id, name: body.name, contact: body.contact || null })
})

// 供应商管理 - 更新

master_dataRoutes.put('/vendors/:id', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, contact?: string }>()
  
  const record = await c.env.DB.prepare('select * from vendors where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('供应商')
  
  // 如果更新名称，检查是否重复
  if (body.name && body.name !== record.name) {
    const existed = await c.env.DB.prepare('select id from vendors where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('供应商名称')
  }
  
  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.contact !== undefined) { updates.push('contact=?'); binds.push(body.contact) }
  
  if (updates.length === 0) return c.json(record)
  
  binds.push(id)
  await c.env.DB.prepare(`update vendors set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  logAuditAction(c, 'update', 'vendor', id, JSON.stringify(body))
  const updated = await c.env.DB.prepare('select * from vendors where id=?').bind(id).first()
  return c.json(updated)
})

// 供应商管理 - 删除

master_dataRoutes.delete('/vendors/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare('select * from vendors where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('供应商')
  
  // 检查是否有应付账款使用此供应商
  const apDocs = await c.env.DB.prepare('select count(1) as cnt from ar_ap_docs where kind=? and party_id=?').bind('AP', id).first<{ cnt: number }>()
  if (apDocs && Number(apDocs.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该供应商还有应付账款记录')
  }
  
  await c.env.DB.prepare('delete from vendors where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'vendor', id, JSON.stringify({ name: record.name }))
  return c.json({ ok: true })
})

// ================= 组织部门管理 =================

// 获取所有部门（树形结构）
master_dataRoutes.get('/org-departments', async (c) => {
  if (!(await canReadAsync(c))) throw Errors.FORBIDDEN()
  const projectId = c.req.query('project_id')
  
  let query = `
    select od.*, 
           d.name as project_name,
           p.name as parent_name,
           CASE WHEN od.project_id IS NULL THEN '总部' ELSE d.name END as display_project_name
    from org_departments od
    left join departments d on d.id = od.project_id
    left join org_departments p on p.id = od.parent_id
    where 1=1
  `
  const binds: any[] = []
  
  if (projectId === 'hq') {
    // 查询总部直属部门
    query += ' and od.project_id IS NULL'
  } else if (projectId) {
    query += ' and od.project_id = ?'
    binds.push(projectId)
  }
  
  query += ' order by od.project_id IS NULL, od.project_id, od.sort_order, od.name'
  
  const rows = await c.env.DB.prepare(query).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 创建部门
master_dataRoutes.post('/org-departments', async (c) => {
  try {
    if (!(await requireRole(c, ['finance', 'auditor']))) throw Errors.FORBIDDEN()
    const body = await c.req.json<{ 
      project_id?: string | null  // null表示总部直属部门
      parent_id?: string
      name: string
      code?: string
      description?: string
      sort_order?: number
    }>()
    
    if (!body.name) {
      throw Errors.VALIDATION_ERROR('name参数必填')
    }
    
    if (!body.code) {
      throw Errors.VALIDATION_ERROR('code参数必填')
    }
    
    // 如果指定了项目，验证项目是否存在
    if (body.project_id !== undefined && body.project_id !== null) {
      const project = await c.env.DB.prepare('select id from departments where id=?').bind(body.project_id).first<{ id: string }>()
      if (!project) {
        throw Errors.NOT_FOUND('project')
      }
    }
    
    // 如果指定了父部门，验证父部门是否存在且属于同一项目或总部
    if (body.parent_id) {
      const parent = await c.env.DB.prepare('select project_id from org_departments where id=?').bind(body.parent_id).first<{ project_id: string | null }>()
      if (!parent) {
        throw Errors.NOT_FOUND('parent department')
      }
      // 父部门必须属于同一项目或总部（project_id都为null）
      const targetProjectId = body.project_id || null
      if (parent.project_id !== targetProjectId) {
        throw Errors.BUSINESS_ERROR('上级部门必须属于同一项目或总部')
      }
    }
    
    // 检查同一层级（同一项目/总部、同一父部门）下名称是否重复
    const projectId = body.project_id || null
    const parentId = body.parent_id || ''
    const existed = await c.env.DB.prepare(`
      select id from org_departments 
      where COALESCE(project_id, '') = COALESCE(?, '') 
        and COALESCE(parent_id, '') = ? 
        and name=? 
        and active=1
    `).bind(projectId, parentId, body.name).first<{ id: string }>()
    
    if (existed?.id) {
      throw Errors.DUPLICATE('department name in same level')
    }
    
    const id = uuid()
    const now = Date.now()
    await c.env.DB.prepare(`
      insert into org_departments(id, project_id, parent_id, name, code, description, active, sort_order, created_at, updated_at)
      values(?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      id,
      projectId,
      body.parent_id || null,
      body.name,
      body.code || null,
      body.description || null,
      body.sort_order || 0,
      now,
      now
    ).run()
    
    const userId = c.get('userId') as string | undefined
    if (userId) {
      await logAudit(c.env.DB, userId, 'create', 'org_department', id, JSON.stringify({
        project_id: projectId,
        parent_id: body.parent_id,
        name: body.name,
        code: body.code,
        description: body.description
      }))
    }
    
    const created = await c.env.DB.prepare(`
      select od.*, 
             d.name as project_name, 
             p.name as parent_name,
             CASE WHEN od.project_id IS NULL THEN '总部' ELSE d.name END as display_project_name
      from org_departments od
      left join departments d on d.id = od.project_id
      left join org_departments p on p.id = od.parent_id
      where od.id=?
    `).bind(id).first()
    
    return c.json(created)
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// 更新部门
master_dataRoutes.put('/org-departments/:id', async (c) => {
  try {
    if (!(await requireRole(c, ['finance', 'auditor']))) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = await c.req.json<{ 
      name?: string
      code?: string
      description?: string
      parent_id?: string
      sort_order?: number
      active?: number
    }>()
    
    const existing = await c.env.DB.prepare('select * from org_departments where id=?').bind(id).first<any>()
    if (!existing) {
      throw Errors.NOT_FOUND('部门')
    }
    
    // 如果更新父部门，验证父部门是否存在且属于同一项目或总部，且不能是自身或子部门
    if (body.parent_id !== undefined) {
      if (body.parent_id) {
        // 不能将父部门设置为自身
        if (body.parent_id === id) {
          throw Errors.BUSINESS_ERROR('不能将上级部门设置为自己')
        }
        
        // 验证父部门是否存在
        const parent = await c.env.DB.prepare('select project_id from org_departments where id=?').bind(body.parent_id).first<{ project_id: string | null }>()
        if (!parent) {
          throw Errors.NOT_FOUND('parent department')
        }
        
        // 父部门必须属于同一项目或总部（project_id都为null）
        const existingProjectId = existing.project_id || null
        if (parent.project_id !== existingProjectId) {
          throw Errors.BUSINESS_ERROR('上级部门必须属于同一项目或总部')
        }
        
        // 检查是否会造成循环引用（不能将父部门设置为自己的子部门）
        const checkCycle = async (deptId: string, targetId: string): Promise<boolean> => {
          const children = await c.env.DB.prepare('select id from org_departments where parent_id=?').bind(deptId).all<{ id: string }>()
          for (const child of children.results || []) {
            if (child.id === targetId) return true
            if (await checkCycle(child.id, targetId)) return true
          }
          return false
        }
        
        if (await checkCycle(id, body.parent_id)) {
          throw Errors.BUSINESS_ERROR('不能将上级部门设置为子部门')
        }
      }
    }
    
    // 如果更新名称，检查同级是否重复
    if (body.name && body.name !== existing.name) {
      const parentId = body.parent_id !== undefined ? (body.parent_id || '') : (existing.parent_id || '')
      const existingProjectId = existing.project_id || null
      const existed = await c.env.DB.prepare(`
        select id from org_departments 
        where COALESCE(project_id, '') = COALESCE(?, '') 
          and COALESCE(parent_id, '') = ? 
          and name=? 
          and id!=? 
          and active=1
      `).bind(existingProjectId, parentId, body.name, id).first<{ id: string }>()
      
      if (existed?.id) {
        throw Errors.DUPLICATE('部门名称（同一层级）')
      }
    }
    
    const updates: string[] = []
    const binds: any[] = []
    
    if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
    if (body.code !== undefined) { 
      if (!body.code || body.code.trim() === '') {
        throw Errors.VALIDATION_ERROR('code不能为空')
      }
      updates.push('code=?'); 
      binds.push(body.code) 
    }
    if (body.description !== undefined) { updates.push('description=?'); binds.push(body.description || null) }
    if (body.parent_id !== undefined) { updates.push('parent_id=?'); binds.push(body.parent_id || null) }
    if (body.sort_order !== undefined) { updates.push('sort_order=?'); binds.push(body.sort_order) }
    if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
    
    if (updates.length === 0) {
      throw Errors.VALIDATION_ERROR('没有需要更新的字段')
    }
    
    updates.push('updated_at=?')
    binds.push(Date.now())
    binds.push(id)
    
    await c.env.DB.prepare(`update org_departments set ${updates.join(',')} where id=?`).bind(...binds).run()
    
    const userId = c.get('userId') as string | undefined
    if (userId) {
      await logAudit(c.env.DB, userId, 'update', 'org_department', id, JSON.stringify(body))
    }
    
    const updated = await c.env.DB.prepare(`
      select od.*, 
             d.name as project_name, 
             p.name as parent_name,
             CASE WHEN od.project_id IS NULL THEN '总部' ELSE d.name END as display_project_name
      from org_departments od
      left join departments d on d.id = od.project_id
      left join org_departments p on p.id = od.parent_id
      where od.id=?
    `).bind(id).first()
    
    return c.json(updated)
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// 删除部门
master_dataRoutes.delete('/org-departments/:id', async (c) => {
  try {
    if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    
    const dept = await c.env.DB.prepare('select * from org_departments where id=?').bind(id).first<any>()
    if (!dept) {
      throw Errors.NOT_FOUND('部门')
    }
    
    // 检查是否有子部门
    const children = await c.env.DB.prepare('select count(1) as cnt from org_departments where parent_id=?').bind(id).first<{ cnt: number }>()
    if (children && Number(children.cnt) > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该部门还有子部门')
    }
    
    // 检查是否有员工使用此部门（需要检查employees表是否有org_department_id字段）
    // 注意：如果employees表还没有org_department_id字段，可以先软删除
    // 这里先检查是否有employees表，如果有则检查
    try {
      const employees = await c.env.DB.prepare('select count(1) as cnt from employees where org_department_id=?').bind(id).first<{ cnt: number }>()
      if (employees && Number(employees.cnt) > 0) {
        throw Errors.BUSINESS_ERROR('无法删除，该部门还有员工')
      }
    } catch {
      // employees表可能还没有org_department_id字段，暂时忽略
    }
    
    await c.env.DB.prepare('delete from org_departments where id=?').bind(id).run()
    
    const userId = c.get('userId') as string | undefined
    if (userId) {
      await logAudit(c.env.DB, userId, 'delete', 'org_department', id, JSON.stringify({ name: dept.name }))
    }
    
    return c.json({ ok: true })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// 员工管理 - 列表
