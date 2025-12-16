import { useState } from 'react'
import { Card } from 'antd'
import dayjs from 'dayjs'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { DataTable, AmountDisplay } from '../../../components/common'
import { useAPDetail } from '../../../hooks'
import { PageContainer } from '../../../components/PageContainer'

export function ReportAPDetail() {
  const [searchParams, setSearchParams] = useState<{ start: string; end: string }>({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  })

  const { data, isLoading, refetch } = useAPDetail(searchParams)
  const rows = data?.rows || []

  const handleSearch = (values: Record<string, string | number | string[] | undefined>) => {
    const start = (values.dateRangeStart as string) || dayjs().startOf('month').format('YYYY-MM-DD')
    const end = (values.dateRangeEnd as string) || dayjs().format('YYYY-MM-DD')
    setSearchParams({ start, end })
  }

  return (
    <PageContainer
      title="应付账款明细"
      breadcrumb={[{ title: '报表中心' }, { title: '应付账款明细' }]}
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
            { title: '单号', dataIndex: 'docNo', key: 'docNo' },
            { title: '开立日期', dataIndex: 'issueDate', key: 'issueDate' },
            { title: '到期日', dataIndex: 'dueDate', key: 'dueDate' },
            { title: '供应商', dataIndex: 'partyId', key: 'partyId' },
            { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} /> },
            { title: '已结', dataIndex: 'settledCents', key: 'settledCents', render: (v: number) => <AmountDisplay cents={v} /> },
            { title: '未结', dataIndex: 'remainingCents', key: 'remainingCents', render: (v: number) => <AmountDisplay cents={v} /> },
            { title: '状态', dataIndex: 'status', key: 'status' },
            { title: '备注', dataIndex: 'memo', key: 'memo' },
          ]}
          data={rows}
          loading={isLoading}
          rowKey="id"
          tableProps={{ className: 'table-striped' }}
        />
      </Card>
    </PageContainer>
  )
}

