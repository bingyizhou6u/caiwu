import { Modal, Form, Button, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { salaryConfigSchema } from '../../../../validations/employee.schema'
import { useUpdateEmployeeSalaries } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'
import { useEffect } from 'react'
import { AmountInput, CurrencySelect } from '../../../../components/form'

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

    useEffect(() => {
        if (open && employee) {
            form.setFieldsValue({
                salaries: initialSalaries.length > 0
                    ? initialSalaries.map((s: any) => ({
                        currencyId: s.currencyId,
                        amountCents: s.amountCents / 100,
                    }))
                    : [{ currencyId: undefined, amountCents: undefined }]
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
                .filter((s: any) => s.currencyId && s.amountCents !== undefined && s.amountCents !== null)
                .map((s: any) => ({
                    currencyId: s.currencyId,
                    amountCents: Math.round(s.amountCents * 100),
                }))

            await updateSalaries({
                employeeId: employee.id,
                salaryType: type,
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
