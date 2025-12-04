import { useEffect } from 'react'
import { Modal, Form, InputNumber, Tabs, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../../config/api'
import { handleConflictError } from '../../../../utils/api'
import { useApiMutation } from '../../../../utils/useApiQuery'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { updateEmployeeSchema } from '../../../../validations/employee.schema'
import { EmployeeForm } from '../forms/EmployeeForm'

const { TabPane } = Tabs

interface EditEmployeeModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
    employee: any
}

export function EditEmployeeModal({ open, onCancel, onSuccess, employee }: EditEmployeeModalProps) {
    const { form, validateWithZod } = useZodForm(updateEmployeeSchema)
    const { mutateAsync: updateEmployee, isPending: isUpdating } = useApiMutation()

    useEffect(() => {
        if (open && employee) {
            // Determine Project ID
            const projectId = employee.department_name === '总部' ? 'hq' : employee.department_id

            // Parse phone numbers
            let phoneCountryCode = '+971'
            let phoneNumber = ''
            if (employee.phone) {
                if (employee.phone.includes(' ')) {
                    const parts = employee.phone.split(' ')
                    phoneCountryCode = parts[0]
                    phoneNumber = parts[1]
                } else if (employee.phone.startsWith('+')) {
                    const match = employee.phone.match(/^(\+\d+)\s+(\d+)$/)
                    if (match) {
                        phoneCountryCode = match[1]
                        phoneNumber = match[2]
                    } else {
                        phoneNumber = employee.phone
                    }
                } else {
                    phoneNumber = employee.phone
                }
            }

            let emergencyPhoneCountryCode = '+971'
            let emergencyPhoneNumber = ''
            if (employee.emergency_phone) {
                const match = employee.emergency_phone.match(/^(\+\d+)\s+(\d+)$/)
                if (match) {
                    emergencyPhoneCountryCode = match[1]
                    emergencyPhoneNumber = match[2]
                } else {
                    emergencyPhoneNumber = employee.emergency_phone
                }
            }

            form.setFieldsValue({
                name: employee.name,
                project_id: projectId,
                department_id: projectId === 'hq' ? 'hq' : employee.department_id,
                org_department_id: employee.org_department_id,
                position_id: employee.position_id,
                join_date: employee.join_date ? dayjs(employee.join_date) : undefined,
                birthday: employee.birthday ? dayjs(employee.birthday) : undefined,
                work_schedule: employee.work_schedule,
                annual_leave_cycle_months: employee.annual_leave_cycle_months,
                annual_leave_days: employee.annual_leave_days,
                probation_salary_cents: employee.probation_salary_cents ? employee.probation_salary_cents / 100 : 0,
                regular_salary_cents: employee.regular_salary_cents ? employee.regular_salary_cents / 100 : 0,
                active: employee.active,
                living_allowance_cents: employee.living_allowance_cents ? employee.living_allowance_cents / 100 : 0,
                housing_allowance_cents: employee.housing_allowance_cents ? employee.housing_allowance_cents / 100 : 0,
                transportation_allowance_cents: employee.transportation_allowance_cents ? employee.transportation_allowance_cents / 100 : 0,
                meal_allowance_cents: employee.meal_allowance_cents ? employee.meal_allowance_cents / 100 : 0,
                email: employee.email,
                phone_country_code: phoneCountryCode,
                phone_number: phoneNumber,
                address: employee.address,
                usdt_address: employee.usdt_address,
                emergency_contact: employee.emergency_contact,
                emergency_phone_country_code: emergencyPhoneCountryCode,
                emergency_phone_number: emergencyPhoneNumber,
                memo: employee.memo,
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, form])

    const handleUpdate = async () => {
        try {
            const values = await validateWithZod()
            if (!employee) return

            await updateEmployee({
                url: api.employeesById(employee.id),
                method: 'PUT',
                body: {
                    ...values,
                }
            })
            message.success('更新成功')
            onSuccess()
        } catch (error: any) {
            handleConflictError(error, '员工', 'name')
        }
    }

    return (
        <Modal
            title="编辑员工"
            open={open}
            onOk={handleUpdate}
            onCancel={() => {
                form.resetFields()
                onCancel()
            }}
            okText="保存"
            cancelText="取消"
            width={800}
            confirmLoading={isUpdating}
        >
            <EmployeeForm form={form} isEdit={true}>
                <TabPane tab="薪资与补贴" key="salary">
                    <Form.Item
                        name="probation_salary_cents"
                        label="试用期工资"
                        rules={[{ required: true, message: '请输入试用期工资' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入试用期工资"
                        />
                    </Form.Item>
                    <Form.Item
                        name="regular_salary_cents"
                        label="转正工资"
                        rules={[{ required: true, message: '请输入转正工资' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入转正工资"
                        />
                    </Form.Item>
                    <Form.Item
                        name="living_allowance_cents"
                        label="生活补贴"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入生活补贴"
                        />
                    </Form.Item>
                    <Form.Item
                        name="housing_allowance_cents"
                        label="住房补贴"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入住房补贴"
                        />
                    </Form.Item>
                    <Form.Item
                        name="transportation_allowance_cents"
                        label="交通补贴"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入交通补贴"
                        />
                    </Form.Item>
                    <Form.Item
                        name="meal_allowance_cents"
                        label="伙食补贴"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入伙食补贴"
                        />
                    </Form.Item>
                </TabPane>
            </EmployeeForm>
        </Modal>
    )
}


