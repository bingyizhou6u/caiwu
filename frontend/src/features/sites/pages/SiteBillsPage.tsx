import React, { useState } from 'react'
import { Card, Button, Modal, Form, Input, Space, Select, DatePicker, InputNumber, Radio, Popconfirm } from 'antd'
import dayjs from 'dayjs'
import { useCurrencies, useAccounts, useExpenseCategories, useSites } from '../../../hooks/useBusinessData'
import { useSiteBills, useCreateSiteBill, useUpdateSiteBill, useDeleteSiteBill } from '../../../hooks'
import { usePermissions } from '../../../utils/permissions'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { z } from 'zod'

const BILL_TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  paid: '已支付',
  cancelled: '已取消',
}

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, AmountDisplay, EmptyText, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import type { DataTableColumn } from '../../../components/common/DataTable'

const siteBillSchema = z.object({
  siteId: z.string().min(1, '请选择站点'),
  billDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的账单日期'),
  billType: z.enum(['income', 'expense'], { message: '请选择账单类型' }),
  amount: z.number().min(0.01, '金额必须大于0'),
  currency: z.string().min(1, '请选择币种'),
  description: z.string().optional(),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.string().optional(),
  paymentDate: z.any().optional().nullable(),
  memo: z.string().optional().nullable(),
})

