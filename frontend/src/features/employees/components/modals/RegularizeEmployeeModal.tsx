import { Modal, Form, Input, DatePicker, message } from 'antd'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { employeeRegularizeSchema } from '../../../../validations/employee.schema'
import { useRegularizeEmployee } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import dayjs from 'dayjs'
import { useEffect } from 'react'

interface RegularizeEmployeeModalProps {
    open: boolean
    employee: Employee | null
    onCancel: () => void
    onSuccess: () => void
}

export function RegularizeEmployeeModal({ open, employee, onCancel, onSuccess }: RegularizeEmployeeModalProps) {
    const { form, validateWithZod } = useZodForm(employeeRegularizeSchema)
    const { mutateAsync: regularizeEmployee, isPending } = useRegularizeEmployee()

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                regular_date: employee.regular_date ? dayjs(employee.regular_date) : dayjs(),
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateWithZod()
            await regularizeEmployee({
                id: employee.id,
                data: {
                    regular_date: values.regular_date.format('YYYY-MM-DD'),
                }
            })
            onSuccess()
        },
        { successMessage: '转正成功' }
    )

    return (
        <Modal
            title="员工转正"
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            okText="确认转正"
            cancelText="取消"
            confirmLoading={isPending}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="员工姓名">
                    <Input value={employee?.name} disabled />
                </Form.Item>
                <Form.Item label="项目">
                    <Input value={employee?.department_name} disabled />
                </Form.Item>
                <Form.Item
                    name="regular_date"
                    label="转正日期"
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
            </Form>
        </Modal>
    )
}
