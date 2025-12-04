import { useState, useEffect } from 'react'
import { Card, Button, Table, Space, Select, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { loadExpenseCategories } from '../../../utils/loaders'
import { DateRangePicker } from '../../../components/DateRangePicker'

import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseDetail() {
  const [rows, setRows] = useState<any[]>([])
  const [categories, setCategories] = useState<{ value: string, label: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const loadCategories = async () => {
    try {
      const categoriesData = await loadExpenseCategories()
      setCategories(categoriesData.map(c => ({ value: c.value as string, label: c.label })))
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const load = async () => {
    try {
      const url = `${api.reports.expenseDetail}?start=${start}&end=${end}${selectedCategoryId ? `&category_id=${selectedCategoryId}` : ''}`
      const data = await apiClient.get<any>(url)
      const j = data as any
      setRows(j.rows ?? [])
    } catch (error: any) {
      message.error(error.message || '日常支出明细失败')
    }
  }

  return (
    <PageContainer
      title="日常支出明细"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出明细' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Select
            style={{ width: 200 }}
            placeholder="筛选类别"
            allowClear
            options={categories}
            value={selectedCategoryId}
            onChange={(v) => setSelectedCategoryId(v)}
          />
          <Button type="primary" onClick={load}>查询</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: '凭证号', dataIndex: 'voucher_no' },
            { title: '日期', dataIndex: 'biz_date' },
            { title: '类别', dataIndex: 'category_name' },
            { title: '账户', dataIndex: 'account_name' },
            { title: '金额', dataIndex: 'amount_cents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '对方', dataIndex: 'counterparty' },
            { title: '项目', dataIndex: 'department_name' },
            { title: '站点', dataIndex: 'site_name' },
            { title: '备注', dataIndex: 'memo' },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

