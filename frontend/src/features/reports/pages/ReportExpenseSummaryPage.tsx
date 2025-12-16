import { useState, useMemo } from 'react'
import { Card, Button, Space, Statistic } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay, PageToolbar } from '../../../components/common'
import { useExpenseSummary } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseSummary() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useExpenseSummary({ start, end })
  
  const rows = data?.rows || []
  const stats = useMemo(() => {
    const total = rows.reduce((acc: number, r) => acc + (r.totalCents || 0), 0)
    return { total }
  }, [rows])

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '日常支出汇总失败',
    }
  )

  return (
    <PageContainer
      title="日常支出汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出汇总' }]}
    >
      <Card bordered={false} className="page-card">
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
        <Space style={{ marginBottom: 12 }}>
          <Statistic title="支出总额" value={((stats.total || 0) / 100).toFixed(2)} />
        </Space>
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
    </PageContainer>
  )
}

