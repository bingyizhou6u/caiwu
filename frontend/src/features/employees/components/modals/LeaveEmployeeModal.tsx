import { Modal, Form, Input, DatePicker, Select, Switch, message } from 'antd'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { employeeLeaveSchema } from '../../../../validations/employee.schema'
import { useLeaveEmployee } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import dayjs from 'dayjs'
import { useEffect } from 'react'

const { Option } = Select
const { TextArea } = Input

interface LeaveEmployeeModalProps {
    open: boolean
    employee: Employee | null
    onCancel: () => void
    onSuccess: () => void
}

export function LeaveEmployeeModal({ open, employee, onCancel, onSuccess }: LeaveEmployeeModalProps) {
    const { form, validateWithZod } = useZodForm(employeeLeaveSchema)
    const { mutateAsync: leaveEmployee, isPending } = useLeaveEmployee()

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                leave_date: dayjs(),
                leave_type: 'resigned',
                disable_account: true,
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateWithZod()
            await leaveEmployee({
                id: employee.id,
                data: {
                    leave_date: values.leave_date.format('YYYY-MM-DD'),
                    leave_type: values.leave_type,
                    leave_reason: values.leave_reason,
                    leave_memo: values.leave_memo,
                    disable_account: values.disable_account ?? true,
                }
            })
            onSuccess()
        },
        { successMessage: '离职办理成功' }
    )

    return (
        <Modal
            title="员工离职"
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            okText="确认离职"
            cancelText="取消"
            width={600}
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
                    name="leave_date"
                    label="离职日期"
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item
                    name="leave_type"
                    label="离职类型"
                >
                    <Select>
                        <Option value="resigned">主动离职</Option>
                        <Option value="terminated">被动离职</Option>
                        <Option value="expired">合同到期</Option>
                        <Option value="retired">退休</Option>
                        <Option value="other">其他</Option>
                    </Select>
                </Form.Item>
                <Form.Item
                    name="leave_reason"
                    label="离职原因"
                >
                    <TextArea rows={3} placeholder="请输入离职原因" />
                </Form.Item>
                <Form.Item
                    name="leave_memo"
                    label="离职备注"
                >
                    <TextArea rows={3} placeholder="请输入备注信息" />
                </Form.Item>
                <Form.Item
                    name="disable_account"
                    label="账号处理"
                    valuePropName="checked"
                >
                    <Switch checkedChildren="禁用账号" unCheckedChildren="保持启用" />
                </Form.Item>
            </Form>
        </Modal>
    )
}
