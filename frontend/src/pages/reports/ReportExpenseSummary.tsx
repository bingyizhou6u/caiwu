import { useState } from 'react'
import { Card, Button, Table, Space, Statistic, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../config/api'
import { apiRequest } from '../../utils/api'
import { DateRangePicker } from '../../components/DateRangePicker'

export function ReportExpenseSummary() {
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const { data } = await apiRequest(`${api.reports.expenseSummary}?start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
      setStats({ total: j.total_cents })
    } catch (error: any) {
      message.error(error.message || '日常支出汇总失败')
    }
  }

  return (
    <Card title="日常支出汇总">
      <Space style={{ marginBottom: 12 }} wrap>
        <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Statistic title="支出总额" value={((stats.total||0)/100).toFixed(2)} />
      </Space>
      <Table 
        rowKey="category_id" 
        dataSource={rows} 
        columns={[
          { title: '类别', dataIndex: 'category_name' },
          { title: '金额', dataIndex: 'total_cents', render: (v:number)=> (v/100).toFixed(2) },
          { title: '笔数', dataIndex: 'count' },
        ]} 
      />
    </Card>
  )
}

