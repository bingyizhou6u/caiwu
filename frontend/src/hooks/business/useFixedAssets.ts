import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'
import type {
    FixedAsset,
    CreateFixedAssetDTO,
    UpdateFixedAssetDTO,
    TransferFixedAssetDTO,
    DepreciateFixedAssetDTO,
    AllocateFixedAssetDTO,
    ReturnFixedAssetDTO
} from '../../types'

export interface FixedAssetQueryParams {
    search?: string
    status?: string
    departmentId?: string
    category?: string
}

export function useFixedAssets(params: FixedAssetQueryParams = {}) {
    const queryParams = new URLSearchParams()
    if (params.search) queryParams.append('search', params.search)
    if (params.status) queryParams.append('status', params.status)
    if (params.departmentId) queryParams.append('departmentId', params.departmentId)
    if (params.category) queryParams.append('category', params.category)

    const url = `${api.fixedAssets}?${queryParams.toString()}`

    return useApiQuery<FixedAsset[]>(
        ['fixedAssets', params],
        url,
        {
            select: (data: any) => data.results ?? [],
            staleTime: CACHE_TIME.BUSINESS_DATA,
        }
    )
}

export function useFixedAsset(id: string | null) {
    return useApiQuery<FixedAsset>(
        ['fixedAsset', id],
        api.fixedAssetsById(id || ''),
        {
            enabled: !!id,
            staleTime: CACHE_TIME.BUSINESS_DATA,
        }
    )
}

export function useCreateFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateFixedAssetDTO) => {
            await apiClient.post(api.fixedAssets, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
        }
    })
}

export function useUpdateFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: UpdateFixedAssetDTO }) => {
            await apiClient.put(api.fixedAssetsById(id), data)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
            queryClient.invalidateQueries({ queryKey: ['fixedAsset', variables.id] })
        }
    })
}

export function useDeleteFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.fixedAssetsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
        }
    })
}

export function useBatchDeleteFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await apiClient.post(api.fixedAssetsBatch, {
                action: 'delete',
                ids
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
        }
    })
}

export function useTransferFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: TransferFixedAssetDTO }) => {
            await apiClient.post(api.fixedAssetsTransfer(id), data)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
            queryClient.invalidateQueries({ queryKey: ['fixedAsset', variables.id] })
        }
    })
}

export function useDepreciateFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: DepreciateFixedAssetDTO }) => {
            await apiClient.post(api.fixedAssetsDepreciations(id), data)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
            queryClient.invalidateQueries({ queryKey: ['fixedAsset', variables.id] })
        }
    })
}

export function useAllocateFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: AllocateFixedAssetDTO }) => {
            await apiClient.post(api.fixedAssetsAllocate(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
            queryClient.invalidateQueries({ queryKey: ['fixedAssetsAllocations'] })
        }
    })
}

export function useReturnFixedAsset() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: ReturnFixedAssetDTO }) => {
            await apiClient.post(api.fixedAssetsAllocationReturn(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedAssets'] })
            queryClient.invalidateQueries({ queryKey: ['fixedAssetsAllocations'] })
        }
    })
}
