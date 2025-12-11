import { useState } from 'react'
import { Card, Button, Table, Space, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportARDetail() {
  const [rows, setRows] = useState<any[]>([])
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const data = await apiClient.get<any>(`${api.reports.arDetail}?start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
    } catch (error: any) {
      message.error(error.message || '应收账款明细失败')
    }
  }

  return (
    <PageContainer
      title="应收账款明细"
      breadcrumb={[{ title: '报表中心' }, { title: '应收账款明细' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: '单号', dataIndex: 'docNo' },
            { title: '开立日期', dataIndex: 'issueDate' },
            { title: '到期日', dataIndex: 'dueDate' },
            { title: '客户', dataIndex: 'partyId' },
            { title: '金额', dataIndex: 'amountCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '已结', dataIndex: 'settledCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '未结', dataIndex: 'remainingCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '状态', dataIndex: 'status' },
            { title: '备注', dataIndex: 'memo' },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

