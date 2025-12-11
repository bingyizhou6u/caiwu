import { renderHook, waitFor } from '@testing-library/react'
import {
    useFlows,
    useCreateFlow,
    useUpdateFlowVoucher,
    fetchNextVoucherNo
} from '../useFlows'
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

describe('useFlows', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useFlows', () => {
        it('should fetch flows', async () => {
            const mockData = { results: [{ id: '1', amount_cents: 100 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useFlows(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateFlow', () => {
        it('should create flow', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateFlow(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ amount_cents: 100 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateFlowVoucher', () => {
        it('should update flow voucher', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateFlowVoucher(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', voucherUrls: ['url'] })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('fetchNextVoucherNo', () => {
        it('should fetch next voucher no', async () => {
            const mockData = { voucherNo: 'V123' }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await fetchNextVoucherNo('2023-01-01')

            expect(result).toBe('V123')
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('date=2023-01-01'))
        })
    })
})
