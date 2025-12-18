import React from 'react'
import { Form, Button, DatePicker, Select, Input, Switch, message } from 'antd'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { employeeRegularizeSchema, employeeLeaveSchema, employeeRejoinSchema } from '../../../../validations/employee.schema'
import { useRegularizeEmployee, useLeaveEmployee, useRejoinEmployee } from '../../../../hooks/business/useEmployees'
import type { FormInstance } from 'antd/es/form'
import type { Employee } from '../../../../types'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

interface EmployeeStatusFormProps {
    form: FormInstance
    employee: Employee | null
    onSuccess?: () => void
}

export const EmployeeStatusForm: React.FC<EmployeeStatusFormProps> = ({ form, employee, onSuccess }) => {
    const { form: regularizeForm, validateWithZod: validateRegularize } = useZodForm(employeeRegularizeSchema)
    const { form: leaveForm, validateWithZod: validateLeave } = useZodForm(employeeLeaveSchema)
    const { form: rejoinForm, validateWithZod: validateRejoin } = useZodForm(employeeRejoinSchema)

    const { mutateAsync: regularizeEmployee, isPending: isRegularizing } = useRegularizeEmployee()
    const { mutateAsync: leaveEmployee, isPending: isLeaving } = useLeaveEmployee()
    const { mutateAsync: rejoinEmployee, isPending: isRejoining } = useRejoinEmployee()

    // 初始化表单数据
    React.useEffect(() => {
        if (employee) {
            // 转正表单
            regularizeForm.setFieldsValue({
                regularDate: employee.regularDate ? dayjs(employee.regularDate) : dayjs(),
            })

            // 离职表单
            leaveForm.setFieldsValue({
                leaveDate: dayjs(),
                leaveType: 'resigned',
                disableAccount: true,
            })

            // 重新入职表单
            rejoinForm.setFieldsValue({
                joinDate: employee.joinDate ? dayjs(employee.joinDate) : dayjs(),
                enableAccount: true,
            })
        }
    }, [employee, regularizeForm, leaveForm, rejoinForm])

    const handleRegularize = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateRegularize()
            await regularizeEmployee({
                id: employee.id,
                data: {
                    regularDate: values.regularDate.format('YYYY-MM-DD'),
                }
            })
            message.success('转正成功')
            onSuccess?.()
        },
        { successMessage: '' }
    )

    const handleLeave = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateLeave()
            await leaveEmployee({
                id: employee.id,
                data: {
                    leaveDate: values.leaveDate.format('YYYY-MM-DD'),
                    leaveType: values.leaveType,
                    leaveReason: values.leaveReason,
                    leaveMemo: values.leaveMemo,
                    disableAccount: values.disableAccount ?? true,
                }
            })
            message.success('离职办理成功')
            onSuccess?.()
        },
        { successMessage: '' }
    )

    const handleRejoin = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateRejoin()
            await rejoinEmployee({
                id: employee.id,
                data: {
                    joinDate: values.joinDate.format('YYYY-MM-DD'),
                    enableAccount: values.enableAccount ?? true,
                }
            })
            message.success('重新入职成功')
            onSuccess?.()
        },
        { successMessage: '' }
    )

    if (!employee) return null

    const canRegularize = employee.status === 'probation'
    const canLeave = employee.status !== 'resigned'
    const canRejoin = employee.status === 'resigned'

    return (
        <>
            <div className="form-section-title" style={{ marginBottom: 16, fontWeight: 'bold' }}>员工状态</div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <div style={{ marginBottom: 8 }}>
                    <strong>当前状态：</strong>
                    {employee.status === 'probation' && '试用期'}
                    {employee.status === 'regular' && '已转正'}
                    {employee.status === 'resigned' && '已离职'}
                </div>
                {employee.regularDate && (
                    <div style={{ marginBottom: 8 }}>
                        <strong>转正日期：</strong>
                        {employee.regularDate}
                    </div>
                )}
                {employee.leaveDate && (
                    <div>
                        <strong>离职日期：</strong>
                        {employee.leaveDate}
                    </div>
                )}
            </div>

            {/* 转正操作 */}
            {canRegularize && (
                <div style={{ marginBottom: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 4 }}>
                    <div style={{ marginBottom: 12, fontWeight: 'bold' }}>员工转正</div>
                    <Form form={regularizeForm} layout="vertical">
                        <Form.Item
                            name="regularDate"
                            label="转正日期"
                            rules={[{ required: true, message: '请选择转正日期' }]}
                        >
                            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" onClick={handleRegularize} loading={isRegularizing}>
                                确认转正
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            )}

            {/* 离职操作 */}
            {canLeave && (
                <div style={{ marginBottom: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 4 }}>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#ff4d4f' }}>员工离职</div>
                    <Form form={leaveForm} layout="vertical">
                        <Form.Item
                            name="leaveDate"
                            label="离职日期"
                            rules={[{ required: true, message: '请选择离职日期' }]}
                        >
                            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </Form.Item>
                        <Form.Item
                            name="leaveType"
                            label="离职类型"
                            rules={[{ required: true, message: '请选择离职类型' }]}
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
                            name="leaveReason"
                            label="离职原因"
                        >
                            <TextArea rows={3} placeholder="请输入离职原因" />
                        </Form.Item>
                        <Form.Item
                            name="leaveMemo"
                            label="离职备注"
                        >
                            <TextArea rows={3} placeholder="请输入备注信息" />
                        </Form.Item>
                        <Form.Item
                            name="disableAccount"
                            label="账号处理"
                            valuePropName="checked"
                        >
                            <Switch checkedChildren="禁用账号" unCheckedChildren="保持启用" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" danger onClick={handleLeave} loading={isLeaving}>
                                确认离职
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            )}

            {/* 重新入职操作 */}
            {canRejoin && (
                <div style={{ marginBottom: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 4 }}>
                    <div style={{ marginBottom: 12, fontWeight: 'bold' }}>重新入职</div>
                    <Form form={rejoinForm} layout="vertical">
                        <Form.Item
                            name="joinDate"
                            label="入职日期"
                            rules={[{ required: true, message: '请选择入职日期' }]}
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
                        <Form.Item>
                            <Button type="primary" onClick={handleRejoin} loading={isRejoining}>
                                确认入职
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            )}

            {!canRegularize && !canLeave && !canRejoin && (
                <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>
                    当前状态无需操作
                </div>
            )}
        </>
    )
}
