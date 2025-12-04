import { renderHook, waitFor } from '@testing-library/react'
import {
    useCategories,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory
} from '../useCategories'
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

describe('useCategories', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useCategories', () => {
        it('should fetch categories', async () => {
            const mockData = [{ id: 1, name: 'Cat A', kind: 'income' }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCategories(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })

        it('should filter categories by kind', async () => {
            const mockData = [
                { id: 1, name: 'Cat A', kind: 'income' },
                { id: 2, name: 'Cat B', kind: 'expense' }
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCategories('income'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
            expect(result.current.data?.[0].kind).toBe('income')
        })
    })

    describe('useCreateCategory', () => {
        it('should create category', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateCategory(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ name: 'Cat C', kind: 'income' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateCategory', () => {
        it('should update category', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateCategory(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { name: 'Cat A Updated' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteCategory', () => {
        it('should delete category', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteCategory(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })
})