export function SiteBills() {
  const [filters, setFilters] = useState({
    siteId: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    billType: undefined as string | undefined,
    status: undefined as string | undefined,
  })

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('site', 'bill', 'create')

  const { data: billsData = [], isLoading: loading } = useSiteBills(filters)
  const { mutateAsync: createBill } = useCreateSiteBill()
  const { mutateAsync: updateBill } = useUpdateSiteBill()
  const { mutateAsync: deleteBill } = useDeleteSiteBill()

  const { form, validateWithZod: validateCreate } = useZodForm(siteBillSchema)
  const { form: editForm, validateWithZod: validateEdit } = useZodForm(siteBillSchema)
  
  const {
    isOpen: open,
    openCreate,
    close: closeCreate,
  } = useFormModal()

  const {
    isOpen: editOpen,
    data: editingBill,
    openEdit,
    close: closeEdit,
  } = useFormModal<any>()

  // Business data hooks
  const { data: currenciesData = [] } = useCurrencies()
  const { data: accountsData = [] } = useAccounts()
  const { data: categoriesData = [] } = useExpenseCategories()
  const { data: sitesData = [] } = useSites()

  // Transform data format
  const currencies = React.useMemo(() => currenciesData.map((r: any) => ({ 
    value: r.value, 
    label: r.label 
  })), [currenciesData])
  const accounts = React.useMemo(() => accountsData.map((a: any) => ({ 
    value: a.value, 
    label: a.label, 
    currency: a.currency 
  })), [accountsData])
  const categories = React.useMemo(() => categoriesData.map((c: any) => ({ 
    value: c.value, 
    label: c.label 
  })), [categoriesData])
  const sites = React.useMemo(() => sitesData.filter((s: any) => s.active === 1), [sitesData])

  const handleSubmit = withErrorHandler(
    async () => {
      const v = await validateCreate()
      await createBill({
        siteId: v.siteId,
        billDate: v.billDate.format('YYYY-MM-DD HH:mm:ss'),
        billType: v.billType,
        amountCents: Math.round(v.amount * 100),
        currency: v.currency,
        description: v.description || null,
        accountId: v.accountId || null,
        categoryId: v.categoryId || null,
        status: v.status || 'pending',
        paymentDate: v.paymentDate ? v.paymentDate.format('YYYY-MM-DD HH:mm:ss') : null,
        memo: v.memo || null,
      })
    },
    {
      successMessage: '创建成功',
      onSuccess: () => {
        closeCreate()
        form.resetFields()
      }
    }
  )

  const handleEdit = withErrorHandler(
    async () => {
      if (!editingBill) return
      const v = await validateEdit()
      await updateBill({
        id: editingBill.id,
        data: {
          siteId: v.siteId,
          billDate: v.billDate.format('YYYY-MM-DD HH:mm:ss'),
          billType: v.billType,
          amountCents: Math.round(v.amount * 100),
          currency: v.currency,
          description: v.description || null,
          accountId: v.accountId || null,
          categoryId: v.categoryId || null,
          status: v.status || 'pending',
          paymentDate: v.paymentDate ? v.paymentDate.format('YYYY-MM-DD HH:mm:ss') : null,
          memo: v.memo || null,
        }
      })
    },
    {
      successMessage: '更新成功',
      onSuccess: () => {
        closeEdit()
        editForm.resetFields()
      }
    }
  )

  const handleDelete = withErrorHandler(
    async (id: string) => {
      await deleteBill(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  )

  const handleEditClick = (record: any) => {
    openEdit(record)
    editForm.setFieldsValue({
      siteId: record.siteId,
      billDate: dayjs(record.billDate),
      billType: record.billType,
      amount: record.amountCents / 100,
      currency: record.currency,
      description: record.description,
      accountId: record.accountId,
      categoryId: record.categoryId,
      status: record.status,
      paymentDate: record.paymentDate ? dayjs(record.paymentDate) : null,
      memo: record.memo,
    })
  }

  return (
    <PageContainer
      title="站点账单管理"
      breadcrumb={[{ title: '站点管理' }, { title: '站点账单' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            {
              name: 'siteId',
              label: '站点',
              type: 'select',
              placeholder: '请选择站点',
              options: [
                { label: '全部', value: '' },
                ...sites.map((s: any) => ({ value: s.id, label: `${s.name}${s.siteCode ? ` (${s.siteCode})` : ''}` })),
              ],
            },
            {
              name: 'dateRange',
              label: '日期范围',
              type: 'dateRange',
              showQuickSelect: true,
            },
            {
              name: 'billType',
              label: '账单类型',
              type: 'select',
              placeholder: '请选择账单类型',
              options: [
                { label: '全部', value: '' },
                { value: 'income', label: '收入' },
                { value: 'expense', label: '支出' },
              ],
            },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '请选择状态',
              options: [
                { label: '全部', value: '' },
                { value: 'pending', label: '待处理' },
                { value: 'paid', label: '已支付' },
                { value: 'cancelled', label: '已取消' },
              ],
            },
          ]}
          onSearch={(values) => {
            setFilters({
              siteId: values.siteId || undefined,
              startDate: values.dateRangeStart || undefined,
              endDate: values.dateRangeEnd || undefined,
              billType: values.billType || undefined,
              status: values.status || undefined,
            })
          }}
          onReset={() => {
            setFilters({
              siteId: undefined,
              startDate: undefined,
              endDate: undefined,
              billType: undefined,
              status: undefined,
            })
          }}
          initialValues={{
            siteId: filters.siteId || '',
            dateRangeStart: filters.startDate,
            dateRangeEnd: filters.endDate,
            billType: filters.billType || '',
            status: filters.status || '',
          }}
        />

        <PageToolbar
          actions={canEdit ? [{
            label: '新建账单',
            type: 'primary',
            onClick: () => {
              form.resetFields()
              form.setFieldsValue({ billDate: dayjs(), billType: 'income', status: 'pending' })
              openCreate()
            }
          }] : []}
          wrap
          style={{ marginTop: 16 }}
        />

        <DataTable<any>
          columns={[
            { title: '账单日期', dataIndex: 'billDate', key: 'billDate', width: 120 },
            { title: '站点', dataIndex: 'siteName', key: 'siteName', width: 150, render: (v: string, r: any) => `${v}${r.siteCode ? ` (${r.siteCode})` : ''}` },
            { title: '类型', dataIndex: 'billType', key: 'billType', width: 80, render: (v: string) => BILL_TYPE_LABELS[v] || v },
            {
              title: '金额',
              key: 'amount',
              width: 150,
              align: 'right',
              render: (_: any, r: any) => <AmountDisplay cents={r.amountCents} currency={r.currency} />
            },
            { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
            { title: '账户', dataIndex: 'accountName', key: 'accountName', width: 120 },
            { title: '类别', dataIndex: 'categoryName', key: 'categoryName', width: 120 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => STATUS_LABELS[v] || v },
            { title: '支付日期', dataIndex: 'paymentDate', key: 'paymentDate', width: 120, render: (v: string) => <EmptyText value={v} /> },
            { title: '备注', dataIndex: 'memo', key: 'memo', ellipsis: true },
            { title: '创建人', dataIndex: 'creator_name', key: 'creator_name', width: 100 },
          ] as DataTableColumn<any>[]}
          data={billsData}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 1400 } }}
          actions={(r: any) => (
            <Space>
              {canEdit && (
                <Button size="small" onClick={() => handleEditClick(r)}>编辑</Button>
              )}
              {canEdit && (
                <Popconfirm
                  title="确定要删除这条账单吗？"
                  onConfirm={() => handleDelete(r.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </Space>
          )}
        />

        {/* 新建账单 */}
        <Modal title="新建站点账单" open={open} onOk={handleSubmit} onCancel={() => {
          closeCreate()
          form.resetFields()
        }} width={800}>
          <Form form={form} layout="vertical">
            <Form.Item name="siteId" label="站点" rules={[{ required: true, message: '请选择站点' }]}>
              <Select
                showSearch
                placeholder="请选择站点"
                optionFilterProp="label"
                options={sites.map((s: any) => ({ value: s.id, label: `${s.name}${s.siteCode ? ` (${s.siteCode})` : ''}` }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="billDate" label="账单日期" rules={[{ required: true, message: '请选择账单日期' }]}>
              <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
            <Form.Item name="billType" label="账单类型" rules={[{ required: true, message: '请选择账单类型' }]}>
              <Radio.Group>
                <Radio value="income">收入</Radio>
                <Radio value="expense">支出</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
              <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入金额" />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
              <Select
                placeholder="请选择币种"
                options={currencies.map((c: any) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="请输入账单描述" />
            </Form.Item>
            <Form.Item name="accountId" label="账户">
              <Select
                showSearch
                placeholder="请选择账户（可选）"
                optionFilterProp="label"
                options={accounts.map((a: any) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                style={{ width: '100%' }}
                allowClear
              />
            </Form.Item>
            <Form.Item name="categoryId" label="类别">
              <Select
                showSearch
                placeholder="请选择类别（可选）"
                optionFilterProp="label"
                options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
                style={{ width: '100%' }}
                allowClear
              />
            </Form.Item>
            <Form.Item name="status" label="状态" initialValue="pending">
              <Select
                options={[
                  { value: 'pending', label: '待处理' },
                  { value: 'paid', label: '已支付' },
                  { value: 'cancelled', label: '已取消' },
                ]}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="paymentDate" label="支付日期">
              <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={2} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑账单 */}
        <Modal title="编辑站点账单" open={editOpen} onOk={handleEdit} onCancel={() => {
          closeEdit()
          editForm.resetFields()
        }} width={800}>
          <Form form={editForm} layout="vertical">
            <Form.Item name="siteId" label="站点" rules={[{ required: true, message: '请选择站点' }]}>
              <Select
                showSearch
                placeholder="请选择站点"
                optionFilterProp="label"
                options={sites.map((s: any) => ({ value: s.id, label: `${s.name}${s.siteCode ? ` (${s.siteCode})` : ''}` }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="billDate" label="账单日期" rules={[{ required: true, message: '请选择账单日期' }]}>
              <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
            <Form.Item name="billType" label="账单类型" rules={[{ required: true, message: '请选择账单类型' }]}>
              <Radio.Group>
                <Radio value="income">收入</Radio>
                <Radio value="expense">支出</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
              <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入金额" />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
              <Select
                placeholder="请选择币种"
                options={currencies.map((c: any) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="请输入账单描述" />
            </Form.Item>
            <Form.Item name="accountId" label="账户">
              <Select
                showSearch
                placeholder="请选择账户（可选）"
                optionFilterProp="label"
                options={accounts.map((a: any) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                style={{ width: '100%' }}
                allowClear
              />
            </Form.Item>
            <Form.Item name="categoryId" label="类别">
              <Select
                showSearch
                placeholder="请选择类别（可选）"
                optionFilterProp="label"
                options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
                style={{ width: '100%' }}
                allowClear
              />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
              <Select
                options={[
                  { value: 'pending', label: '待处理' },
                  { value: 'paid', label: '已支付' },
                  { value: 'cancelled', label: '已取消' },
                ]}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="paymentDate" label="支付日期">
              <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={2} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}

