import { Modal, Form, Button, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { allowanceConfigSchema } from '../../../../validations/employee.schema'
import { useUpdateEmployeeAllowances } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import { useEffect } from 'react'
import { AmountInput, CurrencySelect } from '../../../../components/form'

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

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                allowances: initialAllowances.length > 0
                    ? initialAllowances.map((s: any) => ({
                        currencyId: s.currencyId,
                        amountCents: s.amountCents / 100,
                    }))
                    : [{ currencyId: undefined, amountCents: undefined }]
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
                .filter((s: any) => s.currencyId && s.amountCents !== undefined && s.amountCents !== null)
                .map((s: any) => ({
                    currencyId: s.currencyId,
                    amountCents: Math.round(s.amountCents * 100),
                }))

            await updateAllowances({
                employeeId: employee.id,
                allowanceType: type,
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
                                        name={[name, 'currencyId']}
                                        rules={[{ required: true, message: '请选择币种' }]}
                                    >
                                        <CurrencySelect placeholder="币种" style={{ width: 120 }} />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'amountCents']}
                                        rules={[{ required: true, message: '请输入金额' }]}
                                    >
                                        <AmountInput placeholder="金额" style={{ width: 200 }} />
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
