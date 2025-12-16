import { useState, useMemo } from 'react'
import { Card, Button, Input, Space, Select, DatePicker, Form } from 'antd'
import { EmployeeSelect, CurrencySelect, AccountSelect, AmountInput } from '../../../components/form'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useCurrencies, useAccounts, useEmployees } from '../../../hooks/useBusinessData'
import { useBorrowings, useCreateBorrowing } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createBorrowingSchema } from '../../../validations/borrowing.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import { DataTable, type DataTableColumn, AmountDisplay, EmptyText, PageToolbar } from '../../../components/common'
import { FormModal } from '../../../components/FormModal'
import type { Borrowing } from '../../../types/business'
import { PageContainer } from '../../../components/PageContainer'

export function BorrowingManagement() {
  const [open, setOpen] = useState(false)
  const [searchParams, setSearchParams] = useState<{ borrower?: string; currency?: string }>({})

  const { form, validateWithZod } = useZodForm(createBorrowingSchema)

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('finance', 'borrowing', 'create')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 数据 Hook
  const { data: currencies = [] } = useCurrencies()
  const { data: accounts = [] } = useAccounts()
  const { data: employees = [] } = useEmployees(true)
  const { data: borrowings = { total: 0, list: [] }, isLoading: loading, refetch } = useBorrowings(page, pageSize)
  const { mutateAsync: createBorrowing, isPending: isCreating } = useCreateBorrowing()

  // 筛选用户
  const users = employees
    .filter((e: any) => e.user_active === 1 && e.userId)
    .map((e: any) => ({
      value: e.userId,
      label: `${e.label}${e.email ? ` (${e.email})` : ''}`
    }))

  // 处理函数
  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateWithZod()
      await createBorrowing({
        userId: values.userId,
        accountId: values.accountId,
        amount: values.amount,
        currency: values.currency,
        borrow_date: values.borrow_date.format('YYYY-MM-DD HH:mm:ss'),
        memo: values.memo || null,
      })
      setOpen(false)
      form.resetFields()
      refetch()
    },
    { successMessage: '创建成功' }
  )

  return (
    <PageContainer
      title="借款管理"
      breadcrumb={[{ title: '财务管理' }, { title: '借款管理' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={canEdit ? [
            {
              label: '新建借款',
              type: 'primary',
              onClick: () => {
                form.resetFields()
                form.setFieldsValue({ borrow_date: dayjs() })
                setOpen(true)
              }
            }
          ] : []}
        />
        
        <DataTable<Borrowing>
          columns={useMemo<DataTableColumn<Borrowing>[]>(() => [
            { 
              title: '借款人', 
              dataIndex: 'borrowerName', 
              render: (_: unknown, r: Borrowing) => <EmptyText value={r.borrowerName || r.borrowerEmail} />
            },
            { title: '邮箱', dataIndex: 'borrower_email', render: (v: string) => <EmptyText value={v} /> },
            { title: '资金账户', dataIndex: 'accountName' },
            {
              title: '借款金额',
              render: (_: unknown, r: Borrowing) => <AmountDisplay cents={r.amountCents} currency={r.currency} />
            },
            { title: '借款日期', dataIndex: 'borrow_date' },
            { title: '备注', dataIndex: 'memo', render: (v: string) => <EmptyText value={v} /> },
            { title: '创建人', dataIndex: 'creator_name' },
          ], [])}
          data={borrowings.list}
          loading={loading}
          rowKey="id"
          onRefresh={refetch}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: borrowings.total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          tableProps={{
            className: 'table-striped'
          }}
          showActions={false}
        />

        <FormModal
          title="新建借款"
          open={open}
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => {
            setOpen(false)
            form.resetFields()
          }}
          loading={isCreating}
        >
          <Form.Item name="userId" label="借款人" rules={[{ required: true, message: '请选择借款人' }]}>
            <EmployeeSelect
              placeholder="请选择借款人"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select
              placeholder="请选择币种"
              style={{ width: '100%' }}
              onChange={(value) => {
                form.setFieldsValue({ accountId: undefined })
              }}
            />
          </Form.Item>
          <Form.Item name="accountId" label="资金账户" rules={[{ required: true, message: '请选择资金账户' }]}
            dependencies={['currency']}>
            <AccountSelect
              placeholder="请选择资金账户"
              style={{ width: '100%' }}
              filterByCurrency={form.getFieldValue('currency')}
              showCurrency
            />
          </Form.Item>
          <Form.Item name="amount" label="借款金额" rules={[{ required: true, message: '请输入借款金额' }]}>
            <AmountInput placeholder="请输入借款金额" currency={form.getFieldValue('currency')} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="borrow_date" label="借款日期" rules={[{ required: true, message: '请选择借款日期' }]}>
            <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
