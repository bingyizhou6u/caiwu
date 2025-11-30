export interface User {
    id: string
    email: string
    name: string
    sessionId?: string
    active?: number
    last_login_at?: number
    department_id?: string | null
    org_department_id?: string | null
    position?: {
        id: string
        code: string
        name: string
        level: number // 1-总部 2-项目 3-组
        function_role: string // director/hr/finance/admin/developer
        can_manage_subordinates: number
        permissions: Record<string, Record<string, string[]>> // 三级权限结构: 模块-子模块-操作
    }
}

export interface APIResponse<T = any> {
    error?: string
    code?: string
    details?: any
    [key: string]: any
}

export interface PaginatedResponse<T> {
    results: T[]
    total?: number
    page?: number
    pageSize?: number
}
export * from './auth'
