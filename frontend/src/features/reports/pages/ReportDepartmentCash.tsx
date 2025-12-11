import { useState } from 'react'
import { Card, Button, Table, Space, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportDepartmentCash() {
  const [rows, setRows] = useState<any[]>([])
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const load = async () => {
    try {
      const data = await apiClient.get<any>(`${api.reports.departmentCash}?start=${start}&end=${end}`)
      const j = data as any
      setRows(j.rows ?? [])
    } catch (error: any) {
      message.error(error.message || '项目汇总失败')
    }
  }

  return (
    <PageContainer
      title="项目汇总报表"
      breadcrumb={[{ title: '报表中心' }, { title: '项目汇总报表' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="departmentId"
          dataSource={rows}
          columns={[
            { title: '项目', dataIndex: 'departmentName' },
            { title: '收入', dataIndex: 'incomeCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '支出', dataIndex: 'expenseCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '净额', dataIndex: 'netCents', render: (v: number) => (v / 100).toFixed(2) },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

