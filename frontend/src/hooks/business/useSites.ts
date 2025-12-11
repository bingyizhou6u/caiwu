import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import type { Site, SelectOption } from '../../types'

/**
 * 站点数据查询Hook
 * 封装站点列表的查询逻辑
 * 
 * @param activeOnly - 是否只查询启用的站点
 * @returns 站点列表和查询状态
 */
export function useSites(activeOnly = false) {
    return useApiQuery<Site[]>(
        ['sites', activeOnly],
        api.sites,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                return activeOnly ? list.filter((s: Site) => s.active === 1) : list
            },
            staleTime: 10 * 60 * 1000, // 10分钟缓存
        }
    )
}

/**
 * 站点选项查询Hook
 * 返回适用于Select组件的选项格式
 * 
 * @param activeOnly - 是否只包含启用的站点
 * @returns Select组件选项格式的站点列表
 */
export function useSiteOptions(activeOnly = true) {
    const params = new URLSearchParams()
    params.append('activeOnly', String(activeOnly))
    const url = `${api.sites}?${params.toString()}`

    return useApiQuery<SelectOption[]>(
        ['sites', 'options', activeOnly],
        url,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                const filtered = activeOnly ? list.filter((s: any) => s.active === 1) : list
                return filtered.map((s: any) => ({
                    value: s.id,
                    label: s.name,
                }))
            },
            staleTime: 10 * 60 * 1000,
        }
    )
}
