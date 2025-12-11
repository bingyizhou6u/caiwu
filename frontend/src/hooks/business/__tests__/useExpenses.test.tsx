import { renderHook, waitFor } from '@testing-library/react'
import {
    useExpenses,
    useCreateExpense,
    useUpdateExpense,
    useDeleteExpense,
    useApproveExpense,
    usePayExpense
} from '../useExpenses'
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

describe('useExpenses', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useExpenses', () => {
        it('should fetch expenses', async () => {
            const mockData = [{ id: '1', description: 'Expense A' }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useExpenses(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

    describe('useCreateExpense', () => {
        it('should create expense', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateExpense(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                description: 'Expense B',
                employeeId: '1',
                expenseType: 'travel',
                amountCents: 100,
                expenseDate: '2023-01-01',
                currencyId: '1'
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateExpense', () => {
        it('should update expense', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateExpense(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { description: 'Expense A Updated' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteExpense', () => {
        it('should delete expense', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteExpense(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useApproveExpense', () => {
        it('should approve expense', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useApproveExpense(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', status: 'approved' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('usePayExpense', () => {
        it('should pay expense', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => usePayExpense(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
