import { useState, useEffect } from 'react'
import { Card, Table, Space, Button, message, Breadcrumb, Statistic, Tag } from 'antd'
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { apiRequest } from '../../../utils/api'
import type { ColumnsType } from 'antd/es/table'

type ViewLevel = 'summary' | 'detail'
type BorrowerSummary = {
  user_id: string
  borrower_name: string
  borrower_email?: string
  currency: string
  total_borrowed_cents: number
  total_repaid_cents: number
  balance_cents: number
}
type BorrowingRecord = {
  id: string
  user_id: string
  amount_cents: number
  currency: string
  borrow_date: string
  memo?: string
  account_name?: string
  account_currency?: string
  creator_name?: string
}
type RepaymentRecord = {
  id: string
  borrowing_id: string
  user_id: string
  amount_cents: number
  currency: string
  repay_date: string
  memo?: string
  account_name?: string
  account_currency?: string
  creator_name?: string
  borrow_date?: string
}
type BorrowerDetail = {
  user: {
    id: string
    name: string
    email?: string
  }
  borrowings: BorrowingRecord[]
  repayments: RepaymentRecord[]
}

const formatAmount = (cents: number, currency: string) => {
  return `${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function ReportBorrowing() {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('summary')
  const [summaries, setSummaries] = useState<BorrowerSummary[]>([])
  const [detail, setDetail] = useState<BorrowerDetail | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUserName, setSelectedUserName] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const loadSummary = async () => {
    setLoading(true)
    try {
      const { results } = await apiRequest(api.reports.borrowingSummary)
      setSummaries(results)
      setViewLevel('summary')
    } catch (error: any) {
      message.error(error.message || '加载借款报表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (userId: string, userName: string) => {
    setLoading(true)
    try {
      const { data } = await apiRequest(api.reports.borrowingDetail(userId))
      setDetail(data as BorrowerDetail)
      setSelectedUserId(userId)
      setSelectedUserName(userName)
      setViewLevel('detail')
    } catch (error: any) {
      message.error(error.message || '加载明细失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  // 汇总表格列
  const summaryColumns: ColumnsType<BorrowerSummary> = [
    {
      title: '姓名',
      dataIndex: 'borrower_name',
      key: 'borrower_name',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'borrower_email',
      key: 'borrower_email',
      width: 180,
      render: (v: string) => v || '-',
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 80,
    },
    {
      title: '借款总额',
      dataIndex: 'total_borrowed_cents',
      key: 'total_borrowed_cents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => formatAmount(cents, record.currency),
    },
    {
      title: '还款总额',
      dataIndex: 'total_repaid_cents',
      key: 'total_repaid_cents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => formatAmount(cents, record.currency),
    },
    {
      title: '余额',
      dataIndex: 'balance_cents',
      key: 'balance_cents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => {
        const amount = formatAmount(cents, record.currency)
        return <span style={{ color: cents > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>{amount}</span>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: BorrowerSummary) => (
        <Button type="link" size="small" onClick={() => loadDetail(record.user_id, record.borrower_name)}>
          查看明细
        </Button>
      ),
    },
  ]

  // 借款明细表格列
  const borrowingColumns: ColumnsType<BorrowingRecord> = [
    {
      title: '借款日期',
      dataIndex: 'borrow_date',
      key: 'borrow_date',
      width: 120,
    },
    {
      title: '借款金额',
      dataIndex: 'amount_cents',
      key: 'amount_cents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowingRecord) => formatAmount(cents, record.currency),
    },
    {
      title: '账户',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
    },
    {
      title: '备注',
      dataIndex: 'memo',
      key: 'memo',
      ellipsis: true,
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
  ]

  // 还款明细表格列
  const repaymentColumns: ColumnsType<RepaymentRecord> = [
    {
      title: '还款日期',
      dataIndex: 'repay_date',
      key: 'repay_date',
      width: 120,
    },
    {
      title: '还款金额',
      dataIndex: 'amount_cents',
      key: 'amount_cents',
      width: 150,
      align: 'right',
      render: (cents: number, record: RepaymentRecord) => formatAmount(cents, record.currency),
    },
    {
      title: '对应借款日期',
      dataIndex: 'borrow_date',
      key: 'borrow_date',
      width: 120,
    },
    {
      title: '账户',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
    },
    {
      title: '备注',
      dataIndex: 'memo',
      key: 'memo',
      ellipsis: true,
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
  ]

  // 按币种汇总统计
  const currencyStats = summaries.reduce((acc, item) => {
    const curr = item.currency
    if (!acc[curr]) {
      acc[curr] = {
        currency: curr,
        total_borrowed: 0,
        total_repaid: 0,
        balance: 0,
        count: 0,
      }
    }
    acc[curr].total_borrowed += item.total_borrowed_cents
    acc[curr].total_repaid += item.total_repaid_cents
    acc[curr].balance += item.balance_cents
    acc[curr].count += 1
    return acc
  }, {} as Record<string, { currency: string; total_borrowed: number; total_repaid: number; balance: number; count: number }>)

  if (viewLevel === 'detail' && detail) {
    // 计算该借款人的汇总统计
    const borrowerCurrencyStats = detail.borrowings.reduce((acc, b) => {
      const curr = b.currency
      if (!acc[curr]) {
        acc[curr] = {
          currency: curr,
          borrowed: 0,
          repaid: 0,
        }
      }
      acc[curr].borrowed += b.amount_cents
      return acc
    }, {} as Record<string, { currency: string; borrowed: number; repaid: number }>)

    detail.repayments.forEach((r) => {
      const curr = r.currency
      if (!borrowerCurrencyStats[curr]) {
        borrowerCurrencyStats[curr] = {
          currency: curr,
          borrowed: 0,
          repaid: 0,
        }
      }
      borrowerCurrencyStats[curr].repaid += r.amount_cents
    })

    return (
      <Card>
        <Breadcrumb style={{ marginBottom: 16 }}>
          <Breadcrumb.Item>
            <Button type="link" icon={<HomeOutlined />} onClick={() => {
              setViewLevel('summary')
              setDetail(null)
              loadSummary()
            }}>
              借款报表
            </Button>
          </Breadcrumb.Item>
          <Breadcrumb.Item>{selectedUserName}</Breadcrumb.Item>
        </Breadcrumb>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div><strong>借款人：</strong>{detail.user.name}</div>
            {detail.user.email && <div><strong>邮箱：</strong>{detail.user.email}</div>}
          </Space>
        </Card>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {Object.values(borrowerCurrencyStats).map((stat) => (
            <Card key={stat.currency} title={`${stat.currency} 币种统计`} size="small">
              <Space size="large">
                <Statistic
                  title="借款总额"
                  value={stat.borrowed / 100}
                  precision={2}
                  suffix={stat.currency}
                />
                <Statistic
                  title="还款总额"
                  value={stat.repaid / 100}
                  precision={2}
                  suffix={stat.currency}
                />
                <Statistic
                  title="余额"
                  value={(stat.borrowed - stat.repaid) / 100}
                  precision={2}
                  suffix={stat.currency}
                  valueStyle={{ color: (stat.borrowed - stat.repaid) > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Space>
            </Card>
          ))}
        </Space>

        <Card title="借款记录" style={{ marginTop: 16 }}>
          <Table
            columns={borrowingColumns}
            dataSource={detail.borrowings}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        </Card>

        <Card title="还款记录" style={{ marginTop: 16 }}>
          <Table
            columns={repaymentColumns}
            dataSource={detail.repayments}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        </Card>
      </Card>
    )
  }

  return (
    <Card>
      <Card title="借款报表" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {Object.values(currencyStats).map((stat) => (
            <Card key={stat.currency} title={`${stat.currency} 币种汇总`} size="small">
              <Space size="large">
                <Statistic
                  title="借款人数"
                  value={stat.count}
                  suffix="人"
                />
                <Statistic
                  title="借款总额"
                  value={stat.total_borrowed / 100}
                  precision={2}
                  suffix={stat.currency}
                />
                <Statistic
                  title="还款总额"
                  value={stat.total_repaid / 100}
                  precision={2}
                  suffix={stat.currency}
                />
                <Statistic
                  title="总余额"
                  value={stat.balance / 100}
                  precision={2}
                  suffix={stat.currency}
                  valueStyle={{ color: stat.balance > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Space>
            </Card>
          ))}
        </Space>
      </Card>

      <Card title="个人借款汇总">
        <Table
          columns={summaryColumns}
          dataSource={summaries}
          rowKey={(record) => `${record.user_id}-${record.currency}`}
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </Card>
  )
}

