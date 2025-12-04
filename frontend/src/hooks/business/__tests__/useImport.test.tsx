import { renderHook, waitFor } from '@testing-library/react'
import { useImportData } from '../useImport'
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

describe('useImportData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should import data', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({})

        const { result } = renderHook(() => useImportData(), {
            wrapper: createWrapper(),
        })

        result.current.mutate({ kind: 'test', text: 'csv data' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(apiClient.post).toHaveBeenCalled()
    })
})
