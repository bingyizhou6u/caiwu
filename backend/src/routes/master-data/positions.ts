import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const positionsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取职位列表
positionsRoutes.get('/', async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const rows = await c.env.DB.prepare('select * from positions where active=1 order by sort_order, name').all()
    return c.json({ results: rows.results ?? [] })
})

// 层级标签映射
const LEVEL_LABELS: Record<number, string> = {
    1: '总部职位',
    2: '项目职位',
    3: '组级职位'
}

// 根据部门获取可用职位列表
// 采用层级+部门双重过滤机制：
// 1. 总部部门(project_id IS NULL) -> 显示 level=1 的职位
// 2. 项目部门(project_id IS NOT NULL) -> 显示 level=2,3 的职位
// 3. 如果部门配置了 allowed_positions，进一步过滤
positionsRoutes.get('/available', async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const orgDepartmentId = c.req.query('org_department_id')

    if (!orgDepartmentId) {
        throw Errors.VALIDATION_ERROR('org_department_id参数必填')
    }

    // 获取部门信息，包括 allowed_positions 配置
    const dept = await c.env.DB.prepare(`
        select od.id, od.project_id, od.name, od.code, od.allowed_positions,
           CASE WHEN od.project_id IS NULL THEN 'hq' ELSE d.id END as project_id_value,
               CASE WHEN od.project_id IS NULL THEN '总部' ELSE d.name END as project_name
    from org_departments od
    left join departments d on d.id = od.project_id
        where od.id = ? and od.active = 1
  `).bind(orgDepartmentId).first<{
        id: string
        project_id: string | null
        name: string
        code: string | null
        allowed_positions: string | null
        project_id_value: string
        project_name: string
    }>()

    if (!dept) {
        throw Errors.NOT_FOUND('部门')
    }

    // 根据部门类型确定层级过滤条件
    // 总部部门 -> level = 1
    // 项目部门 -> level IN (2, 3)
    const isHQ = dept.project_id === null
    const levelCondition = isHQ ? 'level = 1' : 'level IN (2, 3)'

    // 获取所有符合层级的职位
    const positionsResult = await c.env.DB.prepare(`
        select id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order
        from positions 
        where active = 1 and ${levelCondition}
        order by level, sort_order, name
    `).all<{
        id: string
        code: string
        name: string
        level: number
        function_role: string
        can_manage_subordinates: number
        description: string | null
        permissions: string | null
        sort_order: number
    }>()

    let positions = positionsResult.results || []

    // 如果部门配置了 allowed_positions，进一步过滤
    if (dept.allowed_positions) {
        try {
            const allowedIds = JSON.parse(dept.allowed_positions) as string[]
            if (Array.isArray(allowedIds) && allowedIds.length > 0) {
                positions = positions.filter(p => allowedIds.includes(p.id))
            }
        } catch {
            // JSON 解析失败，不做额外过滤
        }
    }

    // 按层级分组返回，方便前端展示
    const groupedPositions: Record<string, typeof positions> = {}
    for (const pos of positions) {
        const groupKey = LEVEL_LABELS[pos.level] || `其他(level=${pos.level})`
        if (!groupedPositions[groupKey]) {
            groupedPositions[groupKey] = []
        }
        groupedPositions[groupKey].push(pos)
    }

    return c.json({
        results: positions,
        grouped: groupedPositions,
        department_info: {
            project_id: dept.project_id_value,
            project_name: dept.project_name,
            department_id: orgDepartmentId,
            department_name: dept.name,
            is_hq: isHQ
        }
    })
})
