import { renderHook, act } from '@testing-library/react'
import { useBatchOperation } from '../useBatchOperation'
import { describe, it, expect, vi } from 'vitest'

// Mock message from antd
vi.mock('antd', () => ({
    message: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('useBatchOperation', () => {
    it('should handle batch operation successfully', async () => {
        const mockMutation = vi.fn().mockResolvedValue(undefined)
        const mockTableActions = {
            selectedRowKeys: ['1', '2'],
            setSelectedRowKeys: vi.fn(),
            rowSelection: {},
            hasSelection: true,
            clearSelection: vi.fn(),
        }
        const mockOnSuccess = vi.fn()

        const { result } = renderHook(() =>
            useBatchOperation(mockMutation, mockTableActions as any, {
                onSuccess: mockOnSuccess,
                errorMessage: 'Error',
            })
        )

        await act(async () => {
            await result.current.handleBatch()
        })

        expect(mockMutation).toHaveBeenCalledWith(['1', '2'])
        expect(mockTableActions.clearSelection).toHaveBeenCalled()
        expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('should handle batch operation failure', async () => {
        const mockMutation = vi.fn().mockRejectedValue(new Error('Failed'))
        const mockTableActions = {
            selectedRowKeys: ['1', '2'],
            setSelectedRowKeys: vi.fn(),
            rowSelection: {},
            hasSelection: true,
            clearSelection: vi.fn(),
        }
        const mockOnSuccess = vi.fn()

        const { result } = renderHook(() =>
            useBatchOperation(mockMutation, mockTableActions as any, {
                onSuccess: mockOnSuccess,
                errorMessage: 'Error',
            })
        )

        await act(async () => {
            await result.current.handleBatch()
        })

        expect(mockMutation).toHaveBeenCalledWith(['1', '2'])
        expect(mockTableActions.clearSelection).not.toHaveBeenCalled()
        expect(mockOnSuccess).not.toHaveBeenCalled()
    })
})
