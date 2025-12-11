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
                regularDate: employee.regularDate ? dayjs(employee.regularDate) : dayjs(),
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
                    regularDate: values.regularDate.format('YYYY-MM-DD'),
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
                    <Input value={employee?.departmentName} disabled />
                </Form.Item>
                <Form.Item
                    name="regularDate"
                    label="转正日期"
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
            </Form>
        </Modal>
    )
}
