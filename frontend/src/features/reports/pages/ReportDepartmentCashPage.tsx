import { useState } from 'react'
import { Card, Button, Space } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay, PageToolbar } from '../../../components/common'
import { useDepartmentCash } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'

export function ReportDepartmentCash() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useDepartmentCash({ start, end })
  const rows = data?.rows || []

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '项目汇总失败',
    }
  )

  return (
    <PageContainer
      title="项目汇总报表"
      breadcrumb={[{ title: '报表中心' }, { title: '项目汇总报表' }]}
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
        <DataTable<any>
          columns={[
            { title: '项目', dataIndex: 'departmentName', key: 'departmentName' },
            { title: '收入', dataIndex: 'incomeCents', key: 'incomeCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '支出', dataIndex: 'expenseCents', key: 'expenseCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '净额', dataIndex: 'netCents', key: 'netCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
          ]}
          data={rows}
          loading={isLoading}
          rowKey="departmentId"
          tableProps={{ className: 'table-striped' }}
        />
      </Card>
    </PageContainer>
  )
}

