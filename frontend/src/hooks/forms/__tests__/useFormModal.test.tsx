import { renderHook, act } from '@testing-library/react'
import { useFormModal, useMultipleModals } from '../useFormModal'
import { describe, it, expect } from 'vitest'

interface TestData {
    id: string
    name: string
}

describe('useFormModal', () => {
    const mockData: TestData = { id: '1', name: 'Test' }

    it('should initialize with closed state', () => {
        const { result } = renderHook(() => useFormModal<TestData>())

        expect(result.current.isOpen).toBe(false)
        expect(result.current.mode).toBe(null)
        expect(result.current.data).toBe(null)
        expect(result.current.isCreate).toBe(false)
        expect(result.current.isEdit).toBe(false)
        expect(result.current.isView).toBe(false)
    })

    it('should open create mode', () => {
        const { result } = renderHook(() => useFormModal<TestData>())

        act(() => {
            result.current.openCreate()
        })

        expect(result.current.isOpen).toBe(true)
        expect(result.current.mode).toBe('create')
        expect(result.current.data).toBe(null)
        expect(result.current.isCreate).toBe(true)
    })

    it('should open edit mode with data', () => {
        const { result } = renderHook(() => useFormModal<TestData>())

        act(() => {
            result.current.openEdit(mockData)
        })

        expect(result.current.isOpen).toBe(true)
        expect(result.current.mode).toBe('edit')
        expect(result.current.data).toEqual(mockData)
        expect(result.current.isEdit).toBe(true)
    })

    it('should open view mode with data', () => {
        const { result } = renderHook(() => useFormModal<TestData>())

        act(() => {
            result.current.openView(mockData)
        })

        expect(result.current.isOpen).toBe(true)
        expect(result.current.mode).toBe('view')
        expect(result.current.data).toEqual(mockData)
        expect(result.current.isView).toBe(true)
    })

    it('should close modal', () => {
        const { result } = renderHook(() => useFormModal<TestData>())

        act(() => {
            result.current.openEdit(mockData)
        })
        expect(result.current.isOpen).toBe(true)

        act(() => {
            result.current.close()
        })

        expect(result.current.isOpen).toBe(false)
        expect(result.current.mode).toBe(null)
        expect(result.current.data).toBe(null)
    })
})

describe('useMultipleModals', () => {
    const keys = ['modal1', 'modal2'] as const
    const mockData = { id: 1 }

    it('should initialize with all modals closed', () => {
        const { result } = renderHook(() => useMultipleModals(['modal1', 'modal2']))

        expect(result.current.isOpen('modal1')).toBe(false)
        expect(result.current.isOpen('modal2')).toBe(false)
        expect(result.current.getData('modal1')).toBe(null)
    })

    it('should open specific modal with data', () => {
        const { result } = renderHook(() => useMultipleModals(['modal1', 'modal2']))

        act(() => {
            result.current.open('modal1', mockData)
        })

        expect(result.current.isOpen('modal1')).toBe(true)
        expect(result.current.getData('modal1')).toEqual(mockData)
        expect(result.current.isOpen('modal2')).toBe(false)
    })

    it('should close specific modal', () => {
        const { result } = renderHook(() => useMultipleModals(['modal1', 'modal2']))

        act(() => {
            result.current.open('modal1', mockData)
        })
        expect(result.current.isOpen('modal1')).toBe(true)

        act(() => {
            result.current.close('modal1')
        })

        expect(result.current.isOpen('modal1')).toBe(false)
        expect(result.current.getData('modal1')).toBe(null)
    })

    it('should handle independent modal states', () => {
        const { result } = renderHook(() => useMultipleModals(['modal1', 'modal2']))

        act(() => {
            result.current.open('modal1', { id: 1 })
            result.current.open('modal2', { id: 2 })
        })

        expect(result.current.isOpen('modal1')).toBe(true)
        expect(result.current.isOpen('modal2')).toBe(true)
        expect(result.current.getData('modal1')).toEqual({ id: 1 })
        expect(result.current.getData('modal2')).toEqual({ id: 2 })

        act(() => {
            result.current.close('modal1')
        })

        expect(result.current.isOpen('modal1')).toBe(false)
        expect(result.current.isOpen('modal2')).toBe(true)
    })
})
