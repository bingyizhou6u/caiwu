/**
 * 组织部门管理 Hook
 */
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery, useApiMutation } from '../useApiQuery'
import { api } from '../../config/api'
import type { SelectOption } from '../../types'

// 组织部门类型
export interface OrgDepartment {
    id: string
    project_id: string | null
    parentId: string | null
    name: string
    code: string | null
    description: string | null
    allowed_modules: string[] | null
    allowed_positions: string[] | null
    default_position_id: string | null
    active: number
    sortOrder: number
    default_position_name?: string | null
    parent_name?: string | null
    project_name?: string | null
}

interface OrgDepartmentListResponse {
    results: OrgDepartment[]
}

/**
 * 查询组织部门列表
 */
export function useOrgDepartments(projectId?: string) {
    const queryParams = new URLSearchParams()
    if (projectId) {
        queryParams.set('project_id', projectId)
    }
    const url = queryParams.toString()
        ? `${api.orgDepartments}?${queryParams.toString()}`
        : api.orgDepartments

    return useApiQuery<OrgDepartmentListResponse>(
        ['org-departments', projectId || 'all'],
        url,
        { staleTime: 30000 }
    )
}

/**
 * 查询组织部门选项（SelectOption 格式）
 */
export function useOrgDepartmentOptions(projectId?: string) {
    const { data, isLoading, error } = useOrgDepartments(projectId)

    const options: SelectOption[] = (data?.results || [])
        .filter((d) => d.active === 1)
        .map((d) => ({
            label: d.name,
            value: d.id,
        }))

    return { options, isLoading, error }
}

/**
 * 创建组织部门
 */
export function useCreateOrgDepartment() {
    const queryClient = useQueryClient()

    return useApiMutation<OrgDepartment, Partial<OrgDepartment>>(
        async (data) => {
            const response = await fetch(api.orgDepartments, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || '创建失败')
            }
            const result = await response.json()
            return result.data
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['org-departments'] })
            },
        }
    )
}

/**
 * 更新组织部门
 */
export function useUpdateOrgDepartment() {
    const queryClient = useQueryClient()

    return useApiMutation<OrgDepartment, { id: string; data: Partial<OrgDepartment> }>(
        async ({ id, data }) => {
            const response = await fetch(api.orgDepartmentsById(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || '更新失败')
            }
            const result = await response.json()
            return result.data
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['org-departments'] })
            },
        }
    )
}

/**
 * 删除组织部门
 */
export function useDeleteOrgDepartment() {
    const queryClient = useQueryClient()

    return useApiMutation<void, string>(
        async (id) => {
            const response = await fetch(api.orgDepartmentsById(id), {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || '删除失败')
            }
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['org-departments'] })
            },
        }
    )
}
