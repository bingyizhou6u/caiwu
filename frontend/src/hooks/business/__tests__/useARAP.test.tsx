import { renderHook, waitFor } from '@testing-library/react'
import {
    useAPDocs,
    useCreateAP,
    useConfirmAP
} from '../useAP'
import {
    useARDocs,
    useCreateAR,
    useConfirmAR,
    useSettleAR,
    useARStatement,
    useSettlementFlowOptions
} from '../useAR'
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

describe('useAP', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAPDocs', () => {
        it('should fetch AP docs', async () => {
            const mockData = { results: [{ id: '1', amountCents: 100 }], total: 1 }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAPDocs(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // Hook 返回 { total, list } 格式
            expect(result.current.data).toEqual({ total: 1, list: mockData.results })
        })
    })

    describe('useCreateAP', () => {
        it('should create AP doc', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateAP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                amountCents: 100,
                partyId: '1',
                issueDate: '2023-01-01'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useConfirmAP', () => {
        it('should confirm AP doc', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useConfirmAP(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                docId: '1',
                accountId: '1',
                categoryId: '1',
                bizDate: '2023-01-01',
                voucherUrl: 'http://example.com'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})

describe('useAR', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useARDocs', () => {
        it('should fetch AR docs', async () => {
            const mockData = { results: [{ id: '1', amountCents: 100 }], total: 1 }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useARDocs(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // Hook 返回 { total, list } 格式
            expect(result.current.data).toEqual({ total: 1, list: mockData.results })
        })
    })

    describe('useCreateAR', () => {
        it('should create AR doc', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateAR(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                amountCents: 100,
                siteId: '1',
                issueDate: '2023-01-01'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useConfirmAR', () => {
        it('should confirm AR doc', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useConfirmAR(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                docId: '1',
                accountId: '1',
                categoryId: '1',
                bizDate: '2023-01-01',
                voucherUrl: 'http://example.com'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useSettleAR', () => {
        it('should settle AR doc', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useSettleAR(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                docId: '1',
                settleAmountCents: 100,
                flowId: '1'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useARStatement', () => {
        it('should fetch AR statement', async () => {
            const mockData = { id: '1', items: [] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useARStatement('1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

    describe('useSettlementFlowOptions', () => {
        it('should fetch settlement flow options', async () => {
            const mockData = { results: [{ id: '1', amountCents: 100, type: 'income', bizDate: '2023-01-01' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useSettlementFlowOptions(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
        })
    })
})
