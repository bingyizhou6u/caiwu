import { renderHook, waitFor } from '@testing-library/react'
import { useApiQuery, useApiMutation, useReportQuery } from '../useApiQuery'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api as apiClient } from '../../api/http'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock api client
vi.mock('../../api/http', () => ({
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

describe('useApiQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useApiQuery', () => {
        it('should fetch data successfully', async () => {
            const mockData = { id: 1, name: 'Test' }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useApiQuery('test-key', '/api/test'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.get).toHaveBeenCalledWith('/api/test')
        })
    })

    describe('useApiMutation', () => {
        it('should perform POST mutation successfully', async () => {
            const mockData = { id: 1, status: 'created' }
            vi.mocked(apiClient.post).mockResolvedValue(mockData)
            const onSuccess = vi.fn()

            const { result } = renderHook(() => useApiMutation(onSuccess), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ url: '/api/create', method: 'POST', body: { name: 'New' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.post).toHaveBeenCalledWith('/api/create', { name: 'New' })
            expect(onSuccess).toHaveBeenCalledWith(mockData)
        })

        it('should perform PUT mutation successfully', async () => {
            const mockData = { id: 1, status: 'updated' }
            vi.mocked(apiClient.put).mockResolvedValue(mockData)

            const { result } = renderHook(() => useApiMutation(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ url: '/api/update', method: 'PUT', body: { name: 'Updated' } })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalledWith('/api/update', { name: 'Updated' })
        })

        it('should perform DELETE mutation successfully', async () => {
            const mockData = { success: true }
            vi.mocked(apiClient.delete).mockResolvedValue(mockData)

            const { result } = renderHook(() => useApiMutation(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ url: '/api/delete', method: 'DELETE' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.delete).toHaveBeenCalledWith('/api/delete')
        })
    })

    describe('useReportQuery', () => {
        it('should fetch report data with params', async () => {
            const mockData = [{ id: 1, value: 100 }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(
                () => useReportQuery('report', '/api/report', { startDate: '2023-01-01' }),
                { wrapper: createWrapper() }
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.get).toHaveBeenCalledWith('/api/report')
        })
    })
})
