import React, { useState, useMemo } from 'react'
import { Card } from 'antd'
import dayjs from 'dayjs'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { DataTable, AmountDisplay } from '../../../components/common'
import { useExpenseDetail, useExpenseCategories } from '../../../hooks'
import type { SelectOption } from '../../../types/business'
import type { ExpenseDetailResponse } from '../../../hooks/business/useReports'
import { PageContainer } from '../../../components/PageContainer'

export function ReportExpenseDetail() {
  const [searchParams, setSearchParams] = useState<{ start: string; end: string; categoryId?: string }>({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  })

  const { data, isLoading } = useExpenseDetail(searchParams)
  const { data: categoriesData = [] } = useExpenseCategories()
  
  // 确保 categories 始终是数组
  const categories = useMemo(() => {
    if (!Array.isArray(categoriesData)) return []
    return categoriesData.map((c: SelectOption) => ({ 
      value: c.value, 
      label: c.label 
    }))
  }, [categoriesData])

  const rows: ExpenseDetailResponse['rows'] = data?.rows || []

  const handleSearch = (values: Record<string, string | number | string[] | undefined>) => {
    const start = (values.dateRangeStart as string) || dayjs().startOf('month').format('YYYY-MM-DD')
    const end = (values.dateRangeEnd as string) || dayjs().format('YYYY-MM-DD')
    const categoryId = values.categoryId as string | undefined
    setSearchParams({ start, end, categoryId })
  }

  return (
    <PageContainer
      title="日常支出明细"
      breadcrumb={[{ title: '报表中心' }, { title: '日常支出明细' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            {
              name: 'dateRange',
              label: '日期范围',
              type: 'dateRange',
              showQuickSelect: true,
            },
            {
              name: 'categoryId',
              label: '类别',
              type: 'select',
              options: categories,
              allowClear: true,
            },
          ]}
          onSearch={handleSearch}
          initialValues={{
            dateRange: [dayjs().startOf('month'), dayjs()],
          }}
        />
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

