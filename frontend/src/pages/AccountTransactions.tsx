import { useEffect, useState } from 'react'
import { Card, Form, Select, Button, Table, Space, message, Modal } from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import { loadAccounts } from '../utils/loaders'
import { apiGet } from '../utils/api'

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

export function AccountTransactions() {
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<{value:string,label:string}[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const accountsData = await loadAccounts()
        setAccounts(accountsData)
      } catch (error: any) {
        message.error(error.message || '获取账户失败')
      }
    }
    loadMasterData()
  }, [])

  const query = async () => {
    try {
      const v = await form.validateFields()
      setLoading(true)
      const data = await apiGet(`${api.accountsById(v.account_id)}/transactions`)
      setRows(data ?? [])
    } catch (e: any) {
      message.error(e.message || '请选择账户')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="账户明细查询">
      <Form form={form} layout="inline">
        <Form.Item name="account_id" rules={[{ required: true, message: '请选择账户' }]}>
          <Select style={{ width: 300 }} options={accounts} placeholder="选择账户" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={query} loading={loading}>刷新</Button>
            <Button type="primary" onClick={query} loading={loading}>查询</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table 
        style={{ marginTop: 16 }} 
        rowKey="id" 
        dataSource={rows} 
        loading={loading}
        columns={[
          { title: '日期', dataIndex: 'transaction_date', width: 110 },
          { title: '凭证号', dataIndex: 'voucher_no', width: 120 },
          { title: '类型', dataIndex: 'transaction_type', width: 80, render: (v: string) => TYPE_LABELS[v] || v },
          { title: '类别', dataIndex: 'category_name', width: 120 },
          { title: '摘要', dataIndex: 'memo', ellipsis: true },
          { title: '交易对手', dataIndex: 'counterparty', width: 120 },
          { 
            title: '账变前金额', 
            dataIndex: 'balance_before_cents', 
            width: 130,
            align: 'right',
            render: (v: number) => (v / 100).toFixed(2)
          },
          { 
            title: '账变金额', 
            dataIndex: 'amount_cents', 
            width: 120,
            align: 'right',
            render: (v: number, r: any) => {
              const amount = (v / 100).toFixed(2)
              if (r.transaction_type === 'income') {
                return <span style={{ color: '#52c41a' }}>+{amount}</span>
              } else if (r.transaction_type === 'expense') {
                return <span style={{ color: '#ff4d4f' }}>-{amount}</span>
              }
              return amount
            }
          },
          { 
            title: '账变后金额', 
            dataIndex: 'balance_after_cents', 
            width: 130,
            align: 'right',
            render: (v: number) => <strong>{(v / 100).toFixed(2)}</strong>
          },
          { 
            title: '凭证', 
            dataIndex: 'voucher_url', 
            width: 100,
            render: (v: string) => v ? (
              <Button size="small" icon={<EyeOutlined />} onClick={() => {
                setPreviewUrl(v)
                setPreviewOpen(true)
              }}>查看</Button>
            ) : '-'
          },
        ]} 
        pagination={{ pageSize: 50, showSizeChanger: true }} 
      />
      
      <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
        {previewUrl && (
          <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
        )}
      </Modal>
    </Card>
  )
}

