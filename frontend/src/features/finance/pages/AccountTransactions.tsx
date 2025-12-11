import { useState } from 'react'
import { Card, Form, Select, Button, Table, Space, Modal } from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useAccountTransactions } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { VirtualTable } from '../../../components/VirtualTable'

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

import { PageContainer } from '../../../components/PageContainer'

export function AccountTransactions() {
  const [form] = Form.useForm()
  const [accountId, setAccountId] = useState<string>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: rows = [], isLoading: loading, refetch: query } = useAccountTransactions(accountId)

  const handleQuery = withErrorHandler(
    async () => {
      const v = await form.validateFields()
      setAccountId(v.accountId)
      // accountId 变化会自动触发查询，但如果是同ID刷新，需要手动调用
      if (v.accountId === accountId) {
        query()
      }
    },
    { showSuccess: false }
  )

  return (
    <PageContainer
      title="账户明细查询"
      breadcrumb={[{ title: '财务管理' }, { title: '账户明细查询' }]}
    >
      <Card bordered={false} className="page-card">
        <Form form={form} layout="inline">
          <Form.Item name="accountId" rules={[{ required: true, message: '请选择账户' }]}>
            <Select style={{ width: 300 }} options={accounts} placeholder="选择账户" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleQuery} loading={loading}>刷新</Button>
              <Button type="primary" onClick={handleQuery} loading={loading}>查询</Button>
            </Space>
          </Form.Item>
        </Form>
        <VirtualTable
          style={{ marginTop: 16 }}
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ y: 600, x: 1200 }}
          columns={[
            { title: '日期', dataIndex: 'transaction_date', width: 110 },
            { title: '凭证号', dataIndex: 'voucher_no', width: 120 },
            { title: '类型', dataIndex: 'transaction_type', width: 80, render: (v: string) => TYPE_LABELS[v] || v },
            { title: '类别', dataIndex: 'categoryName', width: 120 },
            { title: '摘要', dataIndex: 'memo' }, // VirtualTable 会自动计算宽度
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
              dataIndex: 'amountCents',
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
              dataIndex: 'voucherUrl',
              width: 100,
              render: (v: string) => v ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => {
                  setPreviewUrl(v)
                  setPreviewOpen(true)
                }}>查看</Button>
              ) : '-'
            },
          ]}
        />

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
