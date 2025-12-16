import { useState } from 'react'
import { Card, Button, Space } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay } from '../../../components/common'
import { useARDetail } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'

import { PageContainer } from '../../../components/PageContainer'

export function ReportARDetail() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useARDetail({ start, end })
  const rows = data?.rows || []

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '应收账款明细失败',
    }
  )

  return (
    <PageContainer
      title="应收账款明细"
      breadcrumb={[{ title: '报表中心' }, { title: '应收账款明细' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={handleQuery}>查询</Button>
        </Space>
        <DataTable<any>
          columns={[
            { title: '单号', dataIndex: 'docNo', key: 'docNo' },
            { title: '开立日期', dataIndex: 'issueDate', key: 'issueDate' },
            { title: '到期日', dataIndex: 'dueDate', key: 'dueDate' },
            { title: '客户', dataIndex: 'partyId', key: 'partyId' },
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

