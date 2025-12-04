import { useState, useCallback } from 'react'

/**
 * 表单模态框状态管理Hook
 * 统一管理create/edit/view等模态框状态，减少重复的useState
 * 
 * @template T - 编辑数据的类型
 * 
 * @example
 * ```tsx
 * const modal = useFormModal<Employee>()
 * 
 * // 打开创建模态框
 * <Button onClick={modal.openCreate}>新建</Button>
 * 
 * // 打开编辑模态框
 * <Button onClick={() => modal.openEdit(employee)}>编辑</Button>
 * 
 * // 模态框组件
 * <Modal
 *   open={modal.isOpen}
 *   onCancel={modal.close}
 *   title={modal.mode === 'create' ? '新建' : '编辑'}
 * >
 *   {modal.data && <div>{modal.data.name}</div>}
 * </Modal>
 * ```
 */
export function useFormModal<T = any>() {
    const [state, setState] = useState<{
        mode: 'create' | 'edit' | 'view' | null
        data: T | null
    }>({
        mode: null,
        data: null
    })

    const openCreate = useCallback(() => {
        setState({ mode: 'create', data: null })
    }, [])

    const openEdit = useCallback((data: T) => {
        setState({ mode: 'edit', data })
    }, [])

    const openView = useCallback((data: T) => {
        setState({ mode: 'view', data })
    }, [])

    const close = useCallback(() => {
        setState({ mode: null, data: null })
    }, [])

    return {
        // 状态
        isOpen: state.mode !== null,
        mode: state.mode,
        data: state.data,

        // 判断helpers
        isCreate: state.mode === 'create',
        isEdit: state.mode === 'edit',
        isView: state.mode === 'view',

        // 操作
        openCreate,
        openEdit,
        openView,
        close,
    }
}

/**
 * 多模态框管理Hook
 * 用于管理多个不同类型的模态框
 * 
 * @example
 * ```tsx
 * const modals = useMultipleModals(['transfer', 'depreciation', 'detail'])
 * 
 * <Button onClick={() => modals.open('transfer', asset)}>调拨</Button>
 * <Button onClick={() => modals.open('detail', asset)}>详情</Button>
 * 
 * <Modal open={modals.isOpen('transfer')} onCancel={() => modals.close('transfer')}>
 *   调拨表单
 * </Modal>
 * ```
 */
export function useMultipleModals<K extends string = string>(keys: K[]) {
    const [state, setState] = useState<Record<K, { open: boolean; data: any }>>(() => {
        return keys.reduce((acc, key) => {
            acc[key as K] = { open: false, data: null }
            return acc
        }, {} as Record<K, { open: boolean; data: any }>)
    })

    const open = useCallback((key: K, data?: any) => {
        setState(prev => ({
            ...prev,
            [key]: { open: true, data: data ?? null }
        }))
    }, [])

    const close = useCallback((key: K) => {
        setState(prev => ({
            ...prev,
            [key]: { open: false, data: null }
        }))
    }, [])

    const isOpen = useCallback((key: K) => {
        return state[key]?.open ?? false
    }, [state])

    const getData = useCallback((key: K) => {
        return state[key]?.data ?? null
    }, [state])

    return {
        open,
        close,
        isOpen,
        getData,
    }
}
