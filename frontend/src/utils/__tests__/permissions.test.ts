import { hasPermission, usePermissions } from '../permissions'
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock useAppStore
const mockUserInfo = {
    id: '1',
    name: 'Test User',
    position: {
        code: 'manager',
        level: 2,
        functionRole: 'finance',
        canManageSubordinates: 1,
        permissions: {
            finance: {
                flow: ['view', 'create'],
            },
            hr: {
                employee: ['view'],
            },
        },
    },
}

vi.mock('../../store/useAppStore', () => ({
    useAppStore: () => ({
        userInfo: mockUserInfo,
    }),
}))

describe('permissions', () => {
    describe('hasPermission', () => {
        it('should return true if user has permission', () => {
            expect(hasPermission(mockUserInfo, 'finance', 'flow', 'create')).toBe(true)
        })

        it('should return false if user does not have permission', () => {
            expect(hasPermission(mockUserInfo, 'finance', 'flow', 'delete')).toBe(false)
        })

        it('should return false if module does not exist', () => {
            expect(hasPermission(mockUserInfo, 'system', 'config', 'view')).toBe(false)
        })

        it('should return false if subModule does not exist', () => {
            expect(hasPermission(mockUserInfo, 'finance', 'report', 'view')).toBe(false)
        })

        it('should return true if only checking module existence', () => {
            expect(hasPermission(mockUserInfo, 'finance')).toBe(true)
        })

        it('should return true if only checking subModule existence', () => {
            expect(hasPermission(mockUserInfo, 'finance', 'flow')).toBe(true)
        })

        it('should handle missing user info', () => {
            expect(hasPermission(null, 'finance')).toBe(false)
            expect(hasPermission({}, 'finance')).toBe(false)
        })
    })

    describe('usePermissions', () => {
        it('should return user info and helpers', () => {
            const { result } = renderHook(() => usePermissions())

            expect(result.current.user).toEqual(mockUserInfo)
            expect(result.current.canManageSubordinates).toBe(true)
            expect(result.current.positionCode).toBe('manager')
            expect(result.current.positionLevel).toBe(2)
        })

        it('should check permission correctly', () => {
            const { result } = renderHook(() => usePermissions())

            expect(result.current.hasPermission('finance', 'flow', 'create')).toBe(true)
            expect(result.current.hasPermission('finance', 'flow', 'delete')).toBe(false)
        })

        it('should check roles correctly via values', () => {
            const { result } = renderHook(() => usePermissions())

            // 值判断方式
            expect(result.current.canManageSubordinates).toBe(true)
            expect(result.current.dataScope).toBe('self') // 默认值
        })
    })
})
