import { renderHook, waitFor } from '@testing-library/react'
import {
    useCurrencies,
    useCurrencyOptions,
    useCreateCurrency,
    useUpdateCurrency,
    useDeleteCurrency,
    useToggleCurrencyActive
} from '../useCurrencies'
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

describe('useCurrencies', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useCurrencies', () => {
        it('should fetch currencies', async () => {
            const mockData = [{ code: 'USD', name: 'US Dollar', active: 1 }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCurrencies(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/currencies'))
        })

        it('should filter active currencies', async () => {
            const mockData = [
                { code: 'USD', name: 'US Dollar', active: 1 },
                { code: 'EUR', name: 'Euro', active: 0 }
            ]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCurrencies(true), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
            expect(result.current.data?.[0].code).toBe('USD')
        })
    })

    describe('useCurrencyOptions', () => {
        it('should fetch and format currency options', async () => {
            const mockData = [{ code: 'USD', name: 'US Dollar', active: 1 }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useCurrencyOptions(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { value: 'USD', label: 'USD - US Dollar' }
            ])
        })
    })

    describe('useCreateCurrency', () => {
        it('should create currency', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateCurrency(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ code: 'JPY', name: 'Japanese Yen' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })

    describe('useUpdateCurrency', () => {
        it('should update currency', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateCurrency(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ code: 'USD', data: { name: 'US Dollar Updated' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalled()
        })
    })

    describe('useDeleteCurrency', () => {
        it('should delete currency', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({})

            const { result } = renderHook(() => useDeleteCurrency(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('USD')

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalled()
        })
    })

    describe('useToggleCurrencyActive', () => {
        it('should toggle currency active status', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useToggleCurrencyActive(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ code: 'USD', active: false })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalledWith(expect.anything(), { active: 0 })
        })
    })
})
