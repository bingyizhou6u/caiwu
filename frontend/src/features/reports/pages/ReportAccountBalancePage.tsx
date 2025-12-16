import React, { useState, useMemo } from 'react'
import { Card, DatePicker, Button, Space, Statistic, Breadcrumb, Modal } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useAccountBalance } from '../../../hooks'
import type { AccountBalanceResponse } from '../../../hooks/business/useReports'
import { DataTable, type DataTableColumn, AmountDisplay, EmptyText, PageToolbar } from '../../../components/common'

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
  accountId: string
  accountName: string
  accountType: string
  accountNumber?: string
  currency: string
  opening_cents: number
  income_cents: number
  expense_cents: number
  closing_cents: number
}
type TransactionDetail = {
  id: string
  transactionDate: string
  transaction_type: string
  amountCents: number
  balance_before_cents: number
  balance_after_cents: number
  currency: string
  voucherNo?: string
  memo?: string
  counterparty?: string
  categoryName?: string
  voucherUrl?: string
}

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

import { PageContainer } from '../../../components/PageContainer'

export function ReportAccountBalance() {
  const [asOf, setAsOf] = useState<Dayjs>(dayjs())
  const [viewLevel, setViewLevel] = useState<ViewLevel>('currency')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [selectedAccountName, setSelectedAccountName] = useState<string>('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  const asOfStr = asOf.format('YYYY-MM-DD')
  const { data: balanceData, isLoading: loading } = useAccountBalance({ asOf: asOfStr })
  
  const rows: AccountBalanceResponse['rows'] = balanceData?.rows || []

  // 按币种汇总
  const currencySummaries = useMemo(() => {
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
    return Object.values(totalsByCurrency)
  }, [rows])

  // 按币种筛选账户
  const accountSummaries = useMemo(() => {
    if (!selectedCurrency) return []
    return rows.filter((r) => (r.currency || 'CNY') === selectedCurrency)
  }, [rows, selectedCurrency])

  // 账户明细（从rows中筛选，因为API返回的数据已经包含明细）
  const transactionDetails = useMemo(() => {
    if (!selectedAccountId) return []
    return rows.filter((r) => r.accountId === selectedAccountId && r.transactionDate)
  }, [rows, selectedAccountId])

  const loadCurrencySummary = () => {
    setViewLevel('currency')
    setSelectedCurrency('')
    setSelectedAccountId('')
  }

  const loadAccountsByCurrency = (currency: string) => {
    setSelectedCurrency(currency)
    setViewLevel('accounts')
  }

  const loadAccountDetails = (accountId: string, accountName: string) => {
    setSelectedAccountId(accountId)
    setSelectedAccountName(accountName)
    setViewLevel('details')
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
  ].filter(Boolean) as Array<{ title: string | React.ReactNode; onClick?: () => void }>

  return (
    <PageContainer
      title="账户余额报表"
      breadcrumb={[{ title: '报表中心' }, { title: '账户余额报表' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            {
              label: '查询',
              type: 'primary',
              onClick: loadCurrencySummary,
              loading: loading
            }
          ]}
          wrap
        >
          <DatePicker
            id="report-account-balance-date"
            value={asOf}
            onChange={(v) => v && setAsOf(v)}
            format="YYYY-MM-DD"
            placeholder="截至日期"
          />
        </PageToolbar>

        {viewLevel !== 'currency' && (
          <Breadcrumb style={{ marginBottom: 16 }} items={breadcrumbItems} />
        )}

        {viewLevel === 'currency' && (
          <div>
            <DataTable<CurrencySummary>
              rowKey="currency"
              data={currencySummaries}
              loading={loading}
              columns={[
                { title: '币种', dataIndex: 'currency', width: 100 },
                {
                  title: '期初余额',
                  dataIndex: 'openingCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: CurrencySummary) => <AmountDisplay cents={v || 0} currency={r.currency} />
                },
                {
                  title: '当日收入',
                  dataIndex: 'incomeCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: CurrencySummary) => (
                    <AmountDisplay 
                      cents={v || 0} 
                      currency={r.currency} 
                      style={{ color: v > 0 ? '#52c41a' : '#999' }}
                    />
                  )
                },
                {
                  title: '当日支出',
                  dataIndex: 'expenseCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: CurrencySummary) => (
                    <AmountDisplay 
                      cents={v || 0} 
                      currency={r.currency} 
                      style={{ color: v > 0 ? '#ff4d4f' : '#999' }}
                    />
                  )
                },
                {
                  title: '期末余额',
                  dataIndex: 'closingCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: CurrencySummary) => (
                    <AmountDisplay 
                      cents={v || 0} 
                      currency={r.currency} 
                      style={{ fontWeight: 'bold', color: '#1890ff' }}
                    />
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
              tableProps={{ pagination: false }}
            />
          </div>
        )}

        {viewLevel === 'accounts' && (
          <div>
            <DataTable<AccountSummary>
              rowKey="accountId"
              data={accountSummaries}
              loading={loading}
              columns={[
                { title: '账户名称', dataIndex: 'accountName', width: 150 },
                { title: '账户号', dataIndex: 'accountNumber', width: 120, render: (v: string) => <EmptyText value={v} /> },
                { title: '账户类型', dataIndex: 'accountType', width: 100 },
                {
                  title: '期初余额',
                  dataIndex: 'openingCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: AccountSummary) => <AmountDisplay cents={v || 0} currency={r.currency} showSymbol={false} />
                },
                {
                  title: '当日收入',
                  dataIndex: 'incomeCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: AccountSummary) => (
                    <span style={{ color: v > 0 ? '#52c41a' : '#999' }}>
                      <AmountDisplay cents={v || 0} currency={r.currency} showSymbol={false} />
                    </span>
                  )
                },
                {
                  title: '当日支出',
                  dataIndex: 'expenseCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: AccountSummary) => (
                    <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>
                      <AmountDisplay cents={v || 0} currency={r.currency} showSymbol={false} />
                    </span>
                  )
                },
                {
                  title: '期末余额',
                  dataIndex: 'closingCents',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number, r: AccountSummary) => (
                    <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      <AmountDisplay cents={v || 0} currency={r.currency} showSymbol={false} />
                    </span>
                  )
                },
                {
                  title: '操作',
                  width: 100,
                  render: (_: any, record: AccountSummary) => (
                    <Button type="link" onClick={() => loadAccountDetails(record.accountId, record.accountName)}>
                      查看明细
                    </Button>
                  )
                },
              ]}
              tableProps={{ pagination: false }}
            />
          </div>
        )}

        {viewLevel === 'details' && (
          <div>
            <DataTable<TransactionDetail>
              rowKey="id"
              data={transactionDetails}
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              columns={[
                { title: '日期', dataIndex: 'transactionDate', width: 110 },
                { title: '凭证号', dataIndex: 'voucherNo', width: 120, render: (v: string) => <EmptyText value={v} /> },
                { title: '类型', dataIndex: 'transactionType', width: 80, render: (v: string) => TYPE_LABELS[v] || v },
                { title: '类别', dataIndex: 'categoryName', width: 120, render: (v: string) => <EmptyText value={v} /> },
                { title: '摘要', dataIndex: 'memo', ellipsis: true, render: (v: string) => <EmptyText value={v} /> },
                { title: '交易对手', dataIndex: 'counterparty', width: 120, render: (v: string) => <EmptyText value={v} /> },
                {
                  title: '账变前金额',
                  dataIndex: 'balanceBeforeCents',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number, r: TransactionDetail) => <AmountDisplay cents={v || 0} currency={r.currency} />
                },
                {
                  title: '账变金额',
                  dataIndex: 'amountCents',
                  width: 120,
                  align: 'right' as const,
                  render: (v: number, r: TransactionDetail) => {
                    if (r.transaction_type === 'income') {
                      return <AmountDisplay cents={v || 0} currency={r.currency} style={{ color: '#52c41a' }} />
                    } else if (r.transaction_type === 'expense') {
                      return <AmountDisplay cents={v || 0} currency={r.currency} style={{ color: '#ff4d4f' }} />
                    }
                    return <AmountDisplay cents={v || 0} currency={r.currency} />
                  }
                },
                {
                  title: '账变后金额',
                  dataIndex: 'balanceAfterCents',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number, r: TransactionDetail) => (
                    <AmountDisplay 
                      cents={v || 0} 
                      currency={r.currency} 
                      style={{ fontWeight: 'bold' }}
                    />
                  )
                },
                {
                  title: '凭证',
                  dataIndex: 'voucherUrl',
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
