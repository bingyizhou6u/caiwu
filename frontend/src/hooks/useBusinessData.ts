import { useApiQuery } from '../utils/useApiQuery'
import { api } from '../config/api'
import { CACHE_TIME } from '../config/cache'
import { SelectOption } from '../types/business'

// 注意: useCurrencies 已移至 hooks/business/useCurrencies.ts
// 请使用 useCurrencyOptions 获取 SelectOption[] 格式的币种选项

// 注意: useDepartments 已移至 hooks/business/useDepartments.ts
// 请使用 useDepartmentOptions 获取 SelectOption[] 格式的部门选项

export function useAccounts() {
    return useApiQuery<SelectOption[]>(
        ['accounts'],
        api.accounts,
        {
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).filter((r: any) => r.active === 1).map((r: any) => {
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
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).filter((c: any) => c.kind === 'expense').map((c: any) => ({
                value: String(c.id),
                label: c.name,
                kind: 'expense'
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
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).filter((c: any) => c.kind === 'income').map((c: any) => ({
                value: String(c.id),
                label: c.name,
                kind: 'income'
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
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).map((c: any) => ({
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
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).map((r: any) => ({
                value: r.id,
                label: r.name,
                departmentId: r.departmentId
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
            select: (data: any) => (Array.isArray(data) ? data : data?.results || [])
                .filter((e: any) => !activeOnly || (e.active === 1 && e.status !== 'resigned'))
                .map((e: any) => ({
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
