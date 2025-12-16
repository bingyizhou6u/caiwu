import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Space, Tabs, InputNumber, message, Modal, Result } from 'antd'
import { PlusOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { handleConflictError } from '../../../utils/api'
import { ROLE_LABELS } from '../../../shared/constants'
import { useCurrencies, useCreateEmployee, useUpdateEmployeeAllowances } from '../../../hooks'
import type { Currency } from '../../../types'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createEmployeeSchema } from '../../../validations/employee.schema'
import { EmployeeForm } from '../../employees/components/forms/EmployeeForm'
import { PageContainer } from '../../../components/PageContainer'
import { withErrorHandler } from '../../../utils/errorHandler'

const { Option } = Select
const { TabPane } = Tabs

export function CreateEmployee() {
    const navigate = useNavigate()
    const { data: currencies = [] } = useCurrencies()
    const { form, validateWithZod } = useZodForm(createEmployeeSchema)
    const { mutateAsync: createEmployeeMutation, isPending: isCreating } = useCreateEmployee()
    const { mutateAsync: updateAllowances } = useUpdateEmployeeAllowances()
    const [success, setSuccess] = useState(false)
    const [createdData, setCreatedData] = useState<any>(null)

    const handleCreate = withErrorHandler(
        async () => {
            const values = await validateWithZod()

            // 1. 创建员工 - 转换字段名为后端格式 (camelCase)
            const {
                living_allowances,
                housing_allowances,
                transportation_allowances,
                meal_allowances,
                orgDepartmentId,
                project_id,
                probation_salaries,
                regular_salaries,
                phone_country_code,
                phone_number,
                emergencyPhone_country_code,
                emergencyPhone_number,
                joinDate,
                birthday,
                ...restData
            } = values

            const employeeData = {
                ...restData,
                orgDepartmentId,
                departmentId: project_id && project_id !== 'hq' ? project_id : undefined,
                probationSalaries: probation_salaries,
                regularSalaries: regular_salaries,
                phone: phone_country_code && phone_number ? `${phone_country_code}${phone_number}` : undefined,
                emergencyPhone: emergencyPhone_country_code && emergencyPhone_number ? `${emergencyPhone_country_code}${emergencyPhone_number}` : undefined,
                joinDate: joinDate ? joinDate.format('YYYY-MM-DD') : undefined,
                birthday: birthday ? birthday.format('YYYY-MM-DD') : undefined,
            }

            const data = await createEmployeeMutation(employeeData)

            // 2. 创建补贴（批量）
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal'] as const
            const allowancePromises: Promise<any>[] = []

            const allowancesMap = {
                living: living_allowances,
                housing: housing_allowances,
                transportation: transportation_allowances,
                meal: meal_allowances,
            }

            for (const type of allowanceTypes) {
                const allowances = allowancesMap[type] || []
                if (allowances.length > 0) {
                    allowancePromises.push(updateAllowances({
                        employeeId: data.id,
                        allowanceType: type,
                        allowances: allowances,
                    }))
                }
            }

            if (allowancePromises.length > 0) {
                await Promise.all(allowancePromises)
            }

            setCreatedData({ ...data, personalEmail: values.personalEmail })
            setSuccess(true)
        },
        {
            onError: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : ''
                if (errorMessage === '表单验证失败') {
                    message.error('请检查表单填写是否完整')
                } else {
                    handleConflictError(error, '员工', 'name')
                }
            }
        }
    )

    const handleBack = () => {
        navigate('/hr/employees')
    }

    if (success && createdData) {
        return (
            <PageContainer
                title="新建员工"
                breadcrumb={[{ title: '人力资源' }, { title: '新建员工' }]}
            >
                <Card bordered={false} className="page-card">
                    <Result
                        status="success"
                        title="员工创建成功！"
                        subTitle={createdData.user_account_created ? "系统已自动为该员工创建登录账号" : "员工信息已保存"}
                        extra={[
                            <Button type="primary" key="list" onClick={handleBack}>
                                返回员工列表
                            </Button>,
                            <Button key="add" onClick={() => { setSuccess(false); setCreatedData(null); form.resetFields() }}>
                                继续添加
                            </Button>,
                        ]}
                    >
                        {createdData.userAccountCreated && (
                            <div style={{ textAlign: 'left', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 16, marginTop: 16 }}>
                                <p><strong>公司邮箱：</strong>{createdData.email}</p>
                                <p><strong>个人邮箱：</strong>{createdData.personalEmail}</p>
                                <p><strong>用户角色：</strong>{ROLE_LABELS[createdData.userRole || 'employee'] || createdData.userRole || 'employee'}</p>
                                {createdData.emailRoutingCreated && (
                                    <p style={{ color: '#52c41a' }}>
                                        ✓ 邮箱路由已创建（发送到公司邮箱的邮件将转发到个人邮箱）
                                    </p>
                                )}
                                {createdData.emailSent ? (
                                    <p style={{ color: '#52c41a', fontWeight: 'bold' }}>
                                        ✓ 登录信息已发送至个人邮箱
                                    </p>
                                ) : (
                                    <p style={{ color: '#ff4d4f' }}>
                                        ⚠️ 邮件发送失败，请手动通知员工或联系管理员
                                    </p>
                                )}
                                <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
                                    提示：首次登录时系统会要求修改密码，请提醒员工妥善保管登录信息
                                </p>
                            </div>
                        )}
                    </Result>
                </Card>
            </PageContainer>
        )
    }

    return (
        <PageContainer
            title="新建员工"
            breadcrumb={[{ title: '人力资源' }, { title: '新建员工' }]}
            extra={
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                        返回
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleCreate} loading={isCreating}>
                        保存
                    </Button>
                </Space>
            }
        >
            <Card bordered={false} className="page-card">
                <EmployeeForm form={form}>
                    <TabPane tab="系统账号" key="account">
                        <Form.Item
                            name="personalEmail"
                            label="个人邮箱"
                            rules={[{ required: true, message: '请输入个人邮箱地址' }, { type: 'email', message: '请输入正确的邮箱地址' }]}
                            extra="用于接收系统邮件。公司邮箱 @cloudflarets.com 将根据员工姓名自动生成。"
                        >
                            <Input placeholder="请输入员工个人邮箱（如 Gmail）" />
                        </Form.Item>
                        <div className="form-extra-info" style={{ marginTop: '-16px', marginBottom: '16px' }}>
                            提示：用户角色将根据所选职位自动确定，无需手动设置
                        </div>
                    </TabPane>
                    <TabPane tab="薪资与补贴" key="salary">
                        <Form.Item
                            label="试用期多币种底薪"
                            required
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
                                                    name={[name, 'amountCents']}
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
                                        {fields.length === 0 && (
                                            <div style={{ color: '#ff4d4f', marginBottom: 8 }}>请至少添加一种币种的底薪</div>
                                        )}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>
                        <Form.Item
                            label="转正多币种底薪"
                            required
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
                                                    name={[name, 'amountCents']}
                                                    rules={[{ required: true, message: '请输入底薪金额' }]}
                                                    style={{ marginBottom: 0, flex: 1 }}
                                                >
                                                    <InputNumber placeholder="底薪金额" style={{ width: '100%' }} min={0} precision={2} />
                                                </Form.Item>
                                                <Button onClick={() => remove(name)} danger size="small">删除</Button>
                                            </Space>
                                        ))}
                                        {fields.length === 0 && (
                                            <div style={{ color: '#ff4d4f', marginBottom: 8 }}>请至少添加一种币种的底薪</div>
                                        )}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种底薪</Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>

                        {['living', 'housing', 'transportation', 'meal'].map(type => (
                            <Form.Item key={type} label={`${type === 'living' ? '生活' : type === 'housing' ? '住房' : type === 'transportation' ? '交通' : '伙食'}补贴`}>
                                <Form.List name={`${type}_allowances`}>
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                    <Form.Item {...restField} name={[name, 'currencyId']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                                                        <Select placeholder="选择币种" style={{ width: '100%' }}>
                                                            {currencies.map((c: Currency) => (
                                                                <Option key={c.code} value={c.code}>
                                                                    {c.code} - {c.name}
                                                                </Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'amountCents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
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
            </Card>
        </PageContainer>
    )
}

export default CreateEmployee
