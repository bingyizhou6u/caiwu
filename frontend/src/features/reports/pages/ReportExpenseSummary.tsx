import { useState } from 'react'
import { Card, Button, Table, Space, Statistic, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseSummary() {
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const data = await apiClient.get<any>(`${api.reports.expenseSummary}?start=${start}&end=${end}`)
      const j = data as any
      const rows = j.rows || []
      setRows(rows)
      const total = rows.reduce((acc: number, r: any) => acc + (r.totalCents || 0), 0)
      setStats({ total })
    } catch (error: any) {
      message.error(error.message || '日常支出汇总失败')
    }
  }

  return (
    <PageContainer
      title="日常支出汇总"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出汇总' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Space style={{ marginBottom: 12 }}>
          <Statistic title="支出总额" value={((stats.total || 0) / 100).toFixed(2)} />
        </Space>
        <Table
          className="table-striped"
          rowKey="categoryId"
          dataSource={rows}
          columns={[
            { title: '类别', dataIndex: 'categoryName' },
            { title: '金额', dataIndex: 'totalCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '笔数', dataIndex: 'count' },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

