/**
 * 员工状态管理区块
 * 用于编辑模式下的状态操作
 */

import React from 'react'
import { Form, Button, DatePicker, Select, Input, Switch, message } from 'antd'
import {
    CheckCircleOutlined,
    LogoutOutlined,
    LoginOutlined,
    SettingOutlined,
} from '@ant-design/icons'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { employeeRegularizeSchema, employeeLeaveSchema, employeeRejoinSchema } from '../../../../validations/employee.schema'
import { useRegularizeEmployee, useLeaveEmployee, useRejoinEmployee } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

interface EmployeeStatusSectionProps {
    employee: Employee | null
    onSuccess?: () => void
}

export function EmployeeStatusSection({ employee, onSuccess }: EmployeeStatusSectionProps) {
    const { form: regularizeForm, validateWithZod: validateRegularize } = useZodForm(employeeRegularizeSchema)
    const { form: leaveForm, validateWithZod: validateLeave } = useZodForm(employeeLeaveSchema)
    const { form: rejoinForm, validateWithZod: validateRejoin } = useZodForm(employeeRejoinSchema)

    const { mutateAsync: regularizeEmployee, isPending: isRegularizing } = useRegularizeEmployee()
    const { mutateAsync: leaveEmployee, isPending: isLeaving } = useLeaveEmployee()
    const { mutateAsync: rejoinEmployee, isPending: isRejoining } = useRejoinEmployee()

    // 初始化表单数据
    React.useEffect(() => {
        if (employee) {
            regularizeForm.setFieldsValue({
                regularDate: employee.regularDate ? dayjs(employee.regularDate) : dayjs(),
            })

            leaveForm.setFieldsValue({
                leaveDate: dayjs(),
                leaveType: 'resigned',
                disableAccount: true,
            })

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
                },
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
                },
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
                },
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

    const getStatusBadge = () => {
        switch (employee.status) {
            case 'probation':
                return <span className="status-badge probation">试用期</span>
            case 'regular':
                return <span className="status-badge regular">已转正</span>
            case 'resigned':
                return <span className="status-badge resigned">已离职</span>
            default:
                return null
        }
    }

    return (
        <div className="employee-form-content">
            {/* 当前状态卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon status">
                        <SettingOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">当前状态</h3>
                        <p className="form-section-desc">员工在职状态信息</p>
                    </div>
                </div>

                <div className="status-info-card">
                    <div className="status-info-row">
                        <span className="status-info-label">状态</span>
                        <span className="status-info-value">{getStatusBadge()}</span>
                    </div>
                    {employee.joinDate && (
                        <div className="status-info-row">
                            <span className="status-info-label">入职日期</span>
                            <span className="status-info-value">{employee.joinDate}</span>
                        </div>
                    )}
                    {employee.regularDate && (
                        <div className="status-info-row">
                            <span className="status-info-label">转正日期</span>
                            <span className="status-info-value">{employee.regularDate}</span>
                        </div>
                    )}
                    {employee.leaveDate && (
                        <div className="status-info-row">
                            <span className="status-info-label">离职日期</span>
                            <span className="status-info-value">{employee.leaveDate}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 转正操作 */}
            {canRegularize && (
                <div className="form-section-card">
                    <div className="status-action-group">
                        <div className="status-action-title">
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            员工转正
                        </div>
                        <Form form={regularizeForm} layout="vertical">
                            <Form.Item
                                name="regularDate"
                                label="转正日期"
                                rules={[{ required: true, message: '请选择转正日期' }]}
                            >
                                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button
                                    type="primary"
                                    onClick={handleRegularize}
                                    loading={isRegularizing}
                                    icon={<CheckCircleOutlined />}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                    确认转正
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </div>
            )}

            {/* 离职操作 */}
            {canLeave && (
                <div className="form-section-card">
                    <div className="status-action-group">
                        <div className="status-action-title danger">
                            <LogoutOutlined />
                            员工离职
                        </div>
                        <Form form={leaveForm} layout="vertical">
                            <div className="form-row">
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
                            </div>
                            <Form.Item name="leaveReason" label="离职原因">
                                <TextArea rows={2} placeholder="请输入离职原因" />
                            </Form.Item>
                            <Form.Item name="leaveMemo" label="离职备注">
                                <TextArea rows={2} placeholder="请输入备注信息" />
                            </Form.Item>
                            <Form.Item name="disableAccount" label="账号处理" valuePropName="checked">
                                <Switch checkedChildren="禁用账号" unCheckedChildren="保持启用" />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="primary" danger onClick={handleLeave} loading={isLeaving} icon={<LogoutOutlined />}>
                                    确认离职
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </div>
            )}

            {/* 重新入职操作 */}
            {canRejoin && (
                <div className="form-section-card">
                    <div className="status-action-group">
                        <div className="status-action-title">
                            <LoginOutlined style={{ color: '#1890ff' }} />
                            重新入职
                        </div>
                        <Form form={rejoinForm} layout="vertical">
                            <Form.Item
                                name="joinDate"
                                label="入职日期"
                                rules={[{ required: true, message: '请选择入职日期' }]}
                            >
                                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>
                            <Form.Item name="enableAccount" label="账号处理" valuePropName="checked">
                                <Switch checkedChildren="启用账号" unCheckedChildren="保持禁用" />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="primary" onClick={handleRejoin} loading={isRejoining} icon={<LoginOutlined />}>
                                    确认入职
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </div>
            )}

            {!canRegularize && !canLeave && !canRejoin && (
                <div className="form-section-card">
                    <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
                        当前状态无需操作
                    </div>
                </div>
            )}
        </div>
    )
}

