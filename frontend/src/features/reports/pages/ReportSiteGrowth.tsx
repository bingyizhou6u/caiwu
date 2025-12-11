import { useState } from 'react'
import { Card, Button, Table, Space, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportSiteGrowth() {
  const [rows, setRows] = useState<any[]>([])
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const data = await apiClient.get<any>(`${api.reports.siteGrowth}?start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
    } catch (error: any) {
      message.error(error.message || '站点增长失败')
    }
  }

  return (
    <PageContainer
      title="站点增长报表"
      breadcrumb={[{ title: '报表中心' }, { title: '站点增长报表' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="siteId"
          dataSource={rows}
          columns={[
            { title: '站点', dataIndex: 'siteName' },
            { title: '收入', dataIndex: 'incomeCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '支出', dataIndex: 'expenseCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '净额', dataIndex: 'netCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '对比期收入', dataIndex: 'prevIncomeCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '增长率', dataIndex: 'growthRate', render: (v: number) => (v * 100).toFixed(1) + '%' },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

