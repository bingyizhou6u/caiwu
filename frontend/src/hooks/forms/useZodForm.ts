import { Form } from 'antd'
import { useCallback } from 'react'
import type { z } from 'zod'

/**
 * 结合Ant Design Form和Zod验证
 * 
 * @param schema - Zod schema
 * @returns form实例和验证函数
 * 
 * @example
 * ```tsx
 * const { form, validateWithZod } = useZodForm(employeeSchema)
 * 
 * const handleSubmit = async () => {
 *   try {
 *     const data = await validateWithZod()
 *     // 提交数据
 *   } catch (error) {
 *     // 验证失败，错误已显示在表单中
 *   }
 * }
 * ```
 */
export function useZodForm<T extends z.ZodType>(schema: T) {
    const [form] = Form.useForm()

    const validateWithZod = useCallback(async () => {
        try {
            // 先获取表单值
            const values = await form.validateFields()

            // 使用Zod验证
            const result = schema.safeParse(values)

            if (!result.success) {
                // 转换Zod错误为Antd Form错误
                const zodError = result.error as any
                // Zod v4 uses issues, v3 uses errors (or issues)
                const issues = zodError.issues || zodError.errors || []
                const errors = issues.map((err: any) => ({
                    name: err.path,
                    errors: [err.message]
                }))
                form.setFields(errors)
                throw new Error('表单验证失败')
            }

            return result.data as z.infer<T>
        } catch (error) {
            // 如果是Antd的验证错误，直接抛出
            throw error
        }
    }, [form, schema])

    return {
        form,
        validateWithZod
    }
}
