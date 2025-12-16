import { renderHook, waitFor } from '@testing-library/react'
import {
    useEmployees,
    useRegularizeEmployee,
    useLeaveEmployee,
    useRejoinEmployee,
    useDeleteEmployee,
    useBatchDeleteEmployee
} from '../useEmployees'
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

describe('useEmployees', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useEmployees', () => {
        it('should fetch employees with filters', async () => {
            const mockData = [{ id: 1, name: 'Test' }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useEmployees({ status: 'active', activeOnly: true }), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('status=active'))
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('activeOnly=true'))
        })
    })

    describe('useRegularizeEmployee', () => {
        it('should call regularize api', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useRegularizeEmployee(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { regularDate: '2023-01-01' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // Note: We need to know the exact URL structure from api config to be precise, 
            // but here we just check if post was called. 
            // Ideally we should mock api config too or check arguments loosely.
            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useLeaveEmployee', () => {
        it('should call leave api', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useLeaveEmployee(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                id: '1',
                data: {
                    leaveDate: '2023-01-01',
                    leaveType: 'resigned',
                    disableAccount: true
                }
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useDeleteEmployee', () => {
        it('should call delete api', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteEmployee(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useBatchDeleteEmployee', () => {
        it('should call batch delete api', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useBatchDeleteEmployee(), {
                wrapper: createWrapper(),
            })

            result.current.mutate(['1', '2'])

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // 实际只发送 ids，不需要 action 字段
            expect(apiClient.post).toHaveBeenCalledWith(expect.anything(), {
                ids: ['1', '2']
            })
        })
    })
})
