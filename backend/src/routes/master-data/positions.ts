import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { requireRole, canRead } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const positionsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取职位列表
positionsRoutes.get('/', async (c) => {
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
positionsRoutes.get('/available', async (c) => {
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
