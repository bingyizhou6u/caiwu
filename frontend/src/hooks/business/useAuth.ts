import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation } from '@tanstack/react-query'
import type { LoginResponse } from '../../types/auth'

/**
 * 检查API健康状态
 * 用于登录页面显示连接状态
 */
export function useHealth() {
    return useApiQuery<{ checks?: { db?: boolean } }>(
        ['health'],
        api.health,
        {
            staleTime: 30 * 1000, // 30秒缓存
            retry: 1,
            refetchOnWindowFocus: false,
        }
    )
}

/**
 * 登录Hook
 * 注意：登录操作不需要缓存，使用mutation
 */
export function useLogin() {
    return useMutation({
        mutationFn: async (payload: { email: string; password: string; totp?: string }) => {
            const result = await apiClient.post<LoginResponse>(api.auth.loginPassword, payload)
            return result
        },
    })
}

/**
 * 请求TOTP重置Hook
 */
export function useRequestTotpReset() {
    return useMutation({
        mutationFn: async (payload: { email: string }) => {
            await apiClient.post(api.auth.requestTotpReset, payload)
        },
    })
}

/**
 * 验证TOTP重置Token Hook
 */
export function useVerifyTotpResetToken() {
    return useMutation({
        mutationFn: async (token: string) => {
            await apiClient.get(`${api.auth.verifyTotpResetToken}?token=${token}`)
        },
    })
}

/**
 * 确认TOTP重置Hook
 */
export function useConfirmTotpReset() {
    return useMutation({
        mutationFn: async (token: string) => {
            await apiClient.post(api.auth.confirmTotpReset, { token })
        },
    })
}

/**
 * 生成TOTP重绑定QR码Hook
 */
export function useGenerateTotpRebind() {
    return useMutation({
        mutationFn: async (token: string) => {
            const result = await apiClient.post<{ secret: string; qrCode: string; email: string }>(
                api.auth.generateTotpRebind,
                { token }
            )
            return result
        },
    })
}

/**
 * 确认TOTP重绑定Hook
 */
export function useConfirmTotpRebind() {
    return useMutation({
        mutationFn: async (payload: { token: string; secret: string; totpCode: string }) => {
            await apiClient.post(api.auth.confirmTotpRebind, payload)
        },
    })
}
