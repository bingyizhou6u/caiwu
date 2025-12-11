import { renderHook, waitFor } from '@testing-library/react'
import {
    useFixedAssets,
    useFixedAsset,
    useCreateFixedAsset,
    useUpdateFixedAsset,
    useDeleteFixedAsset,
    useBatchDeleteFixedAsset,
    useTransferFixedAsset,
    useDepreciateFixedAsset
} from '../useFixedAssets'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api as apiClient } from '../../../api/http'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock api client
vi.mock('../../../api/http', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}))

// Setup QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('useFixedAssets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useFixedAssets', () => {
        it('should fetch fixed assets', async () => {
            const mockData = { results: [{ id: '1', name: 'Asset A' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useFixedAssets(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })

        it('should fetch fixed assets with params', async () => {
            const mockData = { results: [{ id: '1', name: 'Asset A' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useFixedAssets({ search: 'test' }), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('search=test'))
        })
    })

    describe('useFixedAsset', () => {
        it('should fetch single fixed asset', async () => {
            const mockData = { id: '1', name: 'Asset A' }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useFixedAsset('1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

    describe('useCreateFixedAsset', () => {
        it('should create fixed asset', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                assetCode: 'FA001',
                name: 'Asset B',
                purchaseDate: '2023-01-01',
                purchasePriceCents: 10000,
                currency: 'CNY',
                accountId: 'acc1',
                categoryId: 'cat1'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateFixedAsset', () => {
        it('should update fixed asset', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { name: 'Asset A Updated' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteFixedAsset', () => {
        it('should delete fixed asset', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useBatchDeleteFixedAsset', () => {
        it('should batch delete fixed assets', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useBatchDeleteFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate(['1', '2'])

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalledWith(expect.anything(), {
                action: 'delete',
                ids: ['1', '2']
            })
        })
    })

    describe('useTransferFixedAsset', () => {
        it('should transfer fixed asset', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useTransferFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { toDepartmentId: '2', transferDate: '2023-01-01' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useDepreciateFixedAsset', () => {
        it('should depreciate fixed asset', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useDepreciateFixedAsset(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { depreciationDate: '2023-01-01', depreciationAmountCents: 100 } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
