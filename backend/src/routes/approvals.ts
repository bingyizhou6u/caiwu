/**
 * 审批路由
 * 处理请假、报销、借支等审批功能
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { Errors } from '../utils/errors.js'
import { logAuditAction } from '../utils/audit.js'
import { canManageSubordinates, getUserPosition, getUserEmployee, isHQDirector, isHQFinance, isProjectDirector, isProjectFinance } from '../utils/permissions.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { z } from 'zod'

export const approvalsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取当前用户可审批的员工ID列表（下属）
async function getSubordinateEmployeeIds(c: any): Promise<string[]> {
  const userId = c.get('userId')
  const userPosition = getUserPosition(c)
  const userEmployee = getUserEmployee(c)
  
  if (!userId || !userPosition) return []
  
  // 如果可以管理下属，获取下属列表
  if (!canManageSubordinates(c)) return []
  
  // 总部负责人和总部财务可以审批所有人
  if (isHQDirector(c) || isHQFinance(c)) {
    const all = await c.env.DB.prepare('SELECT id FROM employees WHERE active = 1').all() as D1Result<{ id: string }>
    return (all.results || []).map((e: { id: string }) => e.id)
  }
  
  // 项目负责人可以审批本项目员工
  if (isProjectDirector(c) && userEmployee?.department_id) {
    const dept = await c.env.DB.prepare(
      'SELECT id FROM employees WHERE department_id = ? AND active = 1'
    ).bind(userEmployee.department_id).all() as D1Result<{ id: string }>
    return (dept.results || []).map((e: { id: string }) => e.id)
  }
  
  // 组长可以审批本组员工
  if (userPosition.code === 'team_leader' && userEmployee?.org_department_id) {
    const team = await c.env.DB.prepare(
      'SELECT id FROM employees WHERE org_department_id = ? AND active = 1'
    ).bind(userEmployee.org_department_id).all() as D1Result<{ id: string }>
    return (team.results || []).map((e: { id: string }) => e.id)
  }
  
  return []
}

// ==================== 待审批列表 ====================

approvalsRoutes.get('/approvals/pending', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const subordinateIds = await getSubordinateEmployeeIds(c)
  if (subordinateIds.length === 0) {
    return c.json({ leaves: [], reimbursements: [], borrowings: [] })
  }
  
  const placeholders = subordinateIds.map(() => '?').join(',')
  
  // 待审批的请假
  const pendingLeaves = await c.env.DB.prepare(`
    SELECT el.*, u.id as emp_user_id, u.name as employee_name, 
           d.name as department_name, od.name as org_department_name
    FROM employee_leaves el
    LEFT JOIN employees e ON e.id = el.employee_id
    LEFT JOIN users u ON u.email = e.email
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN org_departments od ON od.id = e.org_department_id
    WHERE el.status = 'pending' AND el.employee_id IN (${placeholders})
    ORDER BY el.created_at DESC
  `).bind(...subordinateIds).all() as D1Result<any>
  
  // 待审批的报销
  const pendingReimbursements = await c.env.DB.prepare(`
    SELECT er.*, u.id as emp_user_id, u.name as employee_name,
           d.name as department_name, od.name as org_department_name,
           c.symbol as currency_symbol
    FROM expense_reimbursements er
    LEFT JOIN employees e ON e.id = er.employee_id
    LEFT JOIN users u ON u.email = e.email
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN org_departments od ON od.id = e.org_department_id
    LEFT JOIN currencies c ON c.code = er.currency_id
    WHERE er.status = 'pending' AND er.employee_id IN (${placeholders})
    ORDER BY er.created_at DESC
  `).bind(...subordinateIds).all() as D1Result<any>
  
  // 待审批的借支 (使用 user_id)
  const userIds = await c.env.DB.prepare(`
    SELECT DISTINCT user_id FROM employees WHERE id IN (${placeholders})
  `).bind(...subordinateIds).all() as D1Result<{ user_id: string }>
  
  let pendingBorrowings = { results: [] as any[] }
  const userIdList = (userIds.results || []).map((u: { user_id: string }) => u.user_id).filter(Boolean)
  if (userIdList.length > 0) {
    const userPlaceholders = userIdList.map(() => '?').join(',')
    pendingBorrowings = await c.env.DB.prepare(`
      SELECT b.*, u.name as employee_name, c.symbol as currency_symbol
      FROM borrowings b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN currencies c ON c.code = b.currency
      WHERE b.status = 'pending' AND b.user_id IN (${userPlaceholders})
      ORDER BY b.created_at DESC
    `).bind(...userIdList).all() as D1Result<any>
  }
  
  return c.json({
    leaves: pendingLeaves.results || [],
    reimbursements: pendingReimbursements.results || [],
    borrowings: pendingBorrowings.results || [],
    counts: {
      leaves: (pendingLeaves.results || []).length,
      reimbursements: (pendingReimbursements.results || []).length,
      borrowings: (pendingBorrowings.results || []).length,
    }
  })
})

// ==================== 已审批历史 ====================

approvalsRoutes.get('/approvals/history', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const limit = parseInt(c.req.query('limit') || '50')
  
  // 我审批过的请假
  const approvedLeaves = await c.env.DB.prepare(`
    SELECT el.*, u.name as employee_name, d.name as department_name
    FROM employee_leaves el
    LEFT JOIN employees e ON e.id = el.employee_id
    LEFT JOIN users u ON u.email = e.email
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE el.approved_by = ? AND el.status IN ('approved', 'rejected')
    ORDER BY el.approved_at DESC
    LIMIT ?
  `).bind(userId, limit).all() as D1Result<any>
  
  // 我审批过的报销
  const approvedReimbursements = await c.env.DB.prepare(`
    SELECT er.*, u.name as employee_name, d.name as department_name, c.symbol as currency_symbol
    FROM expense_reimbursements er
    LEFT JOIN employees e ON e.id = er.employee_id
    LEFT JOIN users u ON u.email = e.email
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN currencies c ON c.code = er.currency_id
    WHERE er.approved_by = ? AND er.status IN ('approved', 'rejected')
    ORDER BY er.approved_at DESC
    LIMIT ?
  `).bind(userId, limit).all() as D1Result<any>
  
  // 我审批过的借支
  const approvedBorrowings = await c.env.DB.prepare(`
    SELECT b.*, u.name as employee_name, c.symbol as currency_symbol
    FROM borrowings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN currencies c ON c.code = b.currency
    WHERE b.approved_by = ? AND b.status IN ('approved', 'rejected')
    ORDER BY b.approved_at DESC
    LIMIT ?
  `).bind(userId, limit).all() as D1Result<any>
  
  return c.json({
    leaves: approvedLeaves.results || [],
    reimbursements: approvedReimbursements.results || [],
    borrowings: approvedBorrowings.results || [],
  })
})

// ==================== 审批操作 ====================

const approvalActionSchema = z.object({
  memo: z.string().optional(),
})

// 审批请假 - 通过
approvalsRoutes.post('/approvals/leave/:id/approve', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  // 检查是否存在且待审批
  const leave = await c.env.DB.prepare(
    'SELECT * FROM employee_leaves WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!leave) throw Errors.NOT_FOUND('请假记录不存在或已处理')
  
  // 检查权限
  const subordinateIds = await getSubordinateEmployeeIds(c)
  if (!subordinateIds.includes(leave.employee_id)) {
    throw Errors.FORBIDDEN('无权审批此请假')
  }
  
  await c.env.DB.prepare(`
    UPDATE employee_leaves 
    SET status = 'approved', approved_by = ?, approved_at = ?, memo = COALESCE(?, memo), updated_at = ?
    WHERE id = ?
  `).bind(userId, now, body.memo || null, now, id).run()
  
  logAuditAction(c, 'approve', 'employee_leave', id, JSON.stringify({ action: 'approve' }))
  
  return c.json({ ok: true })
})

// 审批请假 - 驳回
approvalsRoutes.post('/approvals/leave/:id/reject', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  const leave = await c.env.DB.prepare(
    'SELECT * FROM employee_leaves WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!leave) throw Errors.NOT_FOUND('请假记录不存在或已处理')
  
  const subordinateIds = await getSubordinateEmployeeIds(c)
  if (!subordinateIds.includes(leave.employee_id)) {
    throw Errors.FORBIDDEN('无权审批此请假')
  }
  
  await c.env.DB.prepare(`
    UPDATE employee_leaves 
    SET status = 'rejected', approved_by = ?, approved_at = ?, memo = COALESCE(?, memo), updated_at = ?
    WHERE id = ?
  `).bind(userId, now, body.memo || null, now, id).run()
  
  logAuditAction(c, 'reject', 'employee_leave', id, JSON.stringify({ action: 'reject', memo: body.memo }))
  
  return c.json({ ok: true })
})

// 审批报销 - 通过
approvalsRoutes.post('/approvals/reimbursement/:id/approve', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  // 只有财务可以审批报销
  const canApprove = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canApprove) {
    throw Errors.FORBIDDEN('只有财务人员可以审批报销')
  }
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  const reimbursement = await c.env.DB.prepare(
    'SELECT * FROM expense_reimbursements WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!reimbursement) throw Errors.NOT_FOUND('报销记录不存在或已处理')
  
  await c.env.DB.prepare(`
    UPDATE expense_reimbursements 
    SET status = 'approved', approved_by = ?, approved_at = ?, memo = COALESCE(?, memo), updated_at = ?
    WHERE id = ?
  `).bind(userId, now, body.memo || null, now, id).run()
  
  logAuditAction(c, 'approve', 'expense_reimbursement', id, JSON.stringify({ action: 'approve' }))
  
  return c.json({ ok: true })
})

// 审批报销 - 驳回
approvalsRoutes.post('/approvals/reimbursement/:id/reject', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const canApprove = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canApprove) {
    throw Errors.FORBIDDEN('只有财务人员可以审批报销')
  }
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  const reimbursement = await c.env.DB.prepare(
    'SELECT * FROM expense_reimbursements WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!reimbursement) throw Errors.NOT_FOUND('报销记录不存在或已处理')
  
  await c.env.DB.prepare(`
    UPDATE expense_reimbursements 
    SET status = 'rejected', approved_by = ?, approved_at = ?, memo = COALESCE(?, memo), updated_at = ?
    WHERE id = ?
  `).bind(userId, now, body.memo || null, now, id).run()
  
  logAuditAction(c, 'reject', 'expense_reimbursement', id, JSON.stringify({ action: 'reject', memo: body.memo }))
  
  return c.json({ ok: true })
})

// 审批借支 - 通过
approvalsRoutes.post('/approvals/borrowing/:id/approve', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const canApprove = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canApprove) {
    throw Errors.FORBIDDEN('只有财务人员可以审批借支')
  }
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  const borrowing = await c.env.DB.prepare(
    'SELECT * FROM borrowings WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!borrowing) throw Errors.NOT_FOUND('借支记录不存在或已处理')
  
  await c.env.DB.prepare(`
    UPDATE borrowings 
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).bind(userId, now, id).run()
  
  logAuditAction(c, 'approve', 'borrowing', id, JSON.stringify({ action: 'approve' }))
  
  return c.json({ ok: true })
})

// 审批借支 - 驳回
approvalsRoutes.post('/approvals/borrowing/:id/reject', validateJson(approvalActionSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const canApprove = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canApprove) {
    throw Errors.FORBIDDEN('只有财务人员可以审批借支')
  }
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approvalActionSchema>>(c)
  const now = Date.now()
  
  const borrowing = await c.env.DB.prepare(
    'SELECT * FROM borrowings WHERE id = ? AND status = ?'
  ).bind(id, 'pending').first() as any | null
  
  if (!borrowing) throw Errors.NOT_FOUND('借支记录不存在或已处理')
  
  await c.env.DB.prepare(`
    UPDATE borrowings 
    SET status = 'rejected', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).bind(userId, now, id).run()
  
  logAuditAction(c, 'reject', 'borrowing', id, JSON.stringify({ action: 'reject', memo: body.memo }))
  
  return c.json({ ok: true })
})

