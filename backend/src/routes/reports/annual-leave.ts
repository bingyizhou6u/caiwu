/**
 * 年假统计报表 API
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { getAnnualLeaveStats, getAnnualLeaveConfig } from '../../services/AnnualLeaveService.js'

export const annualLeaveReportRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取全员年假统计
annualLeaveReportRoutes.get('/annual-leave', async (c) => {
  // 只有有请假报表查看权限的人可以查看
  if (!hasPermission(c, 'report', 'view', 'leave') && !hasPermission(c, 'report', 'view', 'all')) {
    throw Errors.FORBIDDEN('没有查看年假报表的权限')
  }

  const departmentId = c.req.query('department_id')
  const orgDepartmentId = c.req.query('org_department_id')
  
  // 获取年假配置
  const config = await getAnnualLeaveConfig(c.env.DB)
  
  // 获取所有在职员工
  let sql = `
    SELECT e.id, e.name, e.join_date, e.department_id, e.org_department_id,
           d.name as department_name, od.name as org_department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN org_departments od ON od.id = e.org_department_id
    WHERE e.active = 1 AND e.status != 'resigned'
  `
  const binds: any[] = []
  
  if (departmentId) {
    sql += ' AND e.department_id = ?'
    binds.push(departmentId)
  }
  if (orgDepartmentId) {
    sql += ' AND e.org_department_id = ?'
    binds.push(orgDepartmentId)
  }
  
  sql += ' ORDER BY d.name, od.name, e.name'
  
  const employees = await c.env.DB.prepare(sql).bind(...binds).all() as D1Result<{
    id: string
    name: string
    join_date: string
    department_id: string
    org_department_id: string
    department_name: string
    org_department_name: string
  }>
  
  // 为每个员工计算年假统计
  const results = []
  for (const emp of employees.results || []) {
    if (!emp.join_date) continue
    
    try {
      const stats = await getAnnualLeaveStats(c.env.DB, emp.id, emp.join_date)
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        departmentName: emp.department_name,
        orgDepartmentName: emp.org_department_name,
        joinDate: emp.join_date,
        cycleNumber: stats.cycle.cycleNumber,
        cycleStart: stats.cycle.cycleStart,
        cycleEnd: stats.cycle.cycleEnd,
        isFirstCycle: stats.cycle.isFirstCycle,
        entitledDays: stats.entitledDays,
        usedDays: stats.usedDays,
        remainingDays: stats.remainingDays,
        usageRate: stats.entitledDays > 0 
          ? Math.round((stats.usedDays / stats.entitledDays) * 100) 
          : 0,
      })
    } catch (e) {
      console.error(`Failed to get annual leave stats for ${emp.id}:`, e)
    }
  }
  
  // 计算汇总
  const summary = {
    totalEmployees: results.length,
    totalEntitled: results.reduce((sum, r) => sum + r.entitledDays, 0),
    totalUsed: results.reduce((sum, r) => sum + r.usedDays, 0),
    totalRemaining: results.reduce((sum, r) => sum + r.remainingDays, 0),
    avgUsageRate: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.usageRate, 0) / results.length)
      : 0,
  }
  
  return c.json({
    config: {
      cycleMonths: config.cycleMonths,
      daysPerCycle: config.daysPerCycle,
    },
    summary,
    results,
  })
})

// 获取单个员工的年假详情
annualLeaveReportRoutes.get('/annual-leave/:employeeId', async (c) => {
  // 所有人都可以查看
  
  const employeeId = c.req.param('employeeId')
  
  const emp = await c.env.DB.prepare(`
    SELECT e.*, d.name as department_name, od.name as org_department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN org_departments od ON od.id = e.org_department_id
    WHERE e.id = ?
  `).bind(employeeId).first() as any | null
  
  if (!emp) throw Errors.NOT_FOUND('员工')
  if (!emp.join_date) throw Errors.BUSINESS_ERROR('员工入职日期未设置')
  
  const stats = await getAnnualLeaveStats(c.env.DB, employeeId, emp.join_date)
  
  // 获取本周期的年假使用记录
  const leaveRecords = await c.env.DB.prepare(`
    SELECT * FROM employee_leaves
    WHERE employee_id = ? AND leave_type = 'annual' AND status = 'approved'
      AND start_date >= ? AND start_date <= ?
    ORDER BY start_date DESC
  `).bind(employeeId, stats.cycle.cycleStart, stats.cycle.cycleEnd).all() as D1Result<any>
  
  return c.json({
    employee: {
      id: emp.id,
      name: emp.name,
      joinDate: emp.join_date,
      departmentName: emp.department_name,
      orgDepartmentName: emp.org_department_name,
    },
    stats,
    leaveRecords: leaveRecords.results || [],
  })
})
