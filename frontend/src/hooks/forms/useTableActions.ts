import { useState, useCallback } from 'react'
import type { TableRowSelection } from 'antd/es/table/interface'

export interface TableActions<T> {
    selectedRowKeys: string[]
    selectedRecords: T[]
    selectedCount: number
    hasSelection: boolean
    rowSelection: TableRowSelection<T>
    clearSelection: () => void
    selectAll: (records: T[]) => void
    toggleSelection: (record: T) => void
}

/**
 * 表格操作Hook
 * 统一管理表格的选中状态和批量操作
 * 
 * @template T - 表格数据项类型
 * 
 * @example
 * ```tsx
 * const tableActions = useTableActions<Employee>()
 * 
 * <Table
 *   rowSelection={tableActions.rowSelection}
 *   dataSource={employees}
 * />
 * 
 * <Button 
 *   disabled={!tableActions.hasSelection}
 *   onClick={tableActions.handleBatchDelete}
 * >
 *   批量删除 ({tableActions.selectedCount})
 * </Button>
 * ```
 */
export function useTableActions<T extends { id: string } = any>(): TableActions<T> {
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
    const [selectedRecords, setSelectedRecords] = useState<T[]>([])

    const rowSelection: TableRowSelection<T> = {
        selectedRowKeys,
        onChange: (keys: React.Key[], records: T[]) => {
            setSelectedRowKeys(keys as string[])
            setSelectedRecords(records)
        },
        // 可自定义其他配置
        getCheckboxProps: (record: T) => ({
            // 可根据需要禁用某些行
            // disabled: record.status === 'deleted',
        }),
    }

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([])
        setSelectedRecords([])
    }, [])

    const selectAll = useCallback((records: T[]) => {
        setSelectedRowKeys(records.map(r => r.id))
        setSelectedRecords(records)
    }, [])

    const toggleSelection = useCallback((record: T) => {
        setSelectedRowKeys(prev => {
            if (prev.includes(record.id)) {
                setSelectedRecords(prevRecords =>
                    prevRecords.filter(r => r.id !== record.id)
                )
                return prev.filter(key => key !== record.id)
            } else {
                setSelectedRecords(prevRecords => [...prevRecords, record])
                return [...prev, record.id]
            }
        })
    }, [])

    return {
        // 状态
        selectedRowKeys,
        selectedRecords,
        selectedCount: selectedRowKeys.length,
        hasSelection: selectedRowKeys.length > 0,

        // Ant Design Table配置
        rowSelection,

        // 操作方法
        clearSelection,
        selectAll,
        toggleSelection,
    }
}
