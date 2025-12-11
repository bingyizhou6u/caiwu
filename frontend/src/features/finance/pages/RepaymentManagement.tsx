import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useBorrowings, useRepayments, useCreateRepayment } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createRepaymentSchema } from '../../../validations/repayment.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { Repayment } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'

export function RepaymentManagement() {
  const [open, setOpen] = useState(false)

  const { form, validateWithZod } = useZodForm(createRepaymentSchema)

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('finance', 'borrowing', 'create')

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: borrowings = [] } = useBorrowings()
  const { data: repayments = [], isLoading: loading, refetch: load } = useRepayments()
  const { mutateAsync: createRepayment, isPending: isCreating } = useCreateRepayment()

  // 借款选项
  const borrowingOptions = borrowings.map((b: any) => ({
    value: b.id,
    label: `${b.borrowerName || b.borrowerEmail || '-'} - ${(b.amountCents / 100).toFixed(2)} ${b.currency} (${b.borrowDate})`,
    currency: b.currency
  }))

  // 处理函数
  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateWithZod()
      await createRepayment({
        ...values,
        repay_date: values.repay_date.format('YYYY-MM-DD')
      })
      setOpen(false)
      form.resetFields()
      load()
    },
    { successMessage: '创建成功' }
  )

  return (
    <PageContainer
      title="还款管理"
      breadcrumb={[{ title: '财务管理' }, { title: '还款管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          {canEdit && (
            <Button type="primary" onClick={() => {
              form.resetFields()
              form.setFieldsValue({ repay_date: dayjs() })
              setOpen(true)
            }}>新建还款</Button>
          )}
          <Button onClick={() => load()}>刷新</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={repayments}
          columns={[
            { title: '借款人', render: (_: unknown, r: Repayment) => r.borrowerName || r.borrowerEmail || '-' },
            { title: '邮箱', dataIndex: 'borrower_email', render: (v: string) => v || '-' },
            { title: '资金账户', dataIndex: 'accountName' },
            {
              title: '还款金额',
              render: (_: unknown, r: Repayment) => `${(r.amountCents / 100).toFixed(2)} ${r.currency}`
            },
            { title: '还款日期', dataIndex: 'repay_date' },
            { title: '备注', dataIndex: 'memo', render: (v: string) => v || '-' },
            { title: '创建人', dataIndex: 'creator_name' },
          ]}
          pagination={{ pageSize: 20 }}
        />

        <Modal
          title="新建还款"
          open={open}
          confirmLoading={isCreating}
          onOk={handleSubmit}
          onCancel={() => {
            setOpen(false)
            form.resetFields()
          }}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="borrowing_id" label="借款记录" rules={[{ required: true, message: '请选择借款记录' }]}>
              <Select
                showSearch
                placeholder="请选择借款记录"
                optionFilterProp="label"
                options={borrowingOptions}
                style={{ width: '100%' }}
                onChange={(value) => {
                  const borrowing = borrowingOptions.find((b: any) => b.value === value)
                  if (borrowing) {
                    form.setFieldsValue({ currency: borrowing.currency, accountId: undefined })
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
              <Select
                placeholder="请选择币种"
                options={[
                  { value: 'CNY', label: 'CNY - 人民币' },
                  { value: 'USD', label: 'USD - 美元' },
                  { value: 'EUR', label: 'EUR - 欧元' },
                  { value: 'USDT', label: 'USDT - 泰达币' },
                ]}
                style={{ width: '100%' }}
                onChange={(value) => {
                  form.setFieldsValue({ accountId: undefined })
                }}
              />
            </Form.Item>
            <Form.Item name="accountId" label="资金账户" rules={[{ required: true, message: '请选择资金账户' }]}
              dependencies={['currency']}>
              <Select
                showSearch
                placeholder="请选择资金账户"
                optionFilterProp="label"
                options={accounts
                  .filter((a: any) => {
                    const currency = form.getFieldValue('currency')
                    return !currency || a.currency === currency
                  })
                  .map((a: any) => ({ value: a.value, label: a.label }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="amount" label="还款金额" rules={[{ required: true, message: '请输入还款金额' }]}>
              <Input type="number" step="0.01" placeholder="请输入还款金额" />
            </Form.Item>
            <Form.Item name="repay_date" label="还款日期" rules={[{ required: true, message: '请选择还款日期' }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}
