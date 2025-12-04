import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ARAP } from '../../types/business'
import type { CreateAPDocDTO, ConfirmARDocDTO } from '../../types'

export function useAPDocs() {
    return useApiQuery<ARAP[]>(
        ['ap-docs'],
        `${api.ar.docs}?kind=AP`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
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
