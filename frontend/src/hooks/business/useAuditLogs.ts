import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useQuery, keepPreviousData, useMutation } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'

export interface AuditLog {
    id: string
    at: number
    actorName?: string
    actorEmail?: string
    action: string
    entity: string
    entityId?: string
    detail?: string
    ip?: string
    ipLocation?: string
}

export interface AuditOptions {
    actions: string[]
    entities: string[]
    actors: { id: string, name: string, email: string }[]
}

export interface AuditLogQueryParams {
    limit: number
    offset: number
    action?: string
    entity?: string
    actor_keyword?: string
    start_time?: number
    end_time?: number
}

/**
 * 审计日志查询Hook
 */
export function useAuditLogs(params: AuditLogQueryParams) {
    // 构建查询键，包含所有参数以触发重新查询
    const queryKey = ['auditLogs', params]

    // 构建URL参数
    const buildQueryString = () => {
        const query = new URLSearchParams()
        query.append('limit', String(params.limit))
        query.append('offset', String(params.offset))

        if (params.action) query.append('action', params.action)
        if (params.entity) query.append('entity', params.entity)
        if (params.actor_keyword) query.append('actor_keyword', params.actor_keyword)
        if (params.start_time) query.append('start_time', String(params.start_time))
        if (params.end_time) query.append('end_time', String(params.end_time))

        return query.toString()
    }

    return useQuery({
        queryKey,
        queryFn: async () => {
            const queryString = buildQueryString()
            const response = await apiClient.get<{ results: AuditLog[], total: number }>(
                `${api.auditLogs}?${queryString}`
            )
            return response
        },
        placeholderData: keepPreviousData, // 保持之前的数据直到新数据加载完成，避免闪烁
        staleTime: CACHE_TIME.TRANSACTION_DATA,
    })
}

/**
 * 审计日志筛选选项Hook
 */
export function useAuditLogOptions() {
    return useApiQuery<AuditOptions>(
        ['auditLogsOptions'],
        api.auditLogsOptions,
        {
            staleTime: CACHE_TIME.MASTER_DATA, // 1小时缓存
        }
    )
}

export function useExportAuditLogs() {
    return useMutation({
        mutationFn: async (params: Omit<AuditLogQueryParams, 'limit' | 'offset'>) => {
            const query = new URLSearchParams()
            if (params.action) query.append('action', params.action)
            if (params.entity) query.append('entity', params.entity)
            if (params.actor_keyword) query.append('actor_keyword', params.actor_keyword)
            if (params.start_time) query.append('start_time', String(params.start_time))
            if (params.end_time) query.append('end_time', String(params.end_time))

            const response = await apiClient.get<Blob>(
                `${api.auditLogsExport}?${query.toString()}`,
                { responseType: 'blob' }
            )
            return response
        }
    })
}

export function useCreateAuditLog() {
    return useMutation({
        mutationFn: async (data: { action: string, entity: string, entityId?: string, detail?: string }) => {
            // 尝试记录审计日志，如果失败（如后端未实现）则忽略，避免影响用户操作
            try {
                await apiClient.post(api.auditLogsCreate, data)
            } catch (error) {
                console.warn('Failed to create audit log:', error)
            }
        }
    })
}
