import { useState, useEffect } from 'react'
import { Form, Input, Select, DatePicker, InputNumber, Switch, Tabs, Space } from 'antd'
import { WorkScheduleEditor } from '../../../../components/WorkScheduleEditor'
import { COUNTRY_CODES } from '../../../../shared/constants'
import { useDepartments } from '../../../../hooks'
import { useApiQuery } from '../../../../utils/useApiQuery'
import { api } from '../../../../config/api'
import './EmployeeForm.css'

const { Option, OptGroup } = Select
const { TabPane } = Tabs
const { TextArea } = Input

interface EmployeeFormProps {
    form: any
    isEdit?: boolean
    children?: React.ReactNode // For extra tabs or content
}

export function EmployeeForm({ form, isEdit = false, children }: EmployeeFormProps) {
    const { data: departments = [] } = useDepartments()
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
    const [selectedOrgDepartmentId, setSelectedOrgDepartmentId] = useState<string | undefined>()

    // Watch for form changes to update local state for cascading selects
    const projectId = Form.useWatch('project_id', form)
    const orgDepartmentId = Form.useWatch('org_department_id', form)

    useEffect(() => {
        if (projectId) setSelectedProjectId(projectId)
    }, [projectId])

    useEffect(() => {
        if (orgDepartmentId) setSelectedOrgDepartmentId(orgDepartmentId)
    }, [orgDepartmentId])

    // Query for Org Departments
    const { data: orgDepartments = [] } = useApiQuery(
        ['orgDepartments', selectedProjectId || ''],
        `${api.orgDepartments}?project_id=${selectedProjectId === 'hq' ? 'hq' : selectedProjectId}`,
        {
            enabled: !!selectedProjectId,
            select: (data: any) => Array.isArray(data) ? data : data?.results || []
        }
    )

    // Query for Positions
    const { data: positionsData } = useApiQuery(
        ['positionsAvailable', selectedOrgDepartmentId || ''],
        `${api.positionsAvailable}?org_department_id=${selectedOrgDepartmentId}`,
        { enabled: !!selectedOrgDepartmentId }
    )

    const positions = Array.isArray(positionsData) ? [] : (positionsData?.results || [])
    const groupedPositions = (positionsData as any)?.grouped || {}
    const hasGroupedPositions = Object.keys(groupedPositions).length > 0

    return (
        <Form form={form} layout="vertical" className="employee-form">
            <Tabs defaultActiveKey="basic">
                <TabPane tab="基本信息" key="basic">
                    <Form.Item
                        name="name"
                        label="姓名"
                        rules={[{ required: true, message: '请输入姓名' }]}
                    >
                        <Input placeholder="请输入姓名" />
                    </Form.Item>
                    <Form.Item
                        name="project_id"
                        label="项目归属/总部"
                        rules={[{ required: true, message: '请选择项目归属或总部' }]}
                    >
                        <Select
                            placeholder="请选择项目归属或总部"
                            allowClear
                            onChange={(value) => {
                                form.setFieldsValue({
                                    org_department_id: undefined,
                                    position_id: undefined,
                                    department_id: value === 'hq' ? 'hq' : value
                                })
                                setSelectedProjectId(value)
                                setSelectedOrgDepartmentId(undefined)
                            }}
                        >
                            <Option value="hq">总部</Option>
                            {departments.filter((d: any) => d.id !== 'hq').map((dept: any) => (
                                <Option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="org_department_id"
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
                                form.setFieldsValue({ position_id: undefined })
                                setSelectedOrgDepartmentId(value)
                            }}
                        >
                            {orgDepartments.filter((d: any) => d.active === 1).map((dept: any) => (
                                <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''} `}>
                                    {dept.name}{dept.code ? ` (${dept.code})` : ''}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="department_id"
                        label="项目"
                        hidden
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="position_id"
                        label="职位"
                        rules={[{ required: true, message: '请选择职位' }]}
                        extra={
                            isEdit && positions.length === 0 ? (
                                <div className="form-extra-error">
                                    暂无可用职位，请联系系统管理员
                                </div>
                            ) : isEdit ? (
                                <div className="form-extra-info">
                                    职位权限由系统预设
                                </div>
                            ) : null
                        }
                    >
                        <Select
                            placeholder={selectedOrgDepartmentId ? '请选择职位' : '请先选择部门'}
                            disabled={!selectedOrgDepartmentId}
                            showSearch
                            filterOption={(input, option) => {
                                const label = option?.label || option?.children
                                if (Array.isArray(label)) return false
                                const text = typeof label === 'string' ? label : String(label ?? '')
                                return text.toLowerCase().includes(input.toLowerCase())
                            }}
                        >
                            {hasGroupedPositions ? (
                                Object.entries(groupedPositions).map(([groupName, groupPositions]) => (
                                    <OptGroup key={groupName} label={groupName}>
                                        {(groupPositions as any[]).map((pos) => (
                                            <Option key={pos.id} value={pos.id} label={pos.name}>
                                                {pos.name}
                                                {pos.function_role && <span className="position-role">({pos.function_role === 'director' ? '主管' : pos.function_role === 'hr' ? '人事' : pos.function_role === 'finance' ? '财务' : pos.function_role === 'admin' ? '行政' : pos.function_role === 'developer' ? '开发' : pos.function_role === 'support' ? '客服' : pos.function_role === 'member' ? '组员' : pos.function_role})</span>}
                                            </Option>
                                        ))}
                                    </OptGroup>
                                ))
                            ) : (
                                positions.map((pos: any) => (
                                    <Option key={pos.id} value={pos.id} label={pos.name}>
                                        {pos.name}
                                        {pos.function_role && <span className="position-role">({pos.function_role === 'director' ? '主管' : pos.function_role === 'hr' ? '人事' : pos.function_role === 'finance' ? '财务' : pos.function_role === 'admin' ? '行政' : pos.function_role === 'developer' ? '开发' : pos.function_role === 'support' ? '客服' : pos.function_role === 'member' ? '组员' : pos.function_role})</span>}
                                    </Option>
                                ))
                            )}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="join_date"
                        label="入职日期"
                        rules={[{ required: true, message: '请选择入职日期' }]}
                    >
                        <DatePicker className="full-width" format="YYYY-MM-DD" />
                    </Form.Item>
                    <Form.Item
                        name="birthday"
                        label="生日"
                        rules={[{ required: true, message: '请选择生日' }]}
                    >
                        <DatePicker className="full-width" format="YYYY-MM-DD" placeholder="请选择生日" />
                    </Form.Item>
                    <Form.Item
                        name="work_schedule"
                        label="上班时间"
                    >
                        <WorkScheduleEditor />
                    </Form.Item>
                    <Form.Item
                        name="annual_leave_cycle_months"
                        label="年假周期"
                    >
                        <Select>
                            <Option value={6}>半年制（6个月）</Option>
                            <Option value={12}>年制（12个月）</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="annual_leave_days"
                        label="每周期年假天数"
                    >
                        <InputNumber min={0} max={365} className="full-width" addonAfter="天" />
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
                </TabPane>

                <TabPane tab="联系方式" key="contact">
                    <Form.Item label="手机号" className="form-no-margin-bottom">
                        <Space.Compact className="form-full-width">
                            <Form.Item name="phone_country_code" initialValue="+971" className="phone-code-select">
                                <Select showSearch>
                                    {COUNTRY_CODES.map(c => (
                                        <Option key={c.code} value={c.code}>{c.flag} {c.code}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="phone_number" className="phone-number-input">
                                <Input placeholder="请输入手机号" />
                            </Form.Item>
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入正确的邮箱地址' }]}>
                        <Input placeholder="请输入邮箱" />
                    </Form.Item>
                    <Form.Item name="usdt_address" label="USDT地址">
                        <Input placeholder="请输入USDT地址" />
                    </Form.Item>
                    <Form.Item name="address" label="住址">
                        <TextArea rows={3} placeholder="请输入住址" />
                    </Form.Item>
                    <Form.Item name="emergency_contact" label="紧急联系人">
                        <Input placeholder="请输入紧急联系人" />
                    </Form.Item>
                    <Form.Item label="紧急联系人电话" className="form-no-margin-bottom">
                        <Space.Compact className="form-full-width">
                            <Form.Item name="emergency_phone_country_code" initialValue="+971" className="phone-code-select">
                                <Select showSearch>
                                    {COUNTRY_CODES.map(c => (
                                        <Option key={c.code} value={c.code}>{c.flag} {c.code}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="emergency_phone_number" className="phone-number-input">
                                <Input placeholder="请输入紧急联系人电话" />
                            </Form.Item>
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="memo" label="备注">
                        <TextArea rows={4} placeholder="请输入备注" />
                    </Form.Item>
                </TabPane>
                {children}
            </Tabs>
        </Form>
    )
}
