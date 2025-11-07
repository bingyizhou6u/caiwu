/**
 * 薪资报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead, canViewReports, applyDataScope } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const salaryReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 员工薪资报表
salaryReportsRoutes.get('/employee-salary', async (c) => {
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
        
        let leaveDaysToDeduct = 0
        for (const leave of (leaves.results || [])) {
          if (leave.leave_type !== 'annual') {
            const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
            const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
            const monthStartDate = new Date(monthStart + 'T00:00:00Z')
            const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
            
            const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
            const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
            
            if (overlapStart <= overlapEnd) {
              const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              leaveDaysToDeduct += overlapDays
            }
          }
        }
        
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
  
  return c.json({ rows })
})

