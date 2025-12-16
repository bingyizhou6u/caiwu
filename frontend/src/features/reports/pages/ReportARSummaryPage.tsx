import { useState } from 'react'
import { Card, Button, Space, Statistic } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay, PageToolbar, EmptyText } from '../../../components/common'
import { useARSummary } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'

export function ReportARSummary() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useARSummary({ start, end, kind: 'AR' })
  
  const rows = data?.rows || []
  const stats = data ? {
    total: data.totalCents,
    settled: data.settledCents,
    byStatus: data.byStatus,
  } : { total: 0, settled: 0, byStatus: {} }

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '应收账款汇总失败',
    }
  )

  return (
    <PageContainer
      title="应收账款汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '应收账款汇总' }]}
    >
      <Card bordered className="page-card page-card-outer">
        <Card bordered={false} className="page-card-inner" style={{ marginBottom: 16 }}>
          <PageToolbar
            actions={[
              {
                label: '查询',
                type: 'primary',
                onClick: handleQuery
              }
            ]}
            wrap
          >
            <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          </PageToolbar>
          <Space style={{ marginTop: 12 }}>
            <Statistic title="期间总额" value={<AmountDisplay cents={stats.total || 0} currency="CNY" showSymbol={false} />} />
            <Statistic title="期间已结" value={<AmountDisplay cents={stats.settled || 0} currency="CNY" showSymbol={false} />} />
            {stats.byStatus && Object.entries(stats.byStatus).map(([status, cents]: [string, any]) => (
              <Statistic key={status} title={`${status}状态`} value={<AmountDisplay cents={cents || 0} currency="CNY" showSymbol={false} />} />
            ))}
          </Space>
        </Card>
        <Card bordered={false} className="page-card-inner">
          <DataTable<any>
            columns={[
              { title: '单号', dataIndex: 'docNo', key: 'docNo' },
              { title: '开立', dataIndex: 'issueDate', key: 'issueDate' },
              { title: '到期', dataIndex: 'dueDate', key: 'dueDate' },
              { title: '客户', dataIndex: 'partyId', key: 'partyId' },
              { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} /> },
              { title: '已结', dataIndex: 'settledCents', key: 'settledCents', render: (v: number) => <AmountDisplay cents={v} /> },
              { title: '状态', dataIndex: 'status', key: 'status' },
            ]}
            data={rows}
            loading={isLoading}
            rowKey="id"
            tableProps={{ className: 'table-striped' }}
          />
        </Card>
      </Card>
    </PageContainer>
  )
}

