
import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Switch, Tabs, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../../config/api'
import { apiPut, handleConflictError } from '../../../../utils/api'
import { useApiQuery, useApiMutation } from '../../../../utils/useApiQuery'
import { WorkScheduleEditor } from '../../../../components/WorkScheduleEditor'
import { combinePhone } from '../../../../shared/utils/phone'
import type { Employee } from '../../../../types/api'

const { Option, OptGroup } = Select
const { TabPane } = Tabs
const { TextArea } = Input

interface EditEmployeeModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
    departments: { id: string; name: string }[]
    employee: any
}

export function EditEmployeeModal({ open, onCancel, onSuccess, departments, employee }: EditEmployeeModalProps) {
    const [form] = Form.useForm()
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
    const [selectedOrgDepartmentId, setSelectedOrgDepartmentId] = useState<string | undefined>()

    // Query for Org Departments
    const { data: orgDepartments = [] } = useApiQuery(
        ['orgDepartments', selectedProjectId || ''],
        `${api.orgDepartments}?project_id=${selectedProjectId === 'hq' ? 'hq' : selectedProjectId}`,
        { enabled: !!selectedProjectId }
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

    // Mutation for Update Employee
    const { mutateAsync: updateEmployee, isPending: isUpdating } = useApiMutation()

    useEffect(() => {
        if (open && employee) {
            // Determine Project ID
            const projectId = employee.department_name === '总部' ? 'hq' : employee.department_id

            // Set local state to trigger queries
            setSelectedProjectId(projectId)
            setSelectedOrgDepartmentId(employee.org_department_id)

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
            setSelectedProjectId(undefined)
            setSelectedOrgDepartmentId(undefined)
        }
    }, [open, employee, form])

    const handleUpdate = async () => {
        const v = await form.validateFields()
        if (!employee) return

        try {
            await updateEmployee({
                url: api.employeesById(employee.id),
                method: 'PUT',
                body: {
                    name: v.name,
                    department_id: v.department_id,
                    org_department_id: v.org_department_id,
                    position_id: v.position_id,
                    join_date: v.join_date.format('YYYY-MM-DD'),
                    probation_salary_cents: Math.round(v.probation_salary_cents * 100),
                    regular_salary_cents: Math.round(v.regular_salary_cents * 100),
                    active: v.active,
                    phone: combinePhone(v.phone_country_code || '+971', v.phone_number || ''),
                    email: v.email,
                    usdt_address: v.usdt_address,
                    emergency_contact: v.emergency_contact,
                    emergency_phone: combinePhone(v.emergency_phone_country_code || '+971', v.emergency_phone_number || ''),
                    address: v.address,
                    memo: v.memo,
                    birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : undefined,
                    work_schedule: v.work_schedule,
                    annual_leave_cycle_months: v.annual_leave_cycle_months,
                    annual_leave_days: v.annual_leave_days,
                    living_allowance_cents: Math.round((v.living_allowance_cents || 0) * 100),
                    housing_allowance_cents: Math.round((v.housing_allowance_cents || 0) * 100),
                    transportation_allowance_cents: Math.round((v.transportation_allowance_cents || 0) * 100),
                    meal_allowance_cents: Math.round((v.meal_allowance_cents || 0) * 100),
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
                setSelectedProjectId(undefined)
                setSelectedOrgDepartmentId(undefined)
                onCancel()
            }}
            okText="保存"
            cancelText="取消"
            width={800}
            confirmLoading={isUpdating}
        >
            <Form form={form} layout="vertical">
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
                                {departments.filter(d => d.id !== 'hq').map((dept) => (
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
                                    <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''}`}>
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
                                positions.length === 0 ? (
                                    <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: 4 }}>
                                        暂无可用职位，请联系系统管理员
                                    </div>
                                ) : (
                                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                        职位权限由系统预设
                                    </div>
                                )
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
                                                    {pos.function_role && <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>({pos.function_role === 'director' ? '主管' : pos.function_role === 'hr' ? '人事' : pos.function_role === 'finance' ? '财务' : pos.function_role === 'admin' ? '行政' : pos.function_role === 'developer' ? '开发' : pos.function_role === 'support' ? '客服' : pos.function_role === 'member' ? '组员' : pos.function_role})</span>}
                                                </Option>
                                            ))}
                                        </OptGroup>
                                    ))
                                ) : (
                                    positions.map((pos: any) => (
                                        <Option key={pos.id} value={pos.id} label={pos.name}>
                                            {pos.name}
                                            {pos.function_role && <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>({pos.function_role === 'director' ? '主管' : pos.function_role === 'hr' ? '人事' : pos.function_role === 'finance' ? '财务' : pos.function_role === 'admin' ? '行政' : pos.function_role === 'developer' ? '开发' : pos.function_role === 'support' ? '客服' : pos.function_role === 'member' ? '组员' : pos.function_role})</span>}
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
                            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </Form.Item>
                        <Form.Item
                            name="birthday"
                            label="生日"
                            rules={[{ required: true, message: '请选择生日' }]}
                        >
                            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="请选择生日" />
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
                            <InputNumber min={0} max={365} style={{ width: '100%' }} addonAfter="天" />
                        </Form.Item>
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
                            name="active"
                            label="状态"
                            valuePropName="checked"
                            getValueFromEvent={(e) => (e ? 1 : 0)}
                            getValueProps={(value) => ({ checked: value === 1 })}
                        >
                            <Switch checkedChildren="启用" unCheckedChildren="停用" />
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
                    <TabPane tab="联系方式" key="contact">
                        <Form.Item label="手机号">
                            <Input.Group compact>
                                <Form.Item
                                    name="phone_country_code"
                                    noStyle
                                    initialValue="+971"
                                >
                                    <Input style={{ width: '30%' }} placeholder="+971" />
                                </Form.Item>
                                <Form.Item
                                    name="phone_number"
                                    noStyle
                                >
                                    <Input style={{ width: '70%' }} placeholder="请输入手机号码" />
                                </Form.Item>
                            </Input.Group>
                        </Form.Item>
                        <Form.Item
                            name="email"
                            label="邮箱"
                            rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}
                        >
                            <Input placeholder="请输入邮箱" />
                        </Form.Item>
                        <Form.Item
                            name="usdt_address"
                            label="USDT地址"
                        >
                            <Input placeholder="请输入USDT地址" />
                        </Form.Item>
                        <Form.Item
                            name="address"
                            label="地址"
                        >
                            <TextArea rows={3} placeholder="请输入地址" />
                        </Form.Item>
                        <Form.Item
                            name="emergency_contact"
                            label="紧急联系人"
                        >
                            <Input placeholder="请输入紧急联系人" />
                        </Form.Item>
                        <Form.Item label="紧急联系人电话">
                            <Input.Group compact>
                                <Form.Item
                                    name="emergency_phone_country_code"
                                    noStyle
                                    initialValue="+971"
                                >
                                    <Input style={{ width: '30%' }} placeholder="+971" />
                                </Form.Item>
                                <Form.Item
                                    name="emergency_phone_number"
                                    noStyle
                                >
                                    <Input style={{ width: '70%' }} placeholder="请输入手机号码" />
                                </Form.Item>
                            </Input.Group>
                        </Form.Item>
                        <Form.Item
                            name="memo"
                            label="备注"
                        >
                            <TextArea rows={4} placeholder="请输入备注信息" />
                        </Form.Item>
                    </TabPane>
                </Tabs>
            </Form>
        </Modal>
    )
}


