import { useApiQuery } from '../utils/useApiQuery'
import { api } from '../config/api'
import { CACHE_TIME } from '../config/cache'
import type { SelectOption } from '../types/business'
import type { Account, Category, Site, Employee } from '../types/domain'
import type { ListResponse } from '../types/responses'

// 注意: useCurrencies 已移至 hooks/business/useCurrencies.ts
// 请使用 useCurrencyOptions 获取 SelectOption[] 格式的币种选项

// 注意: useDepartments 已移至 hooks/business/useDepartments.ts
// 请使用 useDepartmentOptions 获取 SelectOption[] 格式的部门选项

// API 响应类型（支持数组或 results 包装）
type ApiListResponse<T> = T[] | ListResponse<T>

// 辅助函数：从 API 响应中提取数组
function extractResults<T>(data: ApiListResponse<T>): T[] {
    return Array.isArray(data) ? data : data?.results || []
}

export function useAccounts() {
    return useApiQuery<SelectOption[]>(
        ['accounts'],
        api.accounts,
        {
            select: (data: ApiListResponse<Account>) =>
                extractResults(data)
                    .filter(r => r.active === 1)
                    .map(r => {
                        const aliasPart = r.alias ? ` (${r.alias})` : ''
                        const currencyPart = r.currency ? ` [${r.currency}]` : ''
                        return {
                            value: String(r.id),
                            label: `${r.name}${aliasPart}${currencyPart}`,
                            currency: r.currency,
                            search: `${r.name}${aliasPart}${currencyPart} ${r.currency || ''}`.toLowerCase()
                        }
                    }),
            staleTime: CACHE_TIME.BUSINESS_DATA
        }
    )
}

export function useExpenseCategories() {
    return useApiQuery<SelectOption[]>(
        ['categories', 'expense'],
        api.categories,
        {
            select: (data: ApiListResponse<Category>) =>
                extractResults(data)
                    .filter(c => c.kind === 'expense')
                    .map(c => ({
                        value: String(c.id),
                        label: c.name,
                        kind: 'expense' as const
                    })),
            staleTime: CACHE_TIME.MASTER_DATA
        }
    )
}

export function useIncomeCategories() {
    return useApiQuery<SelectOption[]>(
        ['categories', 'income'],
        api.categories,
        {
            select: (data: ApiListResponse<Category>) =>
                extractResults(data)
                    .filter(c => c.kind === 'income')
                    .map(c => ({
                        value: String(c.id),
                        label: c.name,
                        kind: 'income' as const
                    })),
            staleTime: CACHE_TIME.MASTER_DATA
        }
    )
}

export function useAllCategories() {
    return useApiQuery<SelectOption[]>(
        ['categories', 'all'],
        api.categories,
        {
            select: (data: ApiListResponse<Category>) =>
                extractResults(data)
                    .map(c => ({
                        value: String(c.id),
                        label: `${c.kind === 'income' ? '收入' : '支出'} - ${c.name}`,
                        kind: c.kind
                    })),
            staleTime: CACHE_TIME.MASTER_DATA
        }
    )
}

export function useSites() {
    return useApiQuery<SelectOption[]>(
        ['sites'],
        api.sites,
        {
            select: (data: ApiListResponse<Site>) =>
                extractResults(data)
                    .map(r => ({
                        value: r.id,
                        label: r.name,
                        projectId: r.projectId
                    })),
            staleTime: CACHE_TIME.MASTER_DATA
        }
    )
}

export function useEmployees(activeOnly: boolean = true) {
    return useApiQuery<SelectOption[]>(
        ['employees', activeOnly ? 'active' : 'all'],
        `${api.employees}${activeOnly ? '?activeOnly=true' : ''}`,
        {
            select: (data: ApiListResponse<Employee>) =>
                extractResults(data)
                    .filter(e => !activeOnly || (e.active === 1 && e.status !== 'resigned'))
                    .map(e => ({
                        value: String(e.id),
                        label: `${e.name} (${e.departmentName || '-'})`,
                        userId: e.userId,
                        userActive: e.userActive,
                        email: e.email
                    })),
            staleTime: CACHE_TIME.BUSINESS_DATA
        }
    )
}

