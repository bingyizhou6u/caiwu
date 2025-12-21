import { useState, useEffect } from 'react'
import { Form, Input, Select, DatePicker, InputNumber, Switch, Tabs, Space } from 'antd'
import { WorkScheduleEditor } from '../WorkScheduleEditor'
import { COUNTRY_CODES } from '../../../../shared/constants'
import { useDepartmentOptions } from '../../../../hooks'
import { useApiQuery } from '../../../../utils/useApiQuery'
import { api } from '../../../../config/api'
import type { Position } from '../../../../types'
import '../../../../styles/features/employees/employee-form.css'

// 职位数据响应类型（可能包含 grouped 字段）
interface PositionsResponse {
    results?: Position[]
    grouped?: Record<string, Position[]>
}

const { Option, OptGroup } = Select
const { TabPane } = Tabs
const { TextArea } = Input

interface EmployeeFormProps {
    form: any
    isEdit?: boolean
    children?: React.ReactNode // 用于额外标签页或内容
    employee?: any // 员工对象，用于编辑模式下获取部门名称
}

export function EmployeeForm({ form, isEdit = false, children, employee }: EmployeeFormProps) {
    const { data: departmentOptions = [] } = useDepartmentOptions()
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
    const [selectedOrgDepartmentId, setSelectedOrgDepartmentId] = useState<string | undefined>()

    // 监听表单变化以更新级联选择的本地状态
    const projectId = Form.useWatch('project_id', form)
    const orgDepartmentId = Form.useWatch('orgDepartmentId', form)

    useEffect(() => {
        if (projectId) setSelectedProjectId(projectId)
    }, [projectId])

    useEffect(() => {
        if (orgDepartmentId) setSelectedOrgDepartmentId(orgDepartmentId)
    }, [orgDepartmentId])

    // 查询组织部门（直接传递 department ID，后端会自动判断是否为总部）
    const { data: orgDepartments = [] } = useApiQuery<unknown[]>(
        ['orgDepartments', selectedProjectId || ''],
        `${api.orgDepartments}?project_id=${selectedProjectId || ''}`,
        {
            enabled: !!selectedProjectId,
            select: (data: unknown) => {
                if (Array.isArray(data)) return data
                return (data as { results?: unknown[] })?.results || []
            }
        }
    )

    // 查询职位
    const { data: positionsData } = useApiQuery<PositionsResponse | Position[]>(
        ['positionsAvailable', selectedOrgDepartmentId || ''],
        `${api.positionsAvailable}?orgDepartmentId=${selectedOrgDepartmentId}`,
        { enabled: !!selectedOrgDepartmentId }
    )

    const positions = Array.isArray(positionsData) ? positionsData : (positionsData?.results || [])
    const groupedPositions: Record<string, Position[]> = Array.isArray(positionsData) ? {} : (positionsData?.grouped || {})
    const hasGroupedPositions = Object.keys(groupedPositions).length > 0

    // 处理部门列表：如果编辑模式下当前选中的部门不在列表中，需要添加它
    const currentOrgDepartmentId = form.getFieldValue('orgDepartmentId')
    const displayOrgDepartments = [...orgDepartments]
    
    // 在编辑模式下，如果当前选中的部门不在列表中（可能被停用或列表未加载），添加它
    if (isEdit && currentOrgDepartmentId && employee?.orgDepartmentName) {
        const existsInList = orgDepartments.some((d: any) => d.id === currentOrgDepartmentId)
        if (!existsInList) {
            // 如果当前选中的部门不在列表中，添加一个临时选项以正确显示
            displayOrgDepartments.unshift({
                id: currentOrgDepartmentId,
                name: employee.orgDepartmentName,
                code: employee.orgDepartmentCode || null,
                active: 1
            } as any)
        }
    }

    return (
        <Form form={form} layout="vertical" className="employee-form">
            <Tabs defaultActiveKey="basic">
                <TabPane tab="基本信息" key="basic">
                    <Form.Item
                        name="personalEmail"
                        label="个人邮箱"
                        rules={[
                            { required: true, message: '请输入个人邮箱地址' },
                            { type: 'email', message: '请输入正确的邮箱地址' }
                        ]}
                    >
                        <Input placeholder="请输入个人邮箱，用于接收系统邮件" />
                    </Form.Item>
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
                                    orgDepartmentId: undefined,
                                    positionId: undefined,
                                    departmentId: value
                                })
                                setSelectedProjectId(value)
                                setSelectedOrgDepartmentId(undefined)
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
                                setSelectedOrgDepartmentId(value)
                            }}
                        >
                            {displayOrgDepartments.filter((d: any) => d.active === 1).map((dept: any) => (
                                <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''} `}>
                                    {dept.name}{dept.code ? ` (${dept.code})` : ''}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="departmentId"
                        label="项目"
                        hidden
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="positionId"
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
                                        {groupPositions.map((pos) => (
                                            <Option key={pos.id} value={pos.id} label={pos.name || ''}>
                                                {pos.name || ''}
                                            </Option>
                                        ))}
                                    </OptGroup>
                                ))
                            ) : (
                                positions.map((pos: any) => (
                                    <Option key={pos.id} value={pos.id} label={pos.name || ''}>
                                        {pos.name || ''}
                                    </Option>
                                ))
                            )}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="joinDate"
                        label="入职日期"
                        rules={[{ required: true, message: '请选择入职日期' }]}
                    >
                        <DatePicker className="full-width" format="YYYY-MM-DD" />
                    </Form.Item>
                    <Form.Item
                        name="regularDate"
                        label="转正日期"
                        rules={[{ required: true, message: '请选择转正日期' }]}
                    >
                        <DatePicker className="full-width" format="YYYY-MM-DD" placeholder="请选择转正日期" />
                    </Form.Item>
                    <Form.Item
                        name="birthday"
                        label="生日"
                        rules={[{ required: true, message: '请选择生日' }]}
                    >
                        <DatePicker className="full-width" format="YYYY-MM-DD" placeholder="请选择生日" />
                    </Form.Item>
                    <Form.Item
                        name="workSchedule"
                        label="上班时间"
                    >
                        <WorkScheduleEditor />
                    </Form.Item>
                    <Form.Item
                        name="annualLeaveCycleMonths"
                        label="年假周期"
                    >
                        <Select>
                            <Option value={6}>半年制（6个月）</Option>
                            <Option value={12}>年制（12个月）</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="annualLeaveDays"
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

                    <Form.Item name="usdtAddress" label="USDT地址">
                        <Input placeholder="请输入USDT地址" />
                    </Form.Item>
                    <Form.Item name="address" label="住址">
                        <TextArea rows={3} placeholder="请输入住址" />
                    </Form.Item>
                    <Form.Item name="emergencyContact" label="紧急联系人">
                        <Input placeholder="请输入紧急联系人" />
                    </Form.Item>
                    <Form.Item label="紧急联系人电话" className="form-no-margin-bottom">
                        <Space.Compact className="form-full-width">
                            <Form.Item name="emergencyPhone_country_code" initialValue="+971" className="phone-code-select">
                                <Select showSearch>
                                    {COUNTRY_CODES.map(c => (
                                        <Option key={c.code} value={c.code}>{c.flag} {c.code}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="emergencyPhone_number" className="phone-number-input">
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
