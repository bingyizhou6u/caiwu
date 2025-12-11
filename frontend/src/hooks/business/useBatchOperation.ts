import { useState } from 'react'
import { withErrorHandler } from '../../utils/errorHandler'
import { TableActions } from '../forms/useTableActions'

interface BatchOperationOptions {
    successMessage?: string
    errorMessage?: string
    onSuccess?: (data: any) => void
}

/**
 * 批量操作Hook
 * 简化批量操作的逻辑，自动处理loading、错误处理和清除选中状态
 * 
 * @param mutationFn - 执行批量操作的函数，接收选中的ID列表
 * @param tableActions - useTableActions的返回值
 * @param options - 配置选项
 */
export function useBatchOperation<T>(
    mutationFn: (ids: string[]) => Promise<any>,
    tableActions: TableActions<T>,
    options: BatchOperationOptions = {}
) {
    const [loading, setLoading] = useState(false)

    const handleBatch = withErrorHandler(
        async () => {
            if (!tableActions.hasSelection) return

            setLoading(true)
            try {
                const result = await mutationFn(tableActions.selectedRowKeys)
                tableActions.clearSelection()
                if (options.onSuccess) {
                    options.onSuccess(result)
                }
                return result
            } finally {
                setLoading(false)
            }
        },
        {
            successMessage: options.successMessage,
            errorMessage: options.errorMessage || '批量操作失败',
        }
    )

    return {
        handleBatch,
        loading,
    }
}
