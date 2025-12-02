import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { useApiQuery, useApiMutation } from '../../../utils/useApiQuery'
import { usePermissions } from '../../../utils/permissions'
import { useCurrencies, useAccounts, useEmployees } from '../../../hooks/useBusinessData'
import { Borrowing } from '../../../types/business'

export function BorrowingManagement() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('finance', 'borrowing', 'create')

  // 加载基础数据
  const { data: currencies = [] } = useCurrencies()
  const { data: accounts = [] } = useAccounts()
  const { data: employees = [] } = useEmployees(true)

  // 过滤出有账号的员工
  const users = employees
    .filter((e: any) => e.user_active === 1 && e.user_id)
    .map((e: any) => ({
      value: e.user_id,
      label: `${e.label}${e.email ? ` (${e.email})` : ''}`
    }))

  // 加载借款列表
  const { data: borrowings = [], isPending: loading, refetch: load } = useApiQuery<Borrowing[]>(
    ['borrowings'],
    api.borrowings,
    {
      select: (data: any) => data.results ?? []
    }
  )

  // 创建借款 Mutation
  const createMutation = useApiMutation(
    () => {
      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
    }
  )

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      createMutation.mutate({
        url: api.borrowings,
        method: 'POST',
        body: {
          user_id: v.user_id,
          account_id: v.account_id,
          amount: v.amount,
          currency: v.currency,
          borrow_date: v.borrow_date.format('YYYY-MM-DD'),
          memo: v.memo || null,
        }
      })
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整信息')
      }
    }
  }

  return (
    <Card title="借款管理">
      <Space style={{ marginBottom: 12 }}>
        {canEdit && (
          <Button type="primary" onClick={() => {
            form.resetFields()
            form.setFieldsValue({ borrow_date: dayjs() })
            setOpen(true)
          }}>新建借款</Button>
        )}
        <Button onClick={() => load()}>刷新</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={borrowings}
        columns={[
          { title: '借款人', dataIndex: 'borrower_name', render: (v: string, r: any) => v || r.borrower_email || '-' },
          { title: '邮箱', dataIndex: 'borrower_email', render: (v: string) => v || '-' },
          { title: '资金账户', dataIndex: 'account_name' },
          {
            title: '借款金额',
            render: (_, r: any) => `${(r.amount_cents / 100).toFixed(2)} ${r.currency}`
          },
          { title: '借款日期', dataIndex: 'borrow_date' },
          { title: '备注', dataIndex: 'memo', render: (v: string) => v || '-' },
          { title: '创建人', dataIndex: 'creator_name' },
        ]}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="新建借款"
        open={open}
        confirmLoading={createMutation.isPending}
        onOk={handleSubmit}
        onCancel={() => {
          setOpen(false)
          form.resetFields()
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="借款人" rules={[{ required: true, message: '请选择借款人' }]}>
            <Select
              showSearch
              placeholder="请选择借款人"
              optionFilterProp="label"
              options={users}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select
              placeholder="请选择币种"
              options={currencies}
              style={{ width: '100%' }}
              onChange={(value) => {
                form.setFieldsValue({ account_id: undefined })
              }}
            />
          </Form.Item>
          <Form.Item name="account_id" label="资金账户" rules={[{ required: true, message: '请选择资金账户' }]}
            dependencies={['currency']}>
            <Select
              showSearch
              placeholder="请选择资金账户"
              optionFilterProp="label"
              options={accounts
                .filter((a: any) => {
                  const currency = form.getFieldValue('currency')
                  return !currency || a.currency === currency
                })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="amount" label="借款金额" rules={[{ required: true, message: '请输入借款金额' }]}>
            <Input type="number" step="0.01" placeholder="请输入借款金额" />
          </Form.Item>
          <Form.Item name="borrow_date" label="借款日期" rules={[{ required: true, message: '请选择借款日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
