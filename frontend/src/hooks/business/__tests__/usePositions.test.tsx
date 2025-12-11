import { renderHook, waitFor } from '@testing-library/react'
import {
    usePositions,
} from '../usePositions'
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

describe('usePositions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('usePositions', () => {
        it('should fetch positions', async () => {
            const mockData = [{ id: 1, name: 'Pos A', active: 1 }]
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => usePositions(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

})
