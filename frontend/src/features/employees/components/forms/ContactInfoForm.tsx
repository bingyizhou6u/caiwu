/**
 * 员工联系方式表单
 * 卡片分区设计
 */

import { Form, Input, Select, Space } from 'antd'
import {
    PhoneOutlined,
    HomeOutlined,
    WalletOutlined,
    AlertOutlined,
    FileTextOutlined,
} from '@ant-design/icons'
import { COUNTRY_CODES } from '../../../../shared/constants'
import type { FormInstance } from 'antd/es/form'

const { Option } = Select
const { TextArea } = Input

interface ContactInfoFormProps {
    form: FormInstance
}

export function ContactInfoForm({ form }: ContactInfoFormProps) {
    return (
        <Form form={form} layout="vertical" className="employee-form-content">
            {/* 联系方式卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon contact">
                        <PhoneOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">联系方式</h3>
                        <p className="form-section-desc">手机号和支付地址</p>
                    </div>
                </div>

                <Form.Item label="手机号" className="form-col-full">
                    <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="phone_country_code" initialValue="+971" noStyle>
                            <Select style={{ width: 120 }} showSearch>
                                {COUNTRY_CODES.map((c) => (
                                    <Option key={c.code} value={c.code}>
                                        {c.flag} {c.code}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="phone_number" noStyle>
                            <Input
                                style={{ flex: 1 }}
                                placeholder="请输入手机号"
                                prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                            />
                        </Form.Item>
                    </Space.Compact>
                </Form.Item>

                <div className="form-row">
                    <Form.Item name="usdtAddress" label="USDT地址">
                        <Input
                            prefix={<WalletOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="请输入USDT地址"
                        />
                    </Form.Item>
                </div>
            </div>

            {/* 居住地址卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon basic">
                        <HomeOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">居住地址</h3>
                        <p className="form-section-desc">当前居住地址信息</p>
                    </div>
                </div>

                <Form.Item name="address" label="详细地址" className="form-col-full">
                    <TextArea
                        rows={3}
                        placeholder="请输入详细居住地址"
                    />
                </Form.Item>
            </div>

            {/* 紧急联系人卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon leave">
                        <AlertOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">紧急联系人</h3>
                        <p className="form-section-desc">紧急情况联系方式</p>
                    </div>
                </div>

                <div className="form-row">
                    <Form.Item name="emergencyContact" label="联系人姓名">
                        <Input placeholder="请输入紧急联系人姓名" />
                    </Form.Item>
                </div>

                <Form.Item label="联系人电话" className="form-col-full">
                    <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="emergencyPhone_country_code" initialValue="+971" noStyle>
                            <Select style={{ width: 120 }} showSearch>
                                {COUNTRY_CODES.map((c) => (
                                    <Option key={c.code} value={c.code}>
                                        {c.flag} {c.code}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="emergencyPhone_number" noStyle>
                            <Input
                                style={{ flex: 1 }}
                                placeholder="请输入紧急联系人电话"
                                prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                            />
                        </Form.Item>
                    </Space.Compact>
                </Form.Item>
            </div>

            {/* 备注卡片 */}
            <div className="form-section-card">
                <div className="form-section-header">
                    <div className="form-section-icon status">
                        <FileTextOutlined />
                    </div>
                    <div className="form-section-title-group">
                        <h3 className="form-section-title">备注信息</h3>
                        <p className="form-section-desc">其他需要记录的信息</p>
                    </div>
                </div>

                <Form.Item name="memo" label="备注" className="form-col-full">
                    <TextArea
                        rows={4}
                        placeholder="请输入备注信息"
                    />
                </Form.Item>
            </div>
        </Form>
    )
}

