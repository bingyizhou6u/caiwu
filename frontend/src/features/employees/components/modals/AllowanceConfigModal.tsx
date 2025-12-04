import { Modal, Form, InputNumber, Select, Button, Space, message } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { allowanceConfigSchema } from '../../../../validations/employee.schema'
import { useUpdateEmployeeAllowances } from '../../../../hooks/business/useEmployees'
import { useCurrencies } from '../../../../hooks/business/useCurrencies'
import type { Employee, Currency } from '../../../../types'
import { useEffect } from 'react'

const { Option } = Select

const ALLOWANCE_TYPE_LABELS: Record<string, string> = {
    living: '生活补贴',
    housing: '住房补贴',
    transportation: '交通补贴',
    meal: '伙食补贴',
    birthday: '生日补贴',
}

interface AllowanceConfigModalProps {
    open: boolean
    employee: Employee | null
    type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
    initialAllowances: any[]
    onCancel: () => void
    onSuccess: () => void
}

export function AllowanceConfigModal({ open, employee, type, initialAllowances, onCancel, onSuccess }: AllowanceConfigModalProps) {
    const { form, validateWithZod } = useZodForm(allowanceConfigSchema)
    const { mutateAsync: updateAllowances, isPending } = useUpdateEmployeeAllowances()
    const { data: currencies = [] } = useCurrencies()

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                allowances: initialAllowances.length > 0
                    ? initialAllowances.map((s: any) => ({
                        currency_id: s.currency_id,
                        amount_cents: s.amount_cents / 100,
                    }))
                    : [{ currency_id: undefined, amount_cents: undefined }]
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, initialAllowances, form])

    const handleOk = withErrorHandler(
        async () => {
            if (!employee) return
            const values = await validateWithZod()
            const allowances = (values.allowances || [])
                .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
                .map((s: any) => ({
                    currency_id: s.currency_id,
                    amount_cents: Math.round(s.amount_cents * 100),
                }))

            await updateAllowances({
                employee_id: employee.id,
                allowance_type: type,
                allowances,
            })
            onSuccess()
        },
        { successMessage: '多币种补贴配置保存成功' }
    )

    return (
        <Modal
            title={`${ALLOWANCE_TYPE_LABELS[type]}配置 - ${employee?.name}`}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            width={600}
            confirmLoading={isPending}
        >
            <Form form={form} layout="vertical">
                <Form.List name="allowances">
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
                                    添加币种补贴
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            </Form>
        </Modal>
    )
}
