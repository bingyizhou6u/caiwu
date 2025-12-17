import { useState, useMemo } from 'react'
import { Card, Space, Statistic } from 'antd'
import dayjs from 'dayjs'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { DataTable, AmountDisplay } from '../../../components/common'
import { useExpenseSummary } from '../../../hooks'
import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseSummary() {
  const [searchParams, setSearchParams] = useState<{ start: string; end: string }>({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  })

  const { data, isLoading } = useExpenseSummary(searchParams)
  
  const rows = data?.rows || []
  const stats = useMemo(() => {
    const total = rows.reduce((acc: number, r) => acc + (r.totalCents || 0), 0)
    return { total }
  }, [rows])

  const handleSearch = (values: Record<string, string | number | string[] | undefined>) => {
    const start = (values.dateRangeStart as string) || dayjs().startOf('month').format('YYYY-MM-DD')
    const end = (values.dateRangeEnd as string) || dayjs().format('YYYY-MM-DD')
    setSearchParams({ start, end })
  }

  return (
    <PageContainer
      title="日常支出汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出汇总' }]}
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
            dateRangeStart: dayjs().startOf('month').format('YYYY-MM-DD'),
            dateRangeEnd: dayjs().format('YYYY-MM-DD'),
          }}
        />
        <Card bordered={false} className="page-card-inner" style={{ marginTop: 16, marginBottom: 16 }}>
          <Space style={{ marginTop: 12 }}>
            <Statistic title="支出总额" value={<AmountDisplay cents={stats.total || 0} currency="CNY" showSymbol={false} />} />
          </Space>
        </Card>
        <Card bordered={false} className="page-card-inner">
          <DataTable<{ categoryId: string; categoryName: string; totalCents: number; count: number }>
            columns={[
              { title: '类别', dataIndex: 'categoryName', key: 'categoryName' },
              { title: '金额', dataIndex: 'totalCents', key: 'totalCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
              { title: '笔数', dataIndex: 'count', key: 'count' },
            ]}
            data={rows}
            loading={isLoading}
            rowKey="categoryId"
            tableProps={{ className: 'table-striped' }}
          />
        </Card>
      </Card>
    </PageContainer>
  )
}

