import { useState } from 'react'
import { Card } from 'antd'
import dayjs from 'dayjs'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { DataTable, AmountDisplay } from '../../../components/common'
import { useDepartmentCash } from '../../../hooks'
import { PageContainer } from '../../../components/PageContainer'

export function ReportDepartmentCash() {
  const [searchParams, setSearchParams] = useState<{ start: string; end: string }>({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  })

  const { data, isLoading, refetch } = useDepartmentCash(searchParams)
  const rows = data?.rows || []

  const handleSearch = (values: Record<string, string | number | string[] | undefined>) => {
    const start = (values.dateRangeStart as string) || dayjs().startOf('month').format('YYYY-MM-DD')
    const end = (values.dateRangeEnd as string) || dayjs().format('YYYY-MM-DD')
    setSearchParams({ start, end })
  }

  return (
    <PageContainer
      title="项目汇总报表"
      breadcrumb={[{ title: '报表中心' }, { title: '项目汇总报表' }]}
    >
      <Card bordered={false} className="page-card">
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

