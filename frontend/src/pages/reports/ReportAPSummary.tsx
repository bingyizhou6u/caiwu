import { useState } from 'react'
import { Card, Button, Table, Space, Statistic, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../config/api'
import { apiRequest } from '../../utils/api'
import { DateRangePicker } from '../../components/DateRangePicker'

export function ReportAPSummary() {
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const { data } = await apiRequest(`${api.reports.apSummary}?start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
      setStats({ total: j.total_cents, settled: j.settled_cents, byStatus: j.by_status })
    } catch (error: any) {
      message.error(error.message || '应付账款汇总失败')
    }
  }

  return (
    <Card title="应付账款汇总">
      <Space style={{ marginBottom: 12 }} wrap>
        <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Statistic title="期间总额" value={((stats.total||0)/100).toFixed(2)} />
        <Statistic title="期间已结" value={((stats.settled||0)/100).toFixed(2)} />
        {stats.byStatus && Object.entries(stats.byStatus).map(([status, cents]: [string, any]) => (
          <Statistic key={status} title={`${status}状态`} value={((cents||0)/100).toFixed(2)} />
        ))}
      </Space>
      <Table 
        rowKey="id" 
        dataSource={rows} 
        columns={[
          { title: '单号', dataIndex: 'doc_no' },
          { title: '开立', dataIndex: 'issue_date' },
          { title: '到期', dataIndex: 'due_date' },
          { title: '供应商', dataIndex: 'party_id' },
          { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
          { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
          { title: '状态', dataIndex: 'status' },
        ]} 
      />
    </Card>
  )
}

