import { useApiQuery } from '../utils/useApiQuery'
import { api } from '../config/api'
import { SelectOption } from '../types/business'

export function useCurrencies() {
    return useApiQuery<SelectOption[]>(
        ['currencies'],
        api.currencies,
        {
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).filter((r: any) => r.active === 1).map((r: any) => ({
                value: String(r.code),
                label: `${r.code} - ${r.name}`
            })),
            staleTime: 5 * 60 * 1000
        }
    )
}

export function useDepartments() {
    return useApiQuery<SelectOption[]>(
        ['departments'],
        api.departments,
        {
            select: (data: any) => (Array.isArray(data) ? data : data?.results || []).filter((r: any) => r.active === 1).map((r: any) => ({
                value: String(r.id),
                label: r.name
            })),
            staleTime: 5 * 60 * 1000
        }
    )
}

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
            staleTime: 5 * 60 * 1000
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
            staleTime: 5 * 60 * 1000
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
            staleTime: 5 * 60 * 1000
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
            staleTime: 5 * 60 * 1000
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
                department_id: r.department_id
            })),
            staleTime: 5 * 60 * 1000
        }
    )
}

export function useEmployees(activeOnly: boolean = true) {
    return useApiQuery<SelectOption[]>(
        ['employees', activeOnly ? 'active' : 'all'],
        `${api.employees}${activeOnly ? '?active_only=true' : ''}`,
        {
            select: (data: any) => (Array.isArray(data) ? data : data?.results || [])
                .filter((e: any) => !activeOnly || (e.active === 1 && e.status !== 'resigned'))
                .map((e: any) => ({
                    value: String(e.id),
                    label: `${e.name} (${e.department_name || '-'})`,
                    user_id: e.user_id,
                    user_active: e.user_active,
                    email: e.email
                })),
            staleTime: 5 * 60 * 1000
        }
    )
}
