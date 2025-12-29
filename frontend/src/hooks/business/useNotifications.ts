/**
 * 通知相关 Hooks
 * 处理站内通知的查询和操作
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// API 请求函数
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const baseUrl = '/api/v2'
    const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        credentials: 'include',
    })
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
    }
    return response.json()
}

// 通知类型
export interface Notification {
    id: string
    recipientId: string
    type: 'system' | 'approval' | 'task' | 'message'
    title: string
    content?: string
    link?: string
    relatedEntityType?: string
    relatedEntityId?: string
    isRead: number
    createdAt: number
    readAt?: number
}

// 获取通知列表参数
export interface NotificationFilters {
    isRead?: boolean
    type?: string
    limit?: number
    offset?: number
}

// 查询键
const NOTIFICATION_KEYS = {
    all: ['notifications'] as const,
    list: (filters?: NotificationFilters) => ['notifications', 'list', filters] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
}

/**
 * 获取通知列表
 */
export function useNotifications(filters?: NotificationFilters) {
    return useQuery({
        queryKey: NOTIFICATION_KEYS.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.isRead !== undefined) params.set('isRead', String(filters.isRead))
            if (filters?.type) params.set('type', filters.type)
            if (filters?.limit) params.set('limit', String(filters.limit))
            if (filters?.offset) params.set('offset', String(filters.offset))

            const queryString = params.toString()
            const url = `/notifications${queryString ? `?${queryString}` : ''}`

            const response = await apiRequest<{ success: boolean; data: Notification[] }>(url)
            return response.data
        },
    })
}

/**
 * 获取未读通知数量
 */
export function useUnreadCount() {
    return useQuery({
        queryKey: NOTIFICATION_KEYS.unreadCount(),
        queryFn: async () => {
            const response = await apiRequest<{ success: boolean; data: { count: number } }>(
                '/notifications/unread-count'
            )
            return response.data.count
        },
        // 每 30 秒自动刷新
        refetchInterval: 30000,
        // 窗口聚焦时刷新
        refetchOnWindowFocus: true,
    })
}

/**
 * 标记单条通知为已读
 */
export function useMarkAsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            await apiRequest(`/notifications/${id}/read`, { method: 'PUT' })
        },
        onSuccess: () => {
            // 刷新通知列表和未读数量
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
        },
    })
}

/**
 * 标记所有通知为已读
 */
export function useMarkAllAsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await apiRequest<{ success: boolean; data: { markedCount: number } }>(
                '/notifications/read-all',
                { method: 'PUT' }
            )
            return response.data.markedCount
        },
        onSuccess: () => {
            // 刷新通知列表和未读数量
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
        },
    })
}

/**
 * 删除通知
 */
export function useDeleteNotification() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            await apiRequest(`/notifications/${id}`, { method: 'DELETE' })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
        },
    })
}
