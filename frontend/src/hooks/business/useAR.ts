import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ARAP } from '../../types/business'
import type { CreateARDocDTO, ConfirmARDocDTO, SettleARDocDTO } from '../../types'

export function useARDocs() {
    return useApiQuery<ARAP[]>(
        ['ar-docs'],
        `${api.ar.docs}?kind=AR`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useSettlementFlowOptions() {
    return useApiQuery<{ value: string, label: string }[]>(
        ['flows-options'],
        api.flows,
        {
            select: (data: any) => (data.results ?? []).map((r: any) => ({
                value: r.id,
                label: `${r.bizDate} ${r.voucherNo ?? ''} ${(r.amountCents / 100).toFixed(2)} ${r.type}`
            })),
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useARStatement(docId?: string) {
    return useApiQuery<any>(
        ['ar-statement', docId],
        `${api.ar.statement}?docId=${docId}`,
        {
            enabled: !!docId,
        }
    )
}

export function useCreateAR() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateARDocDTO) => {
            await apiClient.post(api.ar.docs, { ...data, kind: 'AR' })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ar-docs'] })
        }
    })
}

export function useConfirmAR() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: ConfirmARDocDTO) => {
            await apiClient.post(api.ar.confirm, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ar-docs'] })
        }
    })
}

export function useSettleAR() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: SettleARDocDTO) => {
            await apiClient.post(api.ar.settlements, data)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['ar-docs'] })
            queryClient.invalidateQueries({ queryKey: ['ar-statement', variables.docId] })
        }
    })
}
