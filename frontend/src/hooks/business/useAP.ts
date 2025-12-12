import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ARAP } from '../../types/business'
import type { CreateAPDocDTO, ConfirmARDocDTO } from '../../types'

import { keepPreviousData } from '@tanstack/react-query'

export function useAPDocs(page: number = 1, pageSize: number = 20) {
    return useApiQuery<{ total: number, list: ARAP[] }>(
        ['ap-docs', page, pageSize],
        `${api.ar.docs}?kind=AP&page=${page}&pageSize=${pageSize}`,
        {
            select: (data: any) => ({
                total: data.total ?? 0,
                list: data.results ?? []
            }),
            staleTime: 5 * 60 * 1000,
            placeholderData: keepPreviousData
        }
    )
}

export function useCreateAP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateAPDocDTO) => {
            await apiClient.post(api.ar.docs, { ...data, kind: 'AP' })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ap-docs'] })
        }
    })
}

export function useConfirmAP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: ConfirmARDocDTO) => {
            await apiClient.post(api.ar.confirm, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ap-docs'] })
        }
    })
}
