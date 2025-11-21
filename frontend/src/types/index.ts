export interface User {
    id: string
    email: string
    name: string
    role: string
    active: number
    last_login_at?: number
    department_id?: string | null
    org_department_id?: string | null
    position?: {
        id: string
        code: string
        name: string
        level: string
        scope: string
        permissions: Record<string, boolean>
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
