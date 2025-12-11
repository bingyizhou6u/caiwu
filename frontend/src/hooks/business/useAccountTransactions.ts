import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import type { AccountTransaction } from '../../types/business'

export function useAccountTransactions(accountId?: string) {
    return useApiQuery<AccountTransaction[]>(
        ['account-transactions', accountId || ''],
        `${api.accountsById(accountId || '')}/transactions`,
        {
            enabled: !!accountId,
            select: (data: any) => data ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}
