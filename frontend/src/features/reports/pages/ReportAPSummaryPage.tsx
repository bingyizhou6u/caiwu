import { useState } from 'react'
import { Card, Space, Statistic } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { DataTable, AmountDisplay, EmptyText } from '../../../components/common'
import { useAPSummary } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'

export function ReportAPSummary() {
  const [filters, setFilters] = useState<{ dateRangeStart?: string; dateRangeEnd?: string }>({
    dateRangeStart: dayjs().startOf('month').format('YYYY-MM-DD'),
    dateRangeEnd: dayjs().format('YYYY-MM-DD'),
  })
  
  const { data, isLoading, refetch } = useAPSummary({ 
    start: filters.dateRangeStart || dayjs().startOf('month').format('YYYY-MM-DD'),
    end: filters.dateRangeEnd || dayjs().format('YYYY-MM-DD'),
  })
  
  const rows = data?.rows || []
  const stats = data ? {
    total: data.totalCents,
    settled: data.settledCents,
    byStatus: data.byStatus,
  } : { total: 0, settled: 0, byStatus: {} }

  const handleSearch = (values: Record<string, string | number | string[] | undefined>) => {
    setFilters({
      dateRangeStart: values.dateRangeStart as string,
      dateRangeEnd: values.dateRangeEnd as string,
    })
  }

  return (
    <PageContainer
      title="应付账款汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '应付账款汇总' }]}
    >
      <Card bordered className="page-card page-card-outer">
        <SearchFilters
          fields={[
            {
              name: 'dateRange',
              label: '日期范围',
              type: 'dateRange',
              showQuickSelect: true,
            },
          ]}
          onSearch={handleSearch}
          initialValues={{
            dateRange: [dayjs().startOf('month'), dayjs()],
          }}
        />
        <Card bordered={false} className="page-card-inner" style={{ marginTop: 16, marginBottom: 16 }}>
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
              { title: '供应商', dataIndex: 'partyId', key: 'partyId' },
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

