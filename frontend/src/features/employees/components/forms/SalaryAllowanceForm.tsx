/**
 * 员工薪资补贴表单
 * 现代化卡片式设计
 */

import { Form, Button } from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    DollarOutlined,
    HomeOutlined,
    CarOutlined,
    CoffeeOutlined,
    HeartOutlined,
} from '@ant-design/icons'
import { CurrencySelect, AmountInput } from '../../../../components/form'
import type { FormInstance } from 'antd/es/form'

interface SalaryAllowanceFormProps {
    form: FormInstance
}

const ALLOWANCE_CONFIG = [
    { type: 'living', label: '生活补贴', icon: <HeartOutlined />, className: 'living' },
    { type: 'housing', label: '住房补贴', icon: <HomeOutlined />, className: 'housing' },
    { type: 'transportation', label: '交通补贴', icon: <CarOutlined />, className: 'transport' },
    { type: 'meal', label: '伙食补贴', icon: <CoffeeOutlined />, className: 'meal' },
]

export function SalaryAllowanceForm({ form }: SalaryAllowanceFormProps) {
    return (
        <Form form={form} layout="vertical" className="employee-form-content">
            {/* 基础薪资卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon salary">
                        <DollarOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">基础薪资</h3>
                        <p className="form-section-desc">员工试用期和转正后的薪资配置</p>
                    </div>
                </div>

                {/* 试用期薪资 */}
                <Form.Item
                    label={
                        <span style={{ fontWeight: 500 }}>
                            试用期薪资
                            <span style={{ color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>
                                (支持多币种)
                            </span>
                        </span>
                    }
                    required
                >
                    <Form.List name="probation_salaries">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <div key={key} className="salary-entry-card">
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => remove(name)}
                                            className="salary-delete-btn"
                                            size="small"
                                        />
                                        <div className="salary-entry-content">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'currencyId']}
                                                rules={[{ required: true, message: '请选择币种' }]}
                                                style={{ marginBottom: 0 }}
                                                className="salary-currency-select"
                                            >
                                                <CurrencySelect placeholder="选择币种" />
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'amountCents']}
                                                rules={[{ required: true, message: '请输入金额' }]}
                                                style={{ marginBottom: 0 }}
                                                className="salary-amount-input"
                                            >
                                                <AmountInput
                                                    placeholder="输入金额"
                                                    currency={form.getFieldValue(['probation_salaries', name, 'currencyId'])}
                                                />
                                            </Form.Item>
                                        </div>
                                    </div>
                                ))}
                                {fields.length === 0 && (
                                    <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 13 }}>
                                        请至少添加一种币种的底薪
                                    </div>
                                )}
                                <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    block
                                    icon={<PlusOutlined />}
                                    className="add-salary-btn"
                                >
                                    添加试用期薪资
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Form.Item>

                {/* 转正薪资 */}
                <Form.Item
                    label={
                        <span style={{ fontWeight: 500 }}>
                            转正薪资
                            <span style={{ color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>
                                (支持多币种)
                            </span>
                        </span>
                    }
                    required
                    style={{ marginTop: 24 }}
                >
                    <Form.List name="regular_salaries">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <div key={key} className="salary-entry-card">
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => remove(name)}
                                            className="salary-delete-btn"
                                            size="small"
                                        />
                                        <div className="salary-entry-content">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'currencyId']}
                                                rules={[{ required: true, message: '请选择币种' }]}
                                                style={{ marginBottom: 0 }}
                                                className="salary-currency-select"
                                            >
                                                <CurrencySelect placeholder="选择币种" />
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'amountCents']}
                                                rules={[{ required: true, message: '请输入金额' }]}
                                                style={{ marginBottom: 0 }}
                                                className="salary-amount-input"
                                            >
                                                <AmountInput
                                                    placeholder="输入金额"
                                                    currency={form.getFieldValue(['regular_salaries', name, 'currencyId'])}
                                                />
                                            </Form.Item>
                                        </div>
                                    </div>
                                ))}
                                {fields.length === 0 && (
                                    <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 13 }}>
                                        请至少添加一种币种的底薪
                                    </div>
                                )}
                                <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    block
                                    icon={<PlusOutlined />}
                                    className="add-salary-btn"
                                >
                                    添加转正薪资
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Form.Item>
            </div>

            {/* 补贴配置卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon status">
                        <HeartOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">各项补贴</h3>
                        <p className="form-section-desc">配置员工各类补贴，可选填</p>
                    </div>
                </div>

                {ALLOWANCE_CONFIG.map(({ type, label, icon, className }) => (
                    <div key={type} className="allowance-group">
                        <div className="allowance-group-header">
                            <div className="allowance-group-title">
                                <div className={`allowance-group-icon ${className}`}>{icon}</div>
                                <span>{label}</span>
                            </div>
                        </div>

                        <Form.List name={`${type}_allowances`}>
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <div key={key} className="salary-entry-card" style={{ marginBottom: 8 }}>
                                            <Button
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => remove(name)}
                                                className="salary-delete-btn"
                                                size="small"
                                            />
                                            <div className="salary-entry-content">
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'currencyId']}
                                                    rules={[{ required: true, message: '请选择币种' }]}
                                                    style={{ marginBottom: 0 }}
                                                    className="salary-currency-select"
                                                >
                                                    <CurrencySelect placeholder="选择币种" />
                                                </Form.Item>
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'amountCents']}
                                                    rules={[{ required: true, message: '请输入金额' }]}
                                                    style={{ marginBottom: 0 }}
                                                    className="salary-amount-input"
                                                >
                                                    <AmountInput
                                                        placeholder="输入金额"
                                                        currency={form.getFieldValue([`${type}_allowances`, name, 'currencyId'])}
                                                    />
                                                </Form.Item>
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        type="dashed"
                                        onClick={() => add()}
                                        block
                                        icon={<PlusOutlined />}
                                        size="small"
                                        style={{ borderRadius: 6 }}
                                    >
                                        添加{label}
                                    </Button>
                                </>
                            )}
                        </Form.List>
                    </div>
                ))}
            </div>
        </Form>
    )
}

