import { useState } from 'react'
import { Card, Button, Space } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay, PageToolbar } from '../../../components/common'
import { useSiteGrowth } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { SiteGrowthResponse } from '../../../hooks/business/useReports'
import { PageContainer } from '../../../components/PageContainer'

export function ReportSiteGrowth() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useSiteGrowth({ start, end })
  const rows: SiteGrowthResponse['rows'] = data?.rows || []

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '站点增长失败',
    }
  )

  return (
    <PageContainer
      title="站点增长报表"
      breadcrumb={[{ title: '报表中心' }, { title: '站点增长报表' }]}
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
        <DataTable<SiteGrowthResponse['rows'][number]>
          columns={[
            { title: '站点', dataIndex: 'siteName', key: 'siteName' },
            { title: '收入', dataIndex: 'incomeCents', key: 'incomeCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '支出', dataIndex: 'expenseCents', key: 'expenseCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '净额', dataIndex: 'netCents', key: 'netCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '对比期收入', dataIndex: 'prevIncomeCents', key: 'prevIncomeCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '增长率', dataIndex: 'growthRate', key: 'growthRate', render: (v: number) => (v * 100).toFixed(1) + '%' },
          ]}
          data={rows}
          loading={isLoading}
          rowKey="siteId"
          tableProps={{ className: 'table-striped' }}
        />
      </Card>
    </PageContainer>
  )
}

