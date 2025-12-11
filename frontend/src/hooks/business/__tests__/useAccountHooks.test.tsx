import { renderHook, waitFor } from '@testing-library/react'
import {
    useAccounts,
    useAccountOptions
} from '../useAccounts'
import { useAccountTransactions } from '../useAccountTransactions'
import { useAccountTransfers, useCreateAccountTransfer } from '../useAccountTransfers'
import { useBorrowings, useCreateBorrowing } from '../useBorrowings'
import { useRepayments, useCreateRepayment } from '../useRepayments'
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

describe('useAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAccounts', () => {
        it('should fetch accounts', async () => {
            const mockData = { results: [{ id: '1', name: 'Account A' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAccounts(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useAccountOptions', () => {
        it('should fetch account options', async () => {
            const mockData = { results: [{ id: '1', name: 'Account A', currency: 'USD' }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAccountOptions(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
            expect(result.current.data?.[0].label).toContain('Account A')
        })
    })
})

describe('useAccountTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAccountTransactions', () => {
        it('should fetch account transactions', async () => {
            const mockData = [{ id: '1', amount: 100 }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAccountTransactions('1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })
})

describe('useAccountTransfers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAccountTransfers', () => {
        it('should fetch account transfers', async () => {
            const mockData = { results: [{ id: '1', amount: 100 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAccountTransfers(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateAccountTransfer', () => {
        it('should create account transfer', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateAccountTransfer(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ amount: 100 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})

describe('useBorrowings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useBorrowings', () => {
        it('should fetch borrowings', async () => {
            const mockData = { results: [{ id: '1', amount: 100 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useBorrowings(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateBorrowing', () => {
        it('should create borrowing', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateBorrowing(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ amount: 100 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})

describe('useRepayments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useRepayments', () => {
        it('should fetch repayments', async () => {
            const mockData = { results: [{ id: '1', amount: 100 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useRepayments(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateRepayment', () => {
        it('should create repayment', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateRepayment(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ amount: 100 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
