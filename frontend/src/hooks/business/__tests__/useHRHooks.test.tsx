import { renderHook, waitFor } from '@testing-library/react'
import {
    useAllowances,
    useCreateAllowance,
    useUpdateAllowance,
    useDeleteAllowance,
    useGenerateAllowances
} from '../useAllowances'
import {
    useLeaves,
    useCreateLeave,
    useUpdateLeave,
    useDeleteLeave,
    useApproveLeave
} from '../useLeaves'
import {
    useSalaryPayments,
    useGenerateSalaryPayments,
    useEmployeeConfirmSalary,
    useFinanceApproveSalary,
    usePaymentTransferSalary,
    useRequestAllocationSalary,
    useApproveAllocationSalary,
    useConfirmPaymentSalary
} from '../useSalaryPayments'
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

describe('useAllowances', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAllowances', () => {
        it('should fetch allowances', async () => {
            const mockData = { results: [{ id: '1', amount_cents: 100 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAllowances({ year: 2023 }), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateAllowance', () => {
        it('should create allowance', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateAllowance(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ amount_cents: 100 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateAllowance', () => {
        it('should update allowance', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateAllowance(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { amount_cents: 200 } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteAllowance', () => {
        it('should delete allowance', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteAllowance(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useGenerateAllowances', () => {
        it('should generate allowances', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useGenerateAllowances(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ year: 2023, month: 1 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})

describe('useLeaves', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useLeaves', () => {
        it('should fetch leaves', async () => {
            const mockData = { results: [{ id: '1', days: 1 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useLeaves(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useCreateLeave', () => {
        it('should create leave', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateLeave(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ days: 1 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateLeave', () => {
        it('should update leave', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateLeave(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', data: { days: 2 } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteLeave', () => {
        it('should delete leave', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteLeave(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useApproveLeave', () => {
        it('should approve leave', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useApproveLeave(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', status: 'approved' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})

describe('useSalaryPayments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useSalaryPayments', () => {
        it('should fetch salary payments', async () => {
            const mockData = { results: [{ id: '1', salary_cents: 10000 }] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useSalaryPayments({ year: 2023, month: 1 }), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData.results)
        })
    })

    describe('useGenerateSalaryPayments', () => {
        it('should generate salary payments', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useGenerateSalaryPayments(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ year: 2023, month: 1 })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useEmployeeConfirmSalary', () => {
        it('should confirm salary by employee', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useEmployeeConfirmSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useFinanceApproveSalary', () => {
        it('should approve salary by finance', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useFinanceApproveSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('1')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('usePaymentTransferSalary', () => {
        it('should transfer salary payment', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => usePaymentTransferSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', accountId: 'acc1' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useRequestAllocationSalary', () => {
        it('should request salary allocation', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useRequestAllocationSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', allocations: [] })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useApproveAllocationSalary', () => {
        it('should approve salary allocation', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useApproveAllocationSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', approve_all: true })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useConfirmPaymentSalary', () => {
        it('should confirm salary payment', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useConfirmPaymentSalary(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ id: '1', payment_voucher_path: 'path' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
