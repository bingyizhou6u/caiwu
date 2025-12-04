import { Modal, Form, Input, message } from 'antd'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { resetUserSchema } from '../../../../validations/employee.schema'
import { useResetUserPassword } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import { useEffect } from 'react'

interface ResetUserPasswordModalProps {
    open: boolean
    employee: Employee | null
    onCancel: () => void
    onSuccess: () => void
}

export function ResetUserPasswordModal({ open, employee, onCancel, onSuccess }: ResetUserPasswordModalProps) {
    const { form, validateWithZod } = useZodForm(resetUserSchema)
    const { mutateAsync: resetPassword, isPending } = useResetUserPassword()

    useEffect(() => {
        if (!open) {
            form.resetFields()
        }
    }, [open, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee?.user_id) return
            const values = await validateWithZod()
            await resetPassword({
                userId: employee.user_id,
                data: {
                    password: values.password,
                }
            })
            onSuccess()
        },
        { successMessage: '密码重置成功' }
    )

    return (
        <Modal
            title={`重置密码 - ${employee?.name}`}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            width={400}
            confirmLoading={isPending}
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="password"
                    label="新密码"
                    rules={[{ required: true, message: '请输入新密码' }]}
                >
                    <Input.Password placeholder="请输入新密码" />
                </Form.Item>
                <Form.Item
                    name="confirm_password"
                    label="确认新密码"
                    dependencies={['password']}
                    rules={[{ required: true, message: '请再次输入新密码' }]}
                >
                    <Input.Password placeholder="请再次输入新密码" />
                </Form.Item>
            </Form>
        </Modal>
    )
}
