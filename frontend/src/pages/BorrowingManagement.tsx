import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { api } from '../config/api'
import { loadCurrencies, loadAccounts } from '../utils/loaders'
import { apiGet } from '../utils/api'

export function BorrowingManagement({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const canEdit = userRole === 'manager' || userRole === 'finance'

  const load = async () => {
    const res = await fetch(api.borrowings, { credentials: 'include' })
    const j = await res.json()
    setData(j.results ?? [])
  }

  const loadMasterData = async () => {
    try {
      const [currenciesData, accountsData] = await Promise.all([
        loadCurrencies(),
        loadAccounts()
      ])
      setCurrencies(currenciesData.map(c => ({ 
        code: c.value as string, 
        name: c.label.split(' - ')[1] || c.label 
      })))
      setAccounts(accountsData.map(a => ({ 
        id: a.value as string, 
        name: a.label.split(' (')[0],
        currency: a.currency
      })))
      // 从人员管理获取用户列表（只获取已启用的账号）
      try {
        const employeesData = await apiGet(api.employees)
        const activeUsers = employeesData
          .filter((e: any) => e.user_active === 1 && e.user_id)
          .map((e: any) => ({
            id: e.user_id,
            name: e.name,
            email: e.email
          }))
        setUsers(activeUsers)
      } catch (error: any) {
        console.warn('Failed to load employees for user list:', error)
        setUsers([])
      }
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
      const res = await fetch(api.borrowings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: v.user_id,
          account_id: v.account_id,
          amount: v.amount,
          currency: v.currency,
          borrow_date: v.borrow_date.format('YYYY-MM-DD'),
          memo: v.memo || null,
        }),
        credentials: 'include'
      })
      
      if (res.ok) {
        message.success('创建成功')
        setOpen(false)
        form.resetFields()
        load()
      } else {
        const error = await res.json()
        message.error(error.error || '创建失败')
      }
    } catch (error: any) {
      message.error(`创建失败: ${error.message || '未知错误'}`)
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
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={data} columns={[
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
      ]} pagination={{ pageSize: 20 }} />

      <Modal
        title="新建借款"
        open={open}
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
              options={users.map((u: any) => ({ value: u.id, label: `${u.name}${u.email ? ` (${u.email})` : ''}` }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select
              placeholder="请选择币种"
              options={currencies.map((c: any) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
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

