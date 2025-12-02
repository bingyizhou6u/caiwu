

import { useState } from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, Tabs, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { api } from '../../../../config/api'
import { apiPut, handleConflictError } from '../../../../utils/api'
import { useApiQuery, useApiMutation } from '../../../../utils/useApiQuery'
import { WorkScheduleEditor } from '../../../../components/WorkScheduleEditor'
import { ROLE_LABELS, COUNTRY_CODES } from '../../../../shared/constants'
import { combinePhone } from '../../../../shared/utils/phone'
import type { Department } from '../../../../types/api'

const { Option, OptGroup } = Select
const { TabPane } = Tabs

interface CreateEmployeeModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
    departments: { id: string; name: string }[] // Project list
    currencies: { code: string; name: string }[]
}

export function CreateEmployeeModal({ open, onCancel, onSuccess, departments, currencies }: CreateEmployeeModalProps) {
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

    // Mutation for Create Employee
    const createEmployeeMutation = useApiMutation(async (data: any) => {
        // Handle allowances separately after employee creation
        // This logic was in the original handleCreate, but useApiMutation expects a single API call usually.
        // However, we can chain promises here.

        // 1. Create Employee (we need to use the mutation's fetcher or just fetch directly? 
        // useApiMutation uses fetch internally but we can't easily swap the URL mid-flight if we use the hook's trigger.
        // Actually useApiMutation takes { url, method, body } in mutate.
        // But we have complex logic here (create employee -> create allowances).
        // So we might want to keep the complex logic in a wrapper function and use useApiMutation just for the main call, 
        // or use a custom async function that calls apiPost/apiPut.

        // Let's stick to the pattern: useApiMutation for the main action.
        // But since we have dependent requests, maybe we should just use a standard async function 
        // and only use useApiMutation if we want to track loading state easily?
        // Or we can use useMutation from react-query directly?
        // useApiMutation is a wrapper.

        // Let's use the wrapper for the main creation, and then handle allowances manually?
        // Or just wrap the whole thing in a single async function and use useMutation (raw) if needed.
        // But to be consistent with the plan, let's use useApiMutation for the main creation.
        return data
    })

    // Actually, the original code had complex logic for allowances. 
    // Let's keep the handleCreate logic mostly as is, but use the mutation for the main POST to get loading state.

    const { mutateAsync: createEmployee, isPending: isCreating } = useApiMutation()

    const handleCreate = async () => {
        try {
            const v = await form.validateFields()

            const probationSalaries = v.probation_salaries
                .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
                .map((s: any) => ({
                    currency_id: s.currency_id,
                    amount_cents: Math.round(s.amount_cents * 100),
                }))

            const regularSalaries = v.regular_salaries
                .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
                .map((s: any) => ({
                    currency_id: s.currency_id,
                    amount_cents: Math.round(s.amount_cents * 100),
                }))

            const usdtProbation = probationSalaries.find((s: any) => s.currency_id === 'USDT')
            const defaultProbationCents = usdtProbation ? usdtProbation.amount_cents : probationSalaries[0]?.amount_cents || 0

            const usdtRegular = regularSalaries.find((s: any) => s.currency_id === 'USDT')
            const defaultRegularCents = usdtRegular ? usdtRegular.amount_cents : regularSalaries[0]?.amount_cents || 0

            // 1. Create Employee
            const data = await createEmployee({
                url: api.employees,
                method: 'POST',
                body: {
                    name: v.name,
                    department_id: v.department_id,
                    org_department_id: v.org_department_id,
                    position_id: v.position_id,
                    join_date: v.join_date.format('YYYY-MM-DD'),
                    annual_leave_cycle_months: v.annual_leave_cycle_months || 6,
                    annual_leave_days: v.annual_leave_days ?? 15,
                    probation_salary_cents: defaultProbationCents,
                    regular_salary_cents: defaultRegularCents,
                    probation_salaries: probationSalaries,
                    regular_salaries: regularSalaries,
                    phone: combinePhone(v.phone_country_code || '+971', v.phone_number || ''),
                    email: v.email,
                    usdt_address: v.usdt_address,
                    emergency_contact: v.emergency_contact,
                    emergency_phone: combinePhone(v.emergency_phone_country_code || '+971', v.emergency_phone_number || ''),
                    address: v.address,
                    memo: v.memo,
                    birthday: v.birthday.format('YYYY-MM-DD'),
                }
            })

            // 2. Create Allowances (Batch)
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal']
            const allowancePromises = []

            for (const type of allowanceTypes) {
                const allowances = v[`${type}_allowances`]
                    ?.filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
                    .map((s: any) => ({
                        currency_id: s.currency_id,
                        amount_cents: Math.round(s.amount_cents * 100),
                    })) || []

                if (allowances.length > 0) {
                    allowancePromises.push(apiPut(api.employeeAllowancesBatch, {
                        employee_id: data.id,
                        allowance_type: type,
                        allowances: allowances,
                    }))
                }
            }

            if (allowancePromises.length > 0) {
                await Promise.all(allowancePromises)
            }

            if (data.user_account_created) {
                Modal.success({
                    title: '创建成功',
                    width: 500,
                    content: (
                        <div style={{ marginTop: 16 }}>
                            <p>员工信息已创建成功！</p>
                            <p style={{ marginTop: 8, fontWeight: 'bold', color: '#1890ff' }}>
                                系统已自动为该员工创建登录账号
                            </p>
                            <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                                <p style={{ margin: '4px 0' }}><strong>员工邮箱：</strong>{data.email || v.email}</p>
                                <p style={{ margin: '4px 0' }}><strong>用户角色：</strong>{ROLE_LABELS[data.user_role || v.user_role || 'employee'] || data.user_role || v.user_role || 'employee'}</p>
                                {data.email_sent ? (
                                    <>
                                        <p style={{ margin: '8px 0', color: '#52c41a', fontWeight: 'bold' }}>
                                            ✓ 登录信息已发送至邮箱
                                        </p>
                                        <p style={{ margin: '4px 0', fontSize: '12px', color: '#999' }}>
                                            系统已自动发送包含登录地址和随机密码的邮件到员工邮箱，请提醒员工查收
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#ff4d4f' }}>
                                        ⚠️ 邮件发送失败，请联系系统管理员
                                    </p>
                                )}
                            </div>
                            <div style={{ marginTop: 12, padding: 10, background: '#fff3cd', borderRadius: 4, fontSize: '12px', color: '#856404' }}>
                                <strong>提示：</strong>首次登录时系统会要求修改密码，请提醒员工妥善保管登录信息
                            </div>
                        </div>
                    ),
                    okText: '我知道了',
                })
            } else {
                message.success('创建成功')
            }

            form.resetFields()
            setSelectedProjectId(undefined)
            setSelectedOrgDepartmentId(undefined)
            onSuccess()
        } catch (error: any) {
            handleConflictError(error, '员工', 'name')
        }
    }

    return (
        <Modal
            title="新建员工"
            open={open}
            onOk={handleCreate}
            onCancel={() => {
                form.resetFields()
                setSelectedProjectId(undefined)
                setSelectedOrgDepartmentId(undefined)
                onCancel()
            }}
            okText="创建"
            cancelText="取消"
            width={800}
            confirmLoading={isCreating}
        >
            <Form form={form} layout="vertical" initialValues={{
                probation_salaries: [{ currency_id: undefined, amount_cents: undefined }],
                regular_salaries: [{ currency_id: undefined, amount_cents: undefined }],
                living_allowances: [],
                housing_allowances: [],
                transportation_allowances: [],
                meal_allowances: [],
                annual_leave_cycle_months: 6,
                annual_leave_days: 15,
            }}>
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
                                                </Option>
                                            ))}
                                        </OptGroup>
                                    ))
                                ) : (
                                    positions.map((pos: any) => (
                                        <Option key={pos.id} value={pos.id} label={pos.name}>
                                            {pos.name}
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
                    </TabPane>
                    <TabPane tab="系统账号" key="account">
                        <Form.Item
                            name="email"
                            label="邮箱"
                            rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入正确的邮箱地址' }]}
                        >
                            <Input placeholder="请输入邮箱" />
                        </Form.Item>
                        <div style={{ color: '#999', fontSize: '12px', marginTop: '-16px', marginBottom: '16px' }}>
                            提示：用户角色将根据所选职位自动确定，无需手动设置
                        </div>
                    </TabPane>
                    <TabPane tab="薪资与补贴" key="salary">
                        <Form.Item
                            name="probation_salaries"
                            label="试用期多币种底薪"
                            rules={[
                                { required: true, message: '请至少添加一种币种的底薪' },
                                {
                                    validator: async (_, values) => {
                                        if (!values || values.length === 0) {
                                            return Promise.reject(new Error('请至少添加一种币种的底薪'))
                                        }
                                        const validSalaries = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                                        if (validSalaries.length === 0) {
                                            return Promise.reject(new Error('请至少添加一种币种的底薪'))
                                        }
                                    },
                                },
                            ]}
                        >
                            <Form.List name="probation_salaries">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'currency_id']}
                                                    rules={[{ required: true, message: '请选择币种' }]}
                                                    style={{ marginBottom: 0, flex: 1 }}
                                                >
                                                    <Select placeholder="选择币种" style={{ width: '100%' }}>
                                                        {currencies.map((c) => (
                                                            <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'amount_cents']}
                                                    rules={[{ required: true, message: '请输入底薪金额' }]}
                                                    style={{ marginBottom: 0, flex: 1 }}
                                                >
                                                    <InputNumber placeholder="底薪金额" style={{ width: '100%' }} min={0} precision={2} />
                                                </Form.Item>
                                                {fields.length > 1 && (
                                                    <Button onClick={() => remove(name)} danger size="small">删除</Button>
                                                )}
                                            </Space>
                                        ))}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>
                        <Form.Item
                            name="regular_salaries"
                            label="转正多币种底薪"
                            rules={[
                                { required: true, message: '请至少添加一种币种的底薪' },
                                {
                                    validator: async (_, values) => {
                                        if (!values || values.length === 0) {
                                            return Promise.reject(new Error('请至少添加一种币种的底薪'))
                                        }
                                        const validSalaries = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                                        if (validSalaries.length === 0) {
                                            return Promise.reject(new Error('请至少添加一种币种的底薪'))
                                        }
                                    },
                                },
                            ]}
                        >
                            <Form.List name="regular_salaries">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'currency_id']}
                                                    rules={[{ required: true, message: '请选择币种' }]}
                                                    style={{ marginBottom: 0, flex: 1 }}
                                                >
                                                    <Select placeholder="选择币种" style={{ width: '100%' }}>
                                                        {currencies.map((c) => (
                                                            <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'amount_cents']}
                                                    rules={[{ required: true, message: '请输入底薪金额' }]}
                                                    style={{ marginBottom: 0, flex: 1 }}
                                                >
                                                    <InputNumber placeholder="底薪金额" style={{ width: '100%' }} min={0} precision={2} />
                                                </Form.Item>
                                                <Button onClick={() => remove(name)} danger size="small">删除</Button>
                                            </Space>
                                        ))}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>

                        {['living', 'housing', 'transportation', 'meal'].map(type => (
                            <Form.Item key={type} name={`${type}_allowances`} label={`${type === 'living' ? '生活' : type === 'housing' ? '住房' : type === 'transportation' ? '交通' : '伙食'}补贴`}>
                                <Form.List name={`${type}_allowances`}>
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                    <Form.Item {...restField} name={[name, 'currency_id']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                                                        <Select placeholder="选择币种" style={{ width: '100%' }}>
                                                            {currencies.map((c) => (
                                                                <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'amount_cents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
                                                        <InputNumber placeholder="金额" style={{ width: '100%' }} min={0} precision={2} />
                                                    </Form.Item>
                                                    <Button onClick={() => remove(name)} danger size="small">删除</Button>
                                                </Space>
                                            ))}
                                            <Form.Item>
                                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种</Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>
                            </Form.Item>
                        ))}
                    </TabPane>
                    <TabPane tab="联系方式" key="contact">
                        <Form.Item label="手机号" style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="phone_country_code" initialValue="+971" style={{ width: '30%' }}>
                                    <Select showSearch>
                                        {COUNTRY_CODES.map(c => (
                                            <Option key={c.code} value={c.code}>{c.flag} {c.code}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item name="phone_number" style={{ width: '70%' }}>
                                    <Input placeholder="请输入手机号" />
                                </Form.Item>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item name="usdt_address" label="USDT地址">
                            <Input placeholder="请输入USDT地址" />
                        </Form.Item>
                        <Form.Item name="address" label="住址">
                            <Input placeholder="请输入住址" />
                        </Form.Item>
                        <Form.Item name="emergency_contact" label="紧急联系人">
                            <Input placeholder="请输入紧急联系人" />
                        </Form.Item>
                        <Form.Item label="紧急联系人电话" style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="emergency_phone_country_code" initialValue="+971" style={{ width: '30%' }}>
                                    <Select showSearch>
                                        {COUNTRY_CODES.map(c => (
                                            <Option key={c.code} value={c.code}>{c.flag} {c.code}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item name="emergency_phone_number" style={{ width: '70%' }}>
                                    <Input placeholder="请输入紧急联系人电话" />
                                </Form.Item>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item name="memo" label="备注">
                            <Input.TextArea rows={4} placeholder="请输入备注" />
                        </Form.Item>
                    </TabPane>
                </Tabs>
            </Form>
        </Modal>
    )
}

