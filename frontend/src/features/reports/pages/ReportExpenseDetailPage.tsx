import React, { useState } from 'react'
import { Card, Button, Space, Select } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { DataTable, AmountDisplay, PageToolbar } from '../../../components/common'
import { useExpenseDetail, useExpenseCategories } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { SelectOption } from '../../../types/business'
import type { ExpenseDetailResponse } from '../../../hooks/business/useReports'
import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseDetail() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  const { data, isLoading, refetch } = useExpenseDetail({ start, end, categoryId: selectedCategoryId })
  const { data: categoriesData = [] } = useExpenseCategories()
  // 确保 categories 始终是数组
  const categories = React.useMemo(() => {
    if (!Array.isArray(categoriesData)) return []
    return categoriesData.map((c: SelectOption) => ({ 
      value: c.value, 
      label: c.label 
    }))
  }, [categoriesData])

  const rows: ExpenseDetailResponse['rows'] = data?.rows || []

  const handleQuery = withErrorHandler(
    async () => {
      await refetch()
    },
    {
      errorMessage: '日常支出明细失败',
    }
  )

  return (
    <PageContainer
      title="日常支出明细"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出明细' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            {
              label: '查询',
              type: 'primary',
              onClick: handleQuery
            }
          ]}
          wrap
        >
          <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
          <Select
            style={{ width: 200 }}
            placeholder="筛选类别"
            allowClear
            options={categories}
            value={selectedCategoryId}
            onChange={(v) => setSelectedCategoryId(v)}
          />
        </PageToolbar>
        <DataTable<ExpenseDetailResponse['rows'][number]>
          columns={[
            { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo' },
            { title: '日期', dataIndex: 'expenseDate', key: 'expenseDate' },
            { title: '类别', dataIndex: 'categoryName', key: 'categoryName' },
            { title: '账户', dataIndex: 'accountName', key: 'accountName' },
            { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} /> },
            { title: '对方', dataIndex: 'counterparty', key: 'counterparty' },
            { title: '项目', dataIndex: 'departmentName', key: 'departmentName' },
            { title: '站点', dataIndex: 'siteName', key: 'siteName' },
            { title: '备注', dataIndex: 'description', key: 'description' },
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

