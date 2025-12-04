import { renderHook, waitFor } from '@testing-library/react'
import { useSystemConfig, useUpdateSystemConfig } from '../useSystemConfig'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api as apiClient } from '../../../api/http'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock api client
vi.mock('../../../api/http', () => ({
    api: {
        get: vi.fn(),
        put: vi.fn(),
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

describe('useSystemConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useSystemConfig', () => {
        it('should fetch system config', async () => {
            const mockData = { key: 'test_key', value: 'test_value' }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useSystemConfig('test_key'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/test_key'))
        })
    })

    describe('useUpdateSystemConfig', () => {
        it('should update system config', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({})

            const { result } = renderHook(() => useUpdateSystemConfig(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ key: 'test_key', value: 'new_value', description: 'desc' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.put).toHaveBeenCalledWith(expect.stringContaining('/test_key'), {
                value: 'new_value',
                description: 'desc'
            })
        })
    })
})
