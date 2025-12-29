import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'

/**
 * 检查 API 健康状态
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
