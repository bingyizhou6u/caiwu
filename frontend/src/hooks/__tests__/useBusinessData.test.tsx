import { renderHook, waitFor } from '@testing-library/react'
import { useCurrencies, useDepartments, useAccounts, useExpenseCategories, useEmployees } from '../useBusinessData'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api as apiClient } from '../../api/http'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock api client
vi.mock('../../api/http', () => ({
    api: {
        get: vi.fn(),
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

describe('useBusinessData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useCurrencies', () => {
        it('should fetch and format currencies', async () => {
            const mockData = [
                { code: 'USD', name: 'US Dollar', active: 1 },
                { code: 'CNY', name: 'Chinese Yuan', active: 1 },
                { code: 'EUR', name: 'Euro', active: 0 },
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCurrencies(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: 'USD', label: 'USD - US Dollar' },
                { value: 'CNY', label: 'CNY - Chinese Yuan' },
            ])
        })
    })

    describe('useDepartments', () => {
        it('should fetch and format departments', async () => {
            const mockData = [
                { id: 1, name: 'Dept A', active: 1 },
                { id: 2, name: 'Dept B', active: 0 },
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useDepartments(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: '1', label: 'Dept A' },
            ])
        })
    })

    describe('useAccounts', () => {
        it('should fetch and format accounts', async () => {
            const mockData = [
                { id: 1, name: 'Bank A', currency: 'USD', active: 1 },
                { id: 2, name: 'Bank B', alias: 'Main', currency: 'CNY', active: 1 },
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAccounts(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: '1', label: 'Bank A [USD]', currency: 'USD', search: 'bank a [usd] usd' },
                { value: '2', label: 'Bank B (Main) [CNY]', currency: 'CNY', search: 'bank b (main) [cny] cny' },
            ])
        })
    })

    describe('useExpenseCategories', () => {
        it('should fetch and filter expense categories', async () => {
            const mockData = [
                { id: 1, name: 'Expense 1', kind: 'expense' },
                { id: 2, name: 'Income 1', kind: 'income' },
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useExpenseCategories(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: '1', label: 'Expense 1', kind: 'expense' },
            ])
        })
    })

    describe('useEmployees', () => {
        it('should fetch and filter active employees', async () => {
            const mockData = [
                { id: 1, name: 'Emp A', departmentName: 'Dept A', active: 1, status: 'active' },
                { id: 2, name: 'Emp B', active: 0, status: 'inactive' },
                { id: 3, name: 'Emp C', active: 1, status: 'resigned' },
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useEmployees(true), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: '1', label: 'Emp A (Dept A)', userId: undefined, userActive: undefined, email: undefined },
            ])
        })
    })
})
