import { useState } from 'react'
import { Card, Space, Button, Breadcrumb, Statistic, Tag } from 'antd'
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useBorrowingSummary, useBorrowingDetail } from '../../../hooks'
import { DataTable, type DataTableColumn, EmptyText, AmountDisplay } from '../../../components/common'

type ViewLevel = 'summary' | 'detail'
type BorrowerSummary = {
  userId: string
  borrowerName: string
  borrowerEmail?: string
  currency: string
  totalBorrowedCents: number
  totalRepaidCents: number
  balanceCents: number
}
type BorrowingRecord = {
  id: string
  userId: string
  amountCents: number
  currency: string
  memo?: string
  accountName?: string
  accountCurrency?: string
  creatorName?: string
  borrowDate: string
}
type RepaymentRecord = {
  id: string
  borrowingId: string
  userId: string
  amountCents: number
  currency: string
  repayDate: string
  memo?: string
  accountName?: string
  accountCurrency?: string
  creatorName?: string
  borrowDate?: string
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

import { PageContainer } from '../../../components/PageContainer'

export function ReportBorrowing() {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('summary')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUserName, setSelectedUserName] = useState<string>('')

  const { data: summaryData, isLoading: summaryLoading } = useBorrowingSummary()
  const { data: detailData, isLoading: detailLoading } = useBorrowingDetail(selectedUserId)

  const summaries = summaryData?.results || []
  const detail = detailData || null
  const loading = summaryLoading || detailLoading

  const loadBorrowersSummary = () => {
    setViewLevel('summary')
    setSelectedUserId('')
    setSelectedUserName('')
  }

  const loadDetail = (userId: string, userName: string) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setViewLevel('detail')
  }

  // 汇总表格列
  const summaryColumns: DataTableColumn<BorrowerSummary>[] = [
    {
      title: '姓名',
      dataIndex: 'borrowerName',
      key: 'borrowerName',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'borrowerEmail',
      key: 'borrowerEmail',
      width: 180,
      render: (v: string) => <EmptyText value={v} />,
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 80,
    },
    {
      title: '借款总额',
      dataIndex: 'totalBorrowedCents',
      key: 'totalBorrowedCents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => <AmountDisplay cents={cents} currency={record.currency} />,
    },
    {
      title: '还款总额',
      dataIndex: 'totalRepaidCents',
      key: 'totalRepaidCents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => <AmountDisplay cents={cents} currency={record.currency} />,
    },
    {
      title: '余额',
      dataIndex: 'balanceCents',
      key: 'balanceCents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowerSummary) => (
        <AmountDisplay
          cents={cents}
          currency={record.currency}
          style={{ color: cents > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: BorrowerSummary) => (
        <Button type="link" size="small" onClick={() => loadDetail(record.userId, record.borrowerName)}>
          查看明细
        </Button>
      ),
    },
  ]

  // 借款明细表格列
  const borrowingColumns: DataTableColumn<BorrowingRecord>[] = [
    {
      title: '借款日期',
      dataIndex: 'borrowDate',
      key: 'borrowDate',
      width: 120,
    },
    {
      title: '借款金额',
      dataIndex: 'amountCents',
      key: 'amountCents',
      width: 150,
      align: 'right',
      render: (cents: number, record: BorrowingRecord) => <AmountDisplay cents={cents} currency={record.currency} />,
    },
    {
      title: '账户',
      dataIndex: 'accountName',
      key: 'accountName',
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
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: 100,
    },
  ]

  // 还款明细表格列
  const repaymentColumns: DataTableColumn<RepaymentRecord>[] = [
    {
      title: '还款日期',
      dataIndex: 'repayDate',
      key: 'repayDate',
      width: 120,
    },
    {
      title: '还款金额',
      dataIndex: 'amountCents',
      key: 'amountCents',
      width: 150,
      align: 'right',
      render: (cents: number, record: RepaymentRecord) => <AmountDisplay cents={cents} currency={record.currency} />,
    },
    {
      title: '对应借款日期',
      dataIndex: 'borrowDate',
      key: 'borrowDate',
      width: 120,
    },
    {
      title: '账户',
      dataIndex: 'accountName',
      key: 'accountName',
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
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: 100,
    },
  ]

  // 按币种汇总统计
  const currencyStats = summaries.reduce((acc: Record<string, { currency: string; total_borrowed: number; total_repaid: number; balance: number; count: number }>, item: BorrowerSummary) => {
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
    acc[curr].total_borrowed += item.totalBorrowedCents
    acc[curr].total_repaid += item.totalRepaidCents
    acc[curr].balance += item.balanceCents
    acc[curr].count += 1
    return acc
  }, {} as Record<string, { currency: string; total_borrowed: number; total_repaid: number; balance: number; count: number }>)

  if (viewLevel === 'detail' && detail) {
    // 计算该借款人的汇总统计
    const borrowerCurrencyStats = detail.borrowings.reduce((acc: Record<string, { currency: string; borrowed: number; repaid: number }>, b: BorrowingRecord) => {
      const curr = b.currency
      if (!acc[curr]) {
        acc[curr] = {
          currency: curr,
          borrowed: 0,
          repaid: 0,
        }
      }
      acc[curr].borrowed += b.amountCents
      return acc
    }, {} as Record<string, { currency: string; borrowed: number; repaid: number }>)

    detail.repayments.forEach((r: RepaymentRecord) => {
      const curr = r.currency
      if (!borrowerCurrencyStats[curr]) {
        borrowerCurrencyStats[curr] = {
          currency: curr,
          borrowed: 0,
          repaid: 0,
        }
      }
      borrowerCurrencyStats[curr].repaid += r.amountCents
    })

    return (
      <PageContainer
        title={`${selectedUserName} - 借款明细`}
        breadcrumb={[
          { title: '报表中心' },
          {
            title: '借款报表', onClick: () => {
              loadBorrowersSummary()
            }
          },
          { title: '借款明细' }
        ]}
      >
        <Card bordered className="page-card page-card-outer">
          <Card size="small" style={{ marginBottom: 16 }} bordered={false} className="page-card-inner">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div><strong>借款人：</strong>{detail.user.name}</div>
              {detail.user.email && <div><strong>邮箱：</strong>{detail.user.email}</div>}
            </Space>
          </Card>

          <Space direction="vertical" size="large" style={{ width: '100%', marginBottom: 16 }}>
            {(Object.values(borrowerCurrencyStats) as { currency: string; borrowed: number; repaid: number }[]).map((stat) => (
              <Card key={stat.currency} title={`${stat.currency} 币种统计`} size="small" bordered={false} className="page-card-inner">
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

          <Card title="借款记录" style={{ marginBottom: 16 }} bordered={false} className="page-card-inner">
            <DataTable<BorrowingRecord>
              columns={borrowingColumns}
              data={detail.borrowings}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              tableProps={{ size: 'small' }}
            />
          </Card>

          <Card title="还款记录" bordered={false} className="page-card-inner">
            <DataTable<RepaymentRecord>
              columns={repaymentColumns}
              data={detail.repayments}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              tableProps={{ size: 'small' }}
            />
          </Card>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="借款统计报表"
      breadcrumb={[{ title: '报表中心' }, { title: '借款统计报表' }]}
    >
      <Card bordered className="page-card page-card-outer">
        <Card title="借款概览" style={{ marginBottom: 16 }} bordered={false} className="page-card-inner">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {(Object.values(currencyStats) as { currency: string; total_borrowed: number; total_repaid: number; balance: number; count: number }[]).map((stat) => (
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

        <Card title="个人借款汇总" bordered={false} className="page-card-inner">
          <DataTable<BorrowerSummary>
            columns={summaryColumns}
            data={summaries}
            rowKey={(record) => `${record.userId}-${record.currency}`}
            loading={loading}
            pagination={{ pageSize: 20 }}
            tableProps={{ scroll: { x: 800 } }}
          />
        </Card>
      </Card>
    </PageContainer>
  )
}

