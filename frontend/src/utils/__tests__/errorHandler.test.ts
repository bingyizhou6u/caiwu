import { handleApiError, withErrorHandler } from '../errorHandler'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { message } from 'antd'

// Mock antd message
vi.mock('antd', () => ({
    message: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('errorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handleApiError', () => {
        it('should handle error with response message', () => {
            const error = { response: { data: { message: 'API Error' } } }
            handleApiError(error)
            expect(message.error).toHaveBeenCalledWith('API Error')
        })

        it('should handle error with simple message', () => {
            const error = { message: 'Network Error' }
            handleApiError(error)
            expect(message.error).toHaveBeenCalledWith('Network Error')
        })

        it('should use default message if no error message found', () => {
            handleApiError({})
            expect(message.error).toHaveBeenCalledWith('操作失败，请稍后重试')
        })

        it('should use provided default message', () => {
            handleApiError({}, 'Custom Default')
            expect(message.error).toHaveBeenCalledWith('Custom Default')
        })
    })

    describe('withErrorHandler', () => {
        it('should execute operation successfully', async () => {
            const operation = vi.fn().mockResolvedValue('Success')
            const onSuccess = vi.fn()

            const wrapped = withErrorHandler(operation, {
                successMessage: 'Done',
                onSuccess,
            })

            const result = await wrapped()

            expect(result).toBe('Success')
            expect(message.success).toHaveBeenCalledWith('Done')
            expect(onSuccess).toHaveBeenCalledWith('Success')
        })

        it('should handle operation failure', async () => {
            const error = new Error('Fail')
            const operation = vi.fn().mockRejectedValue(error)
            const onError = vi.fn()

            const wrapped = withErrorHandler(operation, {
                errorMessage: 'Failed',
                onError,
            })

            const result = await wrapped()

            expect(result).toBeUndefined()
            expect(message.error).toHaveBeenCalledWith('Fail') // Error message from error object takes precedence if present
            expect(onError).toHaveBeenCalledWith(error)
        })
    })
})
