import { useState } from 'react'
import { Card, DatePicker, Button, Table, Space, Statistic, message, Breadcrumb, Modal } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'

type ViewLevel = 'currency' | 'accounts' | 'details'
type CurrencySummary = {
  currency: string
  opening_cents: number
  income_cents: number
  expense_cents: number
  closing_cents: number
  count: number
}
type AccountSummary = {
  account_id: string
  account_name: string
  account_type: string
  account_number?: string
  currency: string
  opening_cents: number
  income_cents: number
  expense_cents: number
  closing_cents: number
}
type TransactionDetail = {
  id: string
  transaction_date: string
  transaction_type: string
  amount_cents: number
  balance_before_cents: number
  balance_after_cents: number
  voucher_no?: string
  memo?: string
  counterparty?: string
  category_name?: string
  voucher_url?: string
}

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

import { PageContainer } from '../../../components/PageContainer'

export function ReportAccountBalance() {
  const [asOf, setAsOf] = useState<any>(dayjs())
  const [viewLevel, setViewLevel] = useState<ViewLevel>('currency')
  const [currencySummaries, setCurrencySummaries] = useState<CurrencySummary[]>([])
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([])
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetail[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [selectedAccountName, setSelectedAccountName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  const loadCurrencySummary = async () => {
    const asOfStr = asOf.format('YYYY-MM-DD')
    setLoading(true)
    try {
      const data = await apiClient.get<any>(`${api.reports.accountBalance}?as_of=${asOfStr}`)
      const j = data as any
      const rows = j.rows ?? []

      // 按币种汇总
      const totalsByCurrency: Record<string, CurrencySummary> = {}
      for (const row of rows) {
        const curr = row.currency || 'CNY'
        if (!totalsByCurrency[curr]) {
          totalsByCurrency[curr] = {
            currency: curr,
            opening_cents: 0,
            income_cents: 0,
            expense_cents: 0,
            closing_cents: 0,
            count: 0
          }
        }
        totalsByCurrency[curr].opening_cents += row.opening_cents || 0
        totalsByCurrency[curr].income_cents += row.income_cents || 0
        totalsByCurrency[curr].expense_cents += row.expense_cents || 0
        totalsByCurrency[curr].closing_cents += row.closing_cents || 0
        totalsByCurrency[curr].count += 1
      }

      setCurrencySummaries(Object.values(totalsByCurrency))
      setViewLevel('currency')
    } catch (error: any) {
      message.error(error.message || '账户余额汇总失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAccountsByCurrency = async (currency: string) => {
    const asOfStr = asOf.format('YYYY-MM-DD')
    setLoading(true)
    try {
      const data = await apiClient.get<any>(`${api.reports.accountBalance}?as_of=${asOfStr}`)
      const j = data as any
      const rows = j.rows ?? []
      const accounts = rows.filter((r: any) => (r.currency || 'CNY') === currency)
      setAccountSummaries(accounts)
      setSelectedCurrency(currency)
      setViewLevel('accounts')
    } catch (error: any) {
      message.error(error.message || '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAccountDetails = async (accountId: string, accountName: string) => {
    setLoading(true)
    try {
      const results = await apiClient.get<TransactionDetail[]>(`${api.accountsById(accountId)}/transactions`)
      setTransactionDetails(results)
      setSelectedAccountId(accountId)
      setSelectedAccountName(accountName)
      setViewLevel('details')
    } catch (error: any) {
      message.error(error.message || '查询账户明细失败')
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbItems = [
    {
      title: <HomeOutlined />,
      onClick: () => {
        setViewLevel('currency')
        setSelectedCurrency('')
        setSelectedAccountId('')
        loadCurrencySummary()
      }
    },
    viewLevel === 'currency' && { title: '币种汇总' },
    viewLevel === 'accounts' && { title: `${selectedCurrency} - 账户汇总` },
    viewLevel === 'details' && {
      title: <span style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => loadAccountsByCurrency(selectedCurrency)}>{selectedCurrency} - 账户汇总</span>
    },
    viewLevel === 'details' && { title: `${selectedAccountName} - 账户明细` },
  ].filter(Boolean) as any[]

  return (
    <PageContainer
      title="账户余额汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '账户余额汇总' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DatePicker
            id="report-account-balance-date"
            value={asOf}
            onChange={(v) => v && setAsOf(v)}
            format="YYYY-MM-DD"
            placeholder="截至日期"
          />
          <Button type="primary" onClick={loadCurrencySummary} loading={loading}>查询</Button>
        </Space>

        {viewLevel !== 'currency' && (
          <Breadcrumb style={{ marginBottom: 16 }} items={breadcrumbItems} />
        )}

        {viewLevel === 'currency' && (
          <div>
            <Table
              className="table-striped"
              rowKey="currency"
              dataSource={currencySummaries}
              loading={loading}
              pagination={false}
              columns={[
                { title: '币种', dataIndex: 'currency', width: 100 },
                {
                  title: '期初余额',
                  dataIndex: 'opening_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => ((v || 0) / 100).toFixed(2)
                },
                {
                  title: '当日收入',
                  dataIndex: 'income_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: v > 0 ? '#52c41a' : '#999' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '当日支出',
                  dataIndex: 'expense_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '期末余额',
                  dataIndex: 'closing_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '账户数量',
                  dataIndex: 'count',
                  width: 100,
                  align: 'center' as const
                },
                {
                  title: '操作',
                  width: 100,
                  render: (_: any, record: CurrencySummary) => (
                    <Button type="link" onClick={() => loadAccountsByCurrency(record.currency)}>
                      查看账户
                    </Button>
                  )
                },
              ]}
            />
          </div>
        )}

        {viewLevel === 'accounts' && (
          <div>
            <Table
              className="table-striped"
              rowKey="account_id"
              dataSource={accountSummaries}
              loading={loading}
              pagination={false}
              columns={[
                { title: '账户名称', dataIndex: 'account_name', width: 150 },
                { title: '账户号', dataIndex: 'account_number', width: 120, render: (v: string) => v || '-' },
                { title: '账户类型', dataIndex: 'account_type', width: 100 },
                {
                  title: '期初余额',
                  dataIndex: 'opening_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => ((v || 0) / 100).toFixed(2)
                },
                {
                  title: '当日收入',
                  dataIndex: 'income_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: v > 0 ? '#52c41a' : '#999' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '当日支出',
                  dataIndex: 'expense_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '期末余额',
                  dataIndex: 'closing_cents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      {((v || 0) / 100).toFixed(2)}
                    </span>
                  )
                },
                {
                  title: '操作',
                  width: 100,
                  render: (_: any, record: AccountSummary) => (
                    <Button type="link" onClick={() => loadAccountDetails(record.account_id, record.account_name)}>
                      查看明细
                    </Button>
                  )
                },
              ]}
            />
          </div>
        )}

        {viewLevel === 'details' && (
          <div>
            <Table
              className="table-striped"
              rowKey="id"
              dataSource={transactionDetails}
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              columns={[
                { title: '日期', dataIndex: 'transaction_date', width: 110 },
                { title: '凭证号', dataIndex: 'voucher_no', width: 120, render: (v: string) => v || '-' },
                { title: '类型', dataIndex: 'transaction_type', width: 80, render: (v: string) => TYPE_LABELS[v] || v },
                { title: '类别', dataIndex: 'category_name', width: 120, render: (v: string) => v || '-' },
                { title: '摘要', dataIndex: 'memo', ellipsis: true, render: (v: string) => v || '-' },
                { title: '交易对手', dataIndex: 'counterparty', width: 120, render: (v: string) => v || '-' },
                {
                  title: '账变前金额',
                  dataIndex: 'balance_before_cents',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number) => ((v || 0) / 100).toFixed(2)
                },
                {
                  title: '账变金额',
                  dataIndex: 'amount_cents',
                  width: 120,
                  align: 'right' as const,
                  render: (v: number, r: any) => {
                    const amount = ((v || 0) / 100).toFixed(2)
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
                  align: 'right' as const,
                  render: (v: number) => <strong>{((v || 0) / 100).toFixed(2)}</strong>
                },
                {
                  title: '凭证',
                  dataIndex: 'voucher_url',
                  width: 100,
                  render: (v: string) => v ? (
                    <Button size="small" onClick={() => {
                      setPreviewUrl(v)
                      setPreviewOpen(true)
                    }}>查看</Button>
                  ) : '-'
                },
              ]}
            />
          </div>
        )}

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
