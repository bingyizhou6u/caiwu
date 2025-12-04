import { renderHook, act } from '@testing-library/react'
import { useTableActions } from '../useTableActions'
import { describe, it, expect } from 'vitest'

interface TestData {
    id: string
    name: string
}

describe('useTableActions', () => {
    const mockData: TestData[] = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
    ]

    it('should initialize with empty selection', () => {
        const { result } = renderHook(() => useTableActions<TestData>())

        expect(result.current.selectedRowKeys).toEqual([])
        expect(result.current.selectedRecords).toEqual([])
        expect(result.current.selectedCount).toBe(0)
        expect(result.current.hasSelection).toBe(false)
    })

    it('should update selection via rowSelection.onChange', () => {
        const { result } = renderHook(() => useTableActions<TestData>())

        act(() => {
            result.current.rowSelection.onChange?.(['1', '2'], [mockData[0], mockData[1]], { type: 'all' })
        })

        expect(result.current.selectedRowKeys).toEqual(['1', '2'])
        expect(result.current.selectedRecords).toEqual([mockData[0], mockData[1]])
        expect(result.current.selectedCount).toBe(2)
        expect(result.current.hasSelection).toBe(true)
    })

    it('should clear selection', () => {
        const { result } = renderHook(() => useTableActions<TestData>())

        // First select some items
        act(() => {
            result.current.selectAll([mockData[0]])
        })
        expect(result.current.hasSelection).toBe(true)

        // Then clear
        act(() => {
            result.current.clearSelection()
        })

        expect(result.current.selectedRowKeys).toEqual([])
        expect(result.current.selectedRecords).toEqual([])
        expect(result.current.hasSelection).toBe(false)
    })

    it('should select all provided records', () => {
        const { result } = renderHook(() => useTableActions<TestData>())

        act(() => {
            result.current.selectAll(mockData)
        })

        expect(result.current.selectedRowKeys).toEqual(['1', '2', '3'])
        expect(result.current.selectedRecords).toEqual(mockData)
        expect(result.current.selectedCount).toBe(3)
    })

    it('should toggle selection for a single record', () => {
        const { result } = renderHook(() => useTableActions<TestData>())
        const item = mockData[0]

        // Toggle on
        act(() => {
            result.current.toggleSelection(item)
        })
        expect(result.current.selectedRowKeys).toEqual(['1'])
        expect(result.current.selectedRecords).toEqual([item])

        // Toggle off
        act(() => {
            result.current.toggleSelection(item)
        })
        expect(result.current.selectedRowKeys).toEqual([])
        expect(result.current.selectedRecords).toEqual([])
    })
})
