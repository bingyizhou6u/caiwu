import { renderHook, waitFor } from '@testing-library/react'
import {
    useAuditLogs,
    useAuditLogOptions,
    useExportAuditLogs,
    useCreateAuditLog
} from '../useAuditLogs'
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

describe('useAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useAuditLogs', () => {
        it('should fetch audit logs', async () => {
            const mockData = { results: [{ id: '1', action: 'login' }], total: 1 }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAuditLogs({ limit: 10, offset: 0 }), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

    describe('useAuditLogOptions', () => {
        it('should fetch audit log options', async () => {
            const mockData = { actions: ['login'] }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const { result } = renderHook(() => useAuditLogOptions(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })

    describe('useExportAuditLogs', () => {
        it('should export audit logs', async () => {
            vi.mocked(apiClient.get).mockResolvedValue(new Blob())

            const { result } = renderHook(() => useExportAuditLogs(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({})

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.get).toHaveBeenCalled()
        })
    })

    describe('useCreateAuditLog', () => {
        it('should create audit log', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({})

            const { result } = renderHook(() => useCreateAuditLog(), {
                wrapper: createWrapper(),
            })

            result.current.mutate({ action: 'login', entity: 'user' })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(apiClient.post).toHaveBeenCalled()
        })
    })
})
