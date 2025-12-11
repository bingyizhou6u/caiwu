import { useState } from 'react'
import { Card, Button, Table, Space, Statistic, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportARSummary() {
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const data = await apiClient.get<any>(`${api.reports.arSummary}?kind=AR&start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
      setStats({ total: j.totalCents, settled: j.settledCents, byStatus: j.byStatus })
    } catch (error: any) {
      message.error(error.message || '应收账款汇总失败')
    }
  }

  return (
    <PageContainer
      title="应收账款汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '应收账款汇总' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Space style={{ marginBottom: 12 }}>
          <Statistic title="期间总额" value={((stats.total || 0) / 100).toFixed(2)} />
          <Statistic title="期间已结" value={((stats.settled || 0) / 100).toFixed(2)} />
          {stats.byStatus && Object.entries(stats.byStatus).map(([status, cents]: [string, any]) => (
            <Statistic key={status} title={`${status}状态`} value={((cents || 0) / 100).toFixed(2)} />
          ))}
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: '单号', dataIndex: 'docNo' },
            { title: '开立', dataIndex: 'issueDate' },
            { title: '到期', dataIndex: 'dueDate' },
            { title: '客户', dataIndex: 'partyId' },
            { title: '金额', dataIndex: 'amountCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '已结', dataIndex: 'settledCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '状态', dataIndex: 'status' },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

