/**
 * 员工基本信息表单
 * 双列布局，卡片分区设计
 */

import { useState, useEffect } from 'react'
import { Form, Input, Select, DatePicker, InputNumber, Switch } from 'antd'
import {
    UserOutlined,
    MailOutlined,
    CalendarOutlined,
    TeamOutlined,
    IdcardOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons'
import { WorkScheduleEditor } from '../WorkScheduleEditor'
import { useDepartmentOptions } from '../../../../hooks'
import { useApiQuery } from '../../../../utils/useApiQuery'
import { api } from '../../../../config/api'
import type { Position } from '../../../../types'
import type { FormInstance } from 'antd/es/form'

interface PositionsResponse {
    results?: Position[]
    grouped?: Record<string, Position[]>
}

const { Option, OptGroup } = Select

interface BasicInfoFormProps {
    form: FormInstance
    isEdit?: boolean
    employee?: any
}

export function BasicInfoForm({ form, isEdit = false, employee }: BasicInfoFormProps) {
    const { data: departmentOptions = [] } = useDepartmentOptions()
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
    const [selectedOrgProjectId, setSelectedOrgProjectId] = useState<string | undefined>()

    // 监听表单变化
    const projectId = Form.useWatch('project_id', form)
    const orgDepartmentId = Form.useWatch('orgDepartmentId', form)

    useEffect(() => {
        if (projectId) setSelectedProjectId(projectId)
    }, [projectId])

    useEffect(() => {
        if (orgDepartmentId) setSelectedOrgProjectId(orgDepartmentId)
    }, [orgDepartmentId])

    // 查询组织部门
    const { data: orgDepartments = [] } = useApiQuery<unknown[]>(
        ['orgDepartments', selectedProjectId || ''],
        `${api.orgDepartments}?project_id=${selectedProjectId || ''}`,
        {
            enabled: !!selectedProjectId,
            select: (data: unknown) => {
                if (Array.isArray(data)) return data
                return (data as { results?: unknown[] })?.results || []
            },
        }
    )

    // 查询职位
    const { data: positionsData } = useApiQuery<PositionsResponse | Position[]>(
        ['positionsAvailable', selectedOrgProjectId || ''],
        `${api.positionsAvailable}?orgDepartmentId=${selectedOrgProjectId}`,
        { enabled: !!selectedOrgProjectId }
    )

    const positions = Array.isArray(positionsData) ? positionsData : positionsData?.results || []
    const groupedPositions: Record<string, Position[]> = Array.isArray(positionsData) ? {} : positionsData?.grouped || {}
    const hasGroupedPositions = Object.keys(groupedPositions).length > 0

    // 处理部门列表
    const currentOrgProjectId = form.getFieldValue('orgDepartmentId')
    const displayOrgDepartments = [...orgDepartments]

    if (isEdit && currentOrgProjectId && employee?.orgDepartmentName) {
        const existsInList = orgDepartments.some((d: any) => d.id === currentOrgProjectId)
        if (!existsInList) {
            displayOrgDepartments.unshift({
                id: currentOrgProjectId,
                name: employee.orgDepartmentName,
                code: employee.orgDepartmentCode || null,
                active: 1,
            } as any)
        }
    }

    return (
        <Form form={form} layout="vertical" className="employee-form-content">
            {/* 个人信息卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon basic">
                        <UserOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">个人信息</h3>
                        <p className="form-section-desc">员工基本身份信息</p>
                    </div>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="name"
                        label="姓名"
                        rules={[{ required: true, message: '请输入姓名' }]}
                    >
                        <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="请输入姓名" />
                    </Form.Item>

                    <Form.Item
                        name="personalEmail"
                        label="个人邮箱"
                        rules={[
                            { required: true, message: '请输入个人邮箱地址' },
                            { type: 'email', message: '请输入正确的邮箱地址' },
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="请输入个人邮箱" />
                    </Form.Item>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="birthday"
                        label="生日"
                        rules={[{ required: true, message: '请选择生日' }]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            format="YYYY-MM-DD"
                            placeholder="请选择生日"
                            suffixIcon={<CalendarOutlined />}
                        />
                    </Form.Item>

                    {isEdit && (
                        <Form.Item
                            name="active"
                            label="状态"
                            valuePropName="checked"
                            getValueFromEvent={(e) => (e ? 1 : 0)}
                            getValueProps={(value) => ({ checked: value === 1 })}
                        >
                            <Switch checkedChildren="启用" unCheckedChildren="停用" />
                        </Form.Item>
                    )}
                </div>
            </div>

            {/* 组织架构卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon contact">
                        <TeamOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">组织架构</h3>
                        <p className="form-section-desc">所属部门和职位信息</p>
                    </div>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="project_id"
                        label="项目归属/总部"
                        rules={[{ required: true, message: '请选择项目归属或总部' }]}
                    >
                        <Select
                            placeholder="请选择项目归属或总部"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={(value) => {
                                form.setFieldsValue({
                                    orgDepartmentId: undefined,
                                    positionId: undefined,
                                    projectId: value,
                                })
                                setSelectedProjectId(value)
                                setSelectedOrgProjectId(undefined)
                            }}
                        >
                            {departmentOptions.map((dept: any) => (
                                <Option key={dept.value} value={dept.value}>
                                    {dept.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="orgDepartmentId"
                        label="部门"
                        rules={[{ required: true, message: '请选择部门' }]}
                    >
                        <Select
                            placeholder={selectedProjectId ? '请选择部门' : '请先选择项目归属或总部'}
                            showSearch
                            disabled={!selectedProjectId}
                            filterOption={(input, option) => {
                                const label = typeof option?.label === 'string' ? option.label : String(option?.label ?? '')
                                return label.toLowerCase().includes(input.toLowerCase())
                            }}
                            onChange={(value) => {
                                form.setFieldsValue({ positionId: undefined })
                                setSelectedOrgProjectId(value)
                            }}
                        >
                            {displayOrgDepartments
                                .filter((d: any) => d.active === 1)
                                .map((dept: any) => (
                                    <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''}`}>
                                        {dept.name}
                                        {dept.code ? ` (${dept.code})` : ''}
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="positionId"
                        label="职位"
                        rules={[{ required: true, message: '请选择职位' }]}
                    >
                        <Select
                            placeholder={selectedOrgProjectId ? '请选择职位' : '请先选择部门'}
                            disabled={!selectedOrgProjectId}
                            showSearch
                            filterOption={(input, option) => {
                                const label = option?.label || option?.children
                                if (Array.isArray(label)) return false
                                const text = typeof label === 'string' ? label : String(label ?? '')
                                return text.toLowerCase().includes(input.toLowerCase())
                            }}
                        >
                            {hasGroupedPositions
                                ? Object.entries(groupedPositions).map(([groupName, groupPositions]) => (
                                      <OptGroup key={groupName} label={groupName}>
                                          {groupPositions.map((pos) => (
                                              <Option key={pos.id} value={pos.id} label={pos.name || ''}>
                                                  {pos.name || ''}
                                              </Option>
                                          ))}
                                      </OptGroup>
                                  ))
                                : positions.map((pos: any) => (
                                      <Option key={pos.id} value={pos.id} label={pos.name || ''}>
                                          {pos.name || ''}
                                      </Option>
                                  ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="projectId" label="项目" hidden>
                        <Input />
                    </Form.Item>
                </div>
            </div>

            {/* 入职信息卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon salary">
                        <IdcardOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">入职信息</h3>
                        <p className="form-section-desc">入职日期和工作安排</p>
                    </div>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="joinDate"
                        label="入职日期"
                        rules={[{ required: true, message: '请选择入职日期' }]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            format="YYYY-MM-DD"
                            placeholder="请选择入职日期"
                            suffixIcon={<CalendarOutlined />}
                        />
                    </Form.Item>

                    <Form.Item
                        name="regularDate"
                        label="转正日期"
                        rules={[{ required: true, message: '请选择转正日期' }]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            format="YYYY-MM-DD"
                            placeholder="请选择转正日期"
                            suffixIcon={<CalendarOutlined />}
                        />
                    </Form.Item>
                </div>

                <div className="form-row">
                    <Form.Item name="annualLeaveCycleMonths" label="年假周期">
                        <Select placeholder="请选择年假周期">
                            <Option value={6}>半年制（6个月）</Option>
                            <Option value={12}>年制（12个月）</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="annualLeaveDays" label="每周期年假天数">
                        <InputNumber min={0} max={365} style={{ width: '100%' }} addonAfter="天" />
                    </Form.Item>
                </div>

                <div className="form-col-full">
                    <Form.Item
                        name="workSchedule"
                        label={
                            <span>
                                <ClockCircleOutlined style={{ marginRight: 6 }} />
                                上班时间
                            </span>
                        }
                    >
                        <WorkScheduleEditor />
                    </Form.Item>
                </div>
            </div>
        </Form>
    )
}

