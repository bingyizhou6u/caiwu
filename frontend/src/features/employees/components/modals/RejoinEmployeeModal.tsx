import { Modal, Form, Input, DatePicker, Switch, message } from 'antd'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { employeeRejoinSchema } from '../../../../validations/employee.schema'
import { useRejoinEmployee } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import dayjs from 'dayjs'
import { useEffect } from 'react'

interface RejoinEmployeeModalProps {
    open: boolean
    employee: Employee | null
    onCancel: () => void
    onSuccess: () => void
}

export function RejoinEmployeeModal({ open, employee, onCancel, onSuccess }: RejoinEmployeeModalProps) {
    const { form, validateWithZod } = useZodForm(employeeRejoinSchema)
    const { mutateAsync: rejoinEmployee, isPending } = useRejoinEmployee()

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                joinDate: employee.joinDate ? dayjs(employee.joinDate) : dayjs(),
                enableAccount: true,
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateWithZod()
            await rejoinEmployee({
                id: employee.id,
                data: {
                    joinDate: values.joinDate.format('YYYY-MM-DD'),
                    enableAccount: values.enableAccount ?? true,
                }
            })
            onSuccess()
        },
        { successMessage: '重新入职成功' }
    )

    return (
        <Modal
            title="员工重新入职"
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            okText="确认入职"
            cancelText="取消"
            confirmLoading={isPending}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="员工姓名">
                    <Input value={employee?.name} disabled />
                </Form.Item>
                <Form.Item label="项目">
                    <Input value={employee?.departmentName} disabled />
                </Form.Item>
                <Form.Item
                    name="joinDate"
                    label="入职日期"
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item
                    name="enableAccount"
                    label="账号处理"
                    valuePropName="checked"
                >
                    <Switch checkedChildren="启用账号" unCheckedChildren="保持禁用" />
                </Form.Item>
            </Form>
        </Modal>
    )
}
