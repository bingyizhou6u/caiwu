import React from 'react'
import { Form, Space, Button, Select, Tabs } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CurrencySelect, AmountInput } from '../../../../components/form'
import { useCurrencies } from '../../../../hooks'
import type { FormInstance } from 'antd/es/form'
interface EmployeeSalaryFormProps {
    form: FormInstance
}

const { Option } = Select
const { TabPane } = Tabs

export const EmployeeSalaryForm: React.FC<EmployeeSalaryFormProps> = ({ form }) => {
    const { data: currencies = [] } = useCurrencies()

    const ALLOWANCE_TYPES = [
        { type: 'living', label: '生活补贴' },
        { type: 'housing', label: '住房补贴' },
        { type: 'transportation', label: '交通补贴' },
        { type: 'meal', label: '伙食补贴' },
    ]

    return (
        <>
            <div className="form-section-title" style={{ marginBottom: 16, fontWeight: 'bold' }}>基础薪资</div>

            <Form.Item
                label="试用期多币种底薪"
                required
                tooltip="员工试用期间的基本工资，支持多种货币组合"
            >
                <Form.List name="probation_salaries">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'currencyId']}
                                        rules={[{ required: true, message: '请选择币种' }]}
                                        style={{ marginBottom: 0, width: 120 }}
                                    >
                                        <CurrencySelect placeholder="选择币种" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'amountCents']}
                                        rules={[{ required: true, message: '请输入底薪金额' }]}
                                        style={{ marginBottom: 0, flex: 1 }}
                                    >
                                        <AmountInput placeholder="金额" currency={form.getFieldValue(['probation_salaries', name, 'currencyId'])} />
                                    </Form.Item>
                                    <Button onClick={() => remove(name)} danger icon={<DeleteOutlined />} size="small" />
                                </Space>
                            ))}
                            {fields.length === 0 && (
                                <div style={{ color: '#ff4d4f', marginBottom: 8, fontSize: 12 }}>请至少添加一种币种的底薪</div>
                            )}
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            </Form.Item>

            <Form.Item
                label="转正多币种底薪"
                required
                tooltip="员工转正后的基本工资，支持多种货币组合"
            >
                <Form.List name="regular_salaries">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'currencyId']}
                                        rules={[{ required: true, message: '请选择币种' }]}
                                        style={{ marginBottom: 0, width: 120 }}
                                    >
                                        <CurrencySelect placeholder="选择币种" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'amountCents']}
                                        rules={[{ required: true, message: '请输入底薪金额' }]}
                                        style={{ marginBottom: 0, flex: 1 }}
                                    >
                                        <AmountInput placeholder="金额" currency={form.getFieldValue(['regular_salaries', name, 'currencyId'])} />
                                    </Form.Item>
                                    <Button onClick={() => remove(name)} danger icon={<DeleteOutlined />} size="small" />
                                </Space>
                            ))}
                            {fields.length === 0 && (
                                <div style={{ color: '#ff4d4f', marginBottom: 8, fontSize: 12 }}>请至少添加一种币种的底薪</div>
                            )}
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            </Form.Item>

            <div className="form-section-title" style={{ marginTop: 24, marginBottom: 16, fontWeight: 'bold' }}>各项补贴</div>

            {ALLOWANCE_TYPES.map(({ type, label }) => (
                <Form.Item key={type} label={label}>
                    <Form.List name={`${type}_allowances`}>
                        {(fields, { add, remove }) => (
                            <div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 4 }}>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'currencyId']}
                                            rules={[{ required: true, message: '请选择币种' }]}
                                            style={{ marginBottom: 0, width: 120 }}
                                        >
                                            <CurrencySelect placeholder="选择币种" />
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'amountCents']}
                                            rules={[{ required: true, message: '请输入金额' }]}
                                            style={{ marginBottom: 0, flex: 1 }}
                                        >
                                            <AmountInput placeholder="金额" currency={form.getFieldValue([`${type}_allowances`, name, 'currencyId'])} />
                                        </Form.Item>
                                        <Button onClick={() => remove(name)} danger icon={<DeleteOutlined />} size="small" />
                                    </Space>
                                ))}
                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加补贴项</Button>
                                </Form.Item>
                            </div>
                        )}
                    </Form.List>
                </Form.Item>
            ))}
        </>
    )
}
