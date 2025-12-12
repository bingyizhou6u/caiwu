import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import type { AccountTransaction } from '../../types/business'

import { useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'

export function useAccountTransactions(accountId?: string, page: number = 1, pageSize: number = 20) {
    return useApiQuery<{ total: number, list: AccountTransaction[] }>(
        ['account-transactions', accountId || '', page, pageSize],
        `${api.accountsById(accountId || '')}/transactions?page=${page}&pageSize=${pageSize}`,
        {
            enabled: !!accountId,
            select: (data: any) => {
                return {
                    total: data.total ?? 0,
                    list: data.results ?? []
                }
            },
            staleTime: 5 * 60 * 1000,
            placeholderData: keepPreviousData
        }
    )
}
