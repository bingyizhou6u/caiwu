

import { Modal, Form, Input, Select, Button, Space, Tabs, InputNumber, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { api } from '../../../../config/api'
import { api as apiClient } from '../../../../api/http'
import { handleConflictError } from '../../../../utils/api'
import { useApiMutation } from '../../../../utils/useApiQuery'
import { ROLE_LABELS } from '../../../../shared/constants'
import { useCurrencies } from '../../../../hooks'
import type { Currency } from '../../../../types'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { createEmployeeSchema } from '../../../../validations/employee.schema'
import { EmployeeForm } from '../forms/EmployeeForm'

const { Option } = Select
const { TabPane } = Tabs

interface CreateEmployeeModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
}

export function CreateEmployeeModal({ open, onCancel, onSuccess }: CreateEmployeeModalProps) {
    const { data: currencies = [] } = useCurrencies()
    const { form, validateWithZod } = useZodForm(createEmployeeSchema)
    const { mutateAsync: createEmployee, isPending: isCreating } = useApiMutation()

    const handleCreate = async () => {
        try {
            const values = await validateWithZod()

            // 1. Create Employee
            const { living_allowances, housing_allowances, transportation_allowances, meal_allowances, ...employeeData } = values

            const data = await createEmployee({
                url: api.employees,
                method: 'POST',
                body: employeeData
            })

            // 2. Create Allowances (Batch)
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal'] as const
            const allowancePromises = []

            const allowancesMap = {
                living: living_allowances,
                housing: housing_allowances,
                transportation: transportation_allowances,
                meal: meal_allowances,
            }

            for (const type of allowanceTypes) {
                const allowances = allowancesMap[type] || []
                if (allowances.length > 0) {
                    allowancePromises.push(apiClient.put(api.employeeAllowancesBatch, {
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
                            <p className="success-modal-highlight">
                                系统已自动为该员工创建登录账号
                            </p>
                            <div className="success-modal-info-box">
                                <p><strong>员工邮箱：</strong>{data.email || values.email}</p>
                                <p><strong>用户角色：</strong>{ROLE_LABELS[data.user_role || 'employee'] || data.user_role || 'employee'}</p>
                                {data.email_sent ? (
                                    <>
                                        <p className="success-text-bold">
                                            ✓ 登录信息已发送至邮箱
                                        </p>
                                        <p className="form-extra-info">
                                            系统已自动发送包含登录地址和随机密码的邮件到员工邮箱，请提醒员工查收
                                        </p>
                                    </>
                                ) : (
                                    <p className="error-text-small">
                                        ⚠️ 邮件发送失败，请联系系统管理员
                                    </p>
                                )}
                            </div>
                            <div className="success-modal-warning-box">
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
                onCancel()
            }}
            okText="创建"
            cancelText="取消"
            width={800}
            confirmLoading={isCreating}
        >
            <EmployeeForm form={form}>
                <TabPane tab="系统账号" key="account">
                    <Form.Item
                        name="email"
                        label="邮箱"
                        rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入正确的邮箱地址' }]}
                    >
                        <Input placeholder="请输入邮箱" />
                    </Form.Item>
                    <div className="form-extra-info" style={{ marginTop: '-16px', marginBottom: '16px' }}>
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
                                                    {currencies.map((c: Currency) => (
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
                                                    {currencies.map((c: Currency) => (
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
                                                        {currencies.map((c: Currency) => (
                                                            <Option key={c.code} value={c.code}>
                                                                {c.code} - {c.name}
                                                            </Option>
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
            </EmployeeForm>
        </Modal>
    )
}

