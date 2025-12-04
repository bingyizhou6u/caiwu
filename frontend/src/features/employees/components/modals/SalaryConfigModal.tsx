import { Modal, Form, InputNumber, Select, Button, Space, message } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { salaryConfigSchema } from '../../../../validations/employee.schema'
import { useUpdateEmployeeSalaries } from '../../../../hooks/business/useEmployees'
import { useCurrencies } from '../../../../hooks/business/useCurrencies'
import type { Employee, Currency } from '../../../../types'
import { useEffect } from 'react'

const { Option } = Select

interface SalaryConfigModalProps {
    open: boolean
    employee: Employee | null
    type: 'probation' | 'regular'
    initialSalaries: any[]
    onCancel: () => void
    onSuccess: () => void
}

export function SalaryConfigModal({ open, employee, type, initialSalaries, onCancel, onSuccess }: SalaryConfigModalProps) {
    const { form, validateWithZod } = useZodForm(salaryConfigSchema)
    const { mutateAsync: updateSalaries, isPending } = useUpdateEmployeeSalaries()
    const { data: currencies = [] } = useCurrencies()

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                salaries: initialSalaries.length > 0
                    ? initialSalaries.map((s: any) => ({
                        currency_id: s.currency_id,
                        amount_cents: s.amount_cents / 100,
                    }))
                    : [{ currency_id: undefined, amount_cents: undefined }]
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, initialSalaries, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateWithZod()
            const salaries = (values.salaries || [])
                .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
                .map((s: any) => ({
                    currency_id: s.currency_id,
                    amount_cents: Math.round(s.amount_cents * 100),
                }))

            await updateSalaries({
                employee_id: employee.id,
                salary_type: type,
                salaries,
            })
            onSuccess()
        },
        { successMessage: '多币种底薪配置保存成功' }
    )

    return (
        <Modal
            title={`${type === 'probation' ? '试用期' : '转正'}底薪配置 - ${employee?.name}`}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            width={600}
            confirmLoading={isPending}
        >
            <Form form={form} layout="vertical">
                <Form.List name="salaries">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'currency_id']}
                                        rules={[{ required: true, message: '请选择币种' }]}
                                    >
                                        <Select placeholder="币种" style={{ width: 120 }}>
                                            {currencies.map((c: Currency) => (
                                                <Option key={c.id} value={c.id}>{c.code}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'amount_cents']}
                                        rules={[{ required: true, message: '请输入金额' }]}
                                    >
                                        <InputNumber placeholder="金额" style={{ width: 200 }} min={0} precision={2} />
                                    </Form.Item>
                                    <MinusCircleOutlined onClick={() => remove(name)} />
                                </Space>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    添加币种底薪
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            </Form>
        </Modal>
    )
}
