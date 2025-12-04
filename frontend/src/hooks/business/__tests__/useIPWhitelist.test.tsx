import { renderHook, waitFor } from '@testing-library/react'
import {
    useIPWhitelist,
    useIPRuleStatus,
    useCreateIPRule,
    useToggleIPRule,
    useAddIP,
    useDeleteIP,
    useBatchAddIP,
    useBatchDeleteIP,
    useSyncIPWhitelist
} from '../useIPWhitelist'
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

describe('useIPWhitelist', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useIPWhitelist', () => {
        it('should fetch IP whitelist', async () => {
            const mockData = { results: [{ id: '1', ip_address: '1.2.3.4' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useIPWhitelist(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useIPRuleStatus', () => {
        it('should fetch IP rule status', async () => {
            const mockData = { data: { enabled: true } }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useIPRuleStatus(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.data)
        })
    })

    describe('useCreateIPRule', () => {
        it('should create IP rule', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateIPRule(), {
                wrapper: createWrapper(),
            })

            result.current.mutate()

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useToggleIPRule', () => {
        it('should toggle IP rule', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useToggleIPRule(), {
                wrapper: createWrapper(),
            })

            result.current.mutate(true)

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useAddIP', () => {
        it('should add IP', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useAddIP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ ip_address: '1.2.3.4' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useDeleteIP', () => {
        it('should delete IP', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteIP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useBatchAddIP', () => {
        it('should batch add IP', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useBatchAddIP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate([{ ip_address: '1.2.3.4' }])

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useBatchDeleteIP', () => {
        it('should batch delete IP', async () => {
            vi.mocked(apiClient.get).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useBatchDeleteIP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate(['1'])

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.get).toHaveBeenCalled()
        })
    })

    describe('useSyncIPWhitelist', () => {
        it('should sync IP whitelist', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useSyncIPWhitelist(), {
                wrapper: createWrapper(),
            })

            result.current.mutate()

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
