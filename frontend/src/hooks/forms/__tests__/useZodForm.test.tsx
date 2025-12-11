import { renderHook, act } from '@testing-library/react'
import { useZodForm } from '../useZodForm'
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

// Mock Antd Form
const mockValidateFields = vi.fn()
const mockSetFields = vi.fn()
const mockUseForm = vi.fn(() => [{
    validateFields: mockValidateFields,
    setFields: mockSetFields,
}])

vi.mock('antd', () => ({
    Form: {
        useForm: () => mockUseForm(),
    },
}))

describe('useZodForm', () => {
    const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().min(18, 'Must be at least 18'),
    })

    it('should initialize correctly', () => {
        const { result } = renderHook(() => useZodForm(schema))
        expect(result.current.form).toBeDefined()
        expect(result.current.validateWithZod).toBeDefined()
    })

    it('should validate successfully', async () => {
        const { result } = renderHook(() => useZodForm(schema))
        const validData = { name: 'John', age: 20 }

        mockValidateFields.mockResolvedValue(validData)

        const data = await result.current.validateWithZod()
        expect(data).toEqual(validData)
        expect(mockSetFields).not.toHaveBeenCalled()
    })

    it('should handle validation errors', async () => {
        const { result } = renderHook(() => useZodForm(schema))
        const invalidData = { name: '', age: 10 }

        mockValidateFields.mockResolvedValue(invalidData)

        await expect(result.current.validateWithZod()).rejects.toThrow('表单验证失败')

        expect(mockSetFields).toHaveBeenCalledWith([
            { name: ['name'], errors: ['Name is required'] },
            { name: ['age'], errors: ['Must be at least 18'] },
        ])
    })

    it('should propagate antd validation errors', async () => {
        const { result } = renderHook(() => useZodForm(schema))
        const error = new Error('Antd validation failed')

        mockValidateFields.mockRejectedValue(error)

        await expect(result.current.validateWithZod()).rejects.toThrow('Antd validation failed')
    })
})
