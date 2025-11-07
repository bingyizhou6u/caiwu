import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { api } from '../config/api'
import { loadAccounts } from '../utils/loaders'
import { apiGet, apiPost } from '../utils/api'

export function RepaymentManagement({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<any[]>([])
  const [borrowings, setBorrowings] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const canEdit = userRole === 'manager' || userRole === 'finance'

  const load = async () => {
    try {
      const rows = await apiGet(api.repayments)
      setData(rows)
    } catch (error: any) {
      message.error(`加载失败: ${error.message || '网络错误'}`)
    }
  }

  const loadMasterData = async () => {
    try {
      const [accountsData, borrowingsData] = await Promise.all([
        loadAccounts(),
        apiGet(api.borrowings)
      ])
      setAccounts(accountsData.map(a => ({ 
        id: a.value as string, 
        name: a.label.split(' (')[0],
        currency: a.currency
      })))
      setBorrowings(borrowingsData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    load()
    loadMasterData()
  }, [])

  const handleSubmit = async () => {
    const v = await form.validateFields()
    try {
      await apiPost(api.repayments, {
        ...v,
        repay_date: v.repay_date.format('YYYY-MM-DD')
      })
      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
      loadMasterData()
    } catch (error: any) {
      message.error(`创建失败: ${error.message || '未知错误'}`)
    }
  }

  return (
    <Card title="还款管理">
      <Space style={{ marginBottom: 12 }}>
        {canEdit && (
          <Button type="primary" onClick={() => {
            form.resetFields()
            form.setFieldsValue({ repay_date: dayjs() })
            setOpen(true)
          }}>新建还款</Button>
        )}
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={data} columns={[
        { title: '借款人', render: (_, r: any) => r.borrower_name || r.borrower_email || '-' },
        { title: '邮箱', dataIndex: 'borrower_email', render: (v: string) => v || '-' },
        { title: '资金账户', dataIndex: 'account_name' },
        { 
          title: '还款金额', 
          render: (_, r: any) => `${(r.amount_cents / 100).toFixed(2)} ${r.currency}`
        },
        { title: '还款日期', dataIndex: 'repay_date' },
        { title: '备注', dataIndex: 'memo', render: (v: string) => v || '-' },
        { title: '创建人', dataIndex: 'creator_name' },
      ]} pagination={{ pageSize: 20 }} />

      <Modal
        title="新建还款"
        open={open}
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
              options={borrowings.map((b: any) => ({
                value: b.id,
                label: `${b.borrower_name || b.borrower_email || '-'} - ${(b.amount_cents / 100).toFixed(2)} ${b.currency} (${b.borrow_date})`
              }))}
              style={{ width: '100%' }}
              onChange={(value) => {
                const borrowing = borrowings.find((b: any) => b.id === value)
                if (borrowing) {
                  form.setFieldsValue({ currency: borrowing.currency, account_id: undefined })
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
                })
                .map((a: any) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
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
  )
}

