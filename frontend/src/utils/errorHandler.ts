import { message } from 'antd'
import { useCallback } from 'react'
import { Logger } from './logger'

/**
 * 处理API错误
 * 统一的错误处理逻辑，提取错误信息并显示
 * 
 * @param error - 错误对象
 * @param defaultMessage - 默认错误消息
 * @returns 错误消息字符串
 */
export function handleApiError(error: any, defaultMessage?: string): string {
    Logger.error('[API Error]', { error })

    // 提取错误消息
    const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        defaultMessage ||
        '操作失败，请稍后重试'

    message.error(errorMessage)

    // 生产环境可以发送到错误监控服务
    if (process.env.NODE_ENV === 'production') {
        // 例如: Sentry.captureException(error)
        Logger.info('[Error Monitoring] Error logged', { error })
    }

    return errorMessage
}

/**
 * 操作包装器选项
 */
export interface ErrorHandlerOptions<T> {
    /** 成功提示消息 */
    successMessage?: string
    /** 错误提示消息 */
    errorMessage?: string
    /** 成功回调 */
    onSuccess?: (data: T) => void
    /** 错误回调 */
    onError?: (error: Error) => void
    /** 完成回调（无论成功或失败都会执行） */
    onFinally?: () => void
    /** 是否显示成功提示，默认true */
    showSuccess?: boolean
    /** 是否显示错误提示，默认true */
    showError?: boolean
}

/**
 * 操作包装器
 * 自动处理异步操作的成功和错误消息
 * 
 * @param operation - 要执行的异步操作
 * @param options - 配置选项
 * @returns 包装后的函数
 * 
 * @example
 * ```tsx
 * const handleCreate = withErrorHandler(
 *   async () => {
 *     const values = await form.validateFields()
 *     return await apiClient.post(api.employees, values)
 *   },
 *   {
 *     successMessage: '创建成功',
 *     errorMessage: '创建失败',
 *     onSuccess: () => {
 *       modal.close()
 *       refetch()
 *     }
 *   }
 * )
 * ```
 */
export function withErrorHandler<T = any, A extends any[] = any[]>(
    operation: (...args: A) => Promise<T>,
    options: ErrorHandlerOptions<T> = {}
): (...args: A) => Promise<T | undefined> {
    return async (...args: A) => {
        try {
            const result = await operation(...args)

            // 显示成功消息
            if (options.showSuccess !== false && options.successMessage) {
                message.success(options.successMessage)
            }

            // 执行成功回调
            options.onSuccess?.(result)

            return result
        } catch (error: any) {
            // 显示错误消息
            if (options.showError !== false) {
                handleApiError(error, options.errorMessage)
            }

            // 执行错误回调
            options.onError?.(error)

            // 不重新抛出错误，让调用者决定是否需要
            return undefined
        } finally {
            // 执行完成回调
            options.onFinally?.()
        }
    }
}

/**
 * React Hook形式的错误处理
 * 
 * @example
 * ```tsx
 * const { handleError, withHandler } = useErrorHandler()
 * 
 * const handleSubmit = withHandler(
 *   async () => {
 *     await apiClient.post(api.employees, data)
 *   },
 *   { successMessage: '提交成功' }
 * )
 * ```
 */
export function useErrorHandler() {
    const handleError = useCallback((error: any, context?: string) => {
        handleApiError(error, context)
    }, [])

    const withHandler = useCallback(<T, A extends any[] = any[]>(
        operation: (...args: A) => Promise<T>,
        options: ErrorHandlerOptions<T> = {}
    ) => {
        return withErrorHandler(operation, options)
    }, [])

    return {
        handleError,
        withHandler
    }
}

/**
 * 重试包装器
 * 为操作添加自动重试功能
 * 
 * @param operation - 要执行的操作
 * @param maxRetries - 最大重试次数
 * @param delay - 重试延迟（毫秒）
 * @returns 包装后的函数
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> {
    let lastError: any

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
            }
        }
    }

    throw lastError
}
