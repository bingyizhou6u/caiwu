import { useState, useMemo } from 'react'
import { Card, Button, Form, Input, Space, message, Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useBorrowings, useRepayments, useCreateRepayment } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createRepaymentSchema } from '../../../validations/repayment.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { FormModal } from '../../../components/FormModal'
import type { Repayment, Borrowing } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'

export function RepaymentManagement() {
  const [open, setOpen] = useState(false)
  const [searchParams, setSearchParams] = useState<{ borrower?: string; currency?: string }>({})

  const { form, validateWithZod } = useZodForm(createRepaymentSchema)

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('finance', 'borrowing', 'create')

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: borrowingsData = { total: 0, list: [] } } = useBorrowings(1, 100) // 获取借款用于下拉选择（最多100条）
  const { data: repayments = [], isLoading: loading, refetch } = useRepayments()
  const { mutateAsync: createRepayment, isPending: isCreating } = useCreateRepayment()

  // 借款选项
  const borrowingOptions = (borrowingsData.list || []).map((b: Borrowing) => ({
    value: b.id,
    label: `${b.borrowerName || b.borrowerEmail || '-'} - ${(b.amountCents / 100).toFixed(2)} ${b.currency} (${b.borrowDate})`,
    currency: b.currency
  }))

  // 处理函数
  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateWithZod()
      await createRepayment({
        ...values,
        repay_date: values.repay_date.format('YYYY-MM-DD')
      })
      setOpen(false)
      form.resetFields()
      refetch()
    },
    { successMessage: '创建成功' }
  )

  return (
    <PageContainer
      title="还款管理"
      breadcrumb={[{ title: '财务管理' }, { title: '还款管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'borrower', label: '借款人', type: 'input', placeholder: '请输入借款人姓名或邮箱' },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              placeholder: '请选择币种',
              options: [
                { label: '全部', value: '' },
                { value: 'CNY', label: 'CNY - 人民币' },
                { value: 'USD', label: 'USD - 美元' },
                { value: 'EUR', label: 'EUR - 欧元' },
                { value: 'USDT', label: 'USDT - 泰达币' },
              ],
            },
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <Space style={{ marginBottom: 12, marginTop: 16 }}>
          {canEdit && (
            <Button type="primary" onClick={() => {
              form.resetFields()
              form.setFieldsValue({ repay_date: dayjs() })
              setOpen(true)
            }}>新建还款</Button>
          )}
          <Button onClick={() => refetch()}>刷新</Button>
        </Space>

        {(() => {
          // 过滤数据
          const filteredRepayments = useMemo(() => {
            return repayments.filter((r: Repayment) => {
              if (searchParams.borrower) {
                const search = searchParams.borrower.toLowerCase()
                if (!r.borrowerName?.toLowerCase().includes(search) && !r.borrowerEmail?.toLowerCase().includes(search)) {
                  return false
                }
              }
              if (searchParams.currency && r.currency !== searchParams.currency) {
                return false
              }
              return true
            })
          }, [repayments, searchParams])

          const columns: DataTableColumn<Repayment>[] = [
            { title: '借款人', key: 'borrower', render: (_: unknown, r: Repayment) => r.borrowerName || r.borrowerEmail || '-' },
            { title: '邮箱', dataIndex: 'borrower_email', key: 'borrower_email', render: (v: string) => v || '-' },
            { title: '资金账户', dataIndex: 'accountName', key: 'accountName' },
            {
              title: '还款金额',
              key: 'amount',
              render: (_: unknown, r: Repayment) => `${(r.amountCents / 100).toFixed(2)} ${r.currency}`
            },
            { title: '还款日期', dataIndex: 'repay_date', key: 'repay_date' },
            { title: '备注', dataIndex: 'memo', key: 'memo', render: (v: string) => v || '-' },
            { title: '创建人', dataIndex: 'creator_name', key: 'creator_name' },
          ]

          return (
            <DataTable<Repayment>
              columns={columns}
              data={filteredRepayments}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              tableProps={{ className: 'table-striped' }}
            />
          )
        })()}

        <FormModal
          title="新建还款"
          open={open}
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => {
            setOpen(false)
            form.resetFields()
          }}
          loading={isCreating}
        >
          <Form.Item name="borrowing_id" label="借款记录" rules={[{ required: true, message: '请选择借款记录' }]}>
            <Select
              showSearch
              placeholder="请选择借款记录"
              optionFilterProp="label"
              options={borrowingOptions}
              style={{ width: '100%' }}
              onChange={(value) => {
                const borrowing = borrowingOptions.find((b: any) => b.value === value)
                if (borrowing) {
                  form.setFieldsValue({ currency: borrowing.currency, accountId: undefined })
                }
              }}
            />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select
              placeholder="请选择币种"
              options={[
                { value: 'CNY', label: 'CNY - 人民币' },
                { value: 'USD', label: 'USD - 美元' },
                { value: 'EUR', label: 'EUR - 欧元' },
                { value: 'USDT', label: 'USDT - 泰达币' },
              ]}
              style={{ width: '100%' }}
              onChange={(value) => {
                form.setFieldsValue({ accountId: undefined })
              }}
            />
          </Form.Item>
          <Form.Item name="accountId" label="资金账户" rules={[{ required: true, message: '请选择资金账户' }]}
            dependencies={['currency']}>
            <Select
              showSearch
              placeholder="请选择资金账户"
              optionFilterProp="label"
              options={accounts
                .filter((a: any) => {
                  const currency = form.getFieldValue('currency')
                  return !currency || a.currency === currency
                })
                .map((a: any) => ({ value: a.value, label: a.label }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="amount" label="还款金额" rules={[{ required: true, message: '请输入还款金额' }]}>
            <Input type="number" step="0.01" placeholder="请输入还款金额" />
          </Form.Item>
          <Form.Item name="repay_date" label="还款日期" rules={[{ required: true, message: '请选择还款日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
