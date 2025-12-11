import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, DatePicker, InputNumber, Radio, Popconfirm } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { loadCurrencies, loadAccounts, loadExpenseCategories } from '../../../utils/loaders'
import { usePermissions } from '../../../utils/permissions'

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

export function SiteBills() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<any>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [sites, setSites] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [filters, setFilters] = useState({
    siteId: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    billType: undefined as string | undefined,
    status: undefined as string | undefined,
  })

  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('site', 'bill', 'create')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.siteId) params.append('siteId', filters.siteId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.billType) params.append('billType', filters.billType)
      if (filters.status) params.append('status', filters.status)

      const j = await apiClient.get<any>(`${api.siteBills}?${params}`)
      setData(j.results ?? [])
    } catch (error: any) {
      message.error(`查询失败: ${error.message || '网络错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadMasterData = async () => {
    try {
      const [currenciesData, accountsData, categoriesData, sitesData] = await Promise.all([
        loadCurrencies().then(results => results.map(r => ({ value: r.value, label: r.label }))),
        loadAccounts(),
        loadExpenseCategories(),
        apiClient.get<any[]>(api.sites).then(results => results.filter((s: any) => s.active === 1))
      ])
      setCurrencies(currenciesData)
      setAccounts(accountsData.map(a => ({ value: a.value, label: a.label, currency: a.currency })))
      setCategories(categoriesData.map(c => ({ value: c.value, label: c.label })))
      setSites(sitesData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    load()
    loadMasterData()
  }, [])

  useEffect(() => {
    load()
  }, [filters])

  const handleSubmit = async () => {
    const v = await form.validateFields()
    try {
      await apiClient.post(api.siteBills, {
        siteId: v.siteId,
        billDate: v.billDate.format('YYYY-MM-DD'),
        billType: v.billType,
        amountCents: Math.round(v.amount * 100),
        currency: v.currency,
        description: v.description || null,
        accountId: v.accountId || null,
        categoryId: v.categoryId || null,
        status: v.status || 'pending',
        paymentDate: v.paymentDate ? v.paymentDate.format('YYYY-MM-DD') : null,
        memo: v.memo || null,
      })

      message.success('创建成功')
      setOpen(false)
      form.resetFields()
      load()
    } catch (error: any) {
      message.error(`创建失败: ${error.message || '未知错误'}`)
    }
  }

  const handleEdit = async () => {
    const v = await editForm.validateFields()
    try {
      await apiClient.put(`${api.siteBills}/${editingBill.id}`, {
        siteId: v.siteId,
        billDate: v.billDate.format('YYYY-MM-DD'),
        billType: v.billType,
        amountCents: Math.round(v.amount * 100),
        currency: v.currency,
        description: v.description || null,
        accountId: v.accountId || null,
        categoryId: v.categoryId || null,
        status: v.status,
        paymentDate: v.paymentDate ? v.paymentDate.format('YYYY-MM-DD') : null,
        memo: v.memo || null,
      })

      message.success('更新成功')
      setEditOpen(false)
      setEditingBill(null)
      editForm.resetFields()
      load()
    } catch (error: any) {
      message.error(`更新失败: ${error.message || '未知错误'}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`${api.siteBills}/${id}`)

      message.success('删除成功')
      load()
    } catch (error: any) {
      message.error(`删除失败: ${error.message || '未知错误'}`)
    }
  }

  return (
    <PageContainer
      title="站点账单管理"
      breadcrumb={[{ title: '站点管理' }, { title: '站点账单' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }} wrap>
          {canEdit && (
            <Button type="primary" onClick={() => {
              form.resetFields()
              form.setFieldsValue({ billDate: dayjs(), billType: 'income', status: 'pending' })
              setOpen(true)
            }}>新建账单</Button>
          )}
          <Select
            placeholder="选择站点"
            allowClear
            style={{ width: 200 }}
            value={filters.siteId}
            onChange={(value) => setFilters({ ...filters, siteId: value })}
            options={sites.map((s: any) => ({ value: s.id, label: `${s.name}${s.siteCode ? ` (${s.siteCode})` : ''}` }))}
          />
          <DatePicker
            placeholder="开始日期"
            value={filters.startDate ? dayjs(filters.startDate) : null}
            onChange={(date) => setFilters({ ...filters, startDate: date ? date.format('YYYY-MM-DD') : undefined })}
          />
          <DatePicker
            placeholder="结束日期"
            value={filters.endDate ? dayjs(filters.endDate) : null}
            onChange={(date) => setFilters({ ...filters, endDate: date ? date.format('YYYY-MM-DD') : undefined })}
          />
          <Select
            placeholder="账单类型"
            allowClear
            style={{ width: 120 }}
            value={filters.billType}
            onChange={(value) => setFilters({ ...filters, billType: value })}
            options={[
              { value: 'income', label: '收入' },
              { value: 'expense', label: '支出' },
            ]}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { value: 'pending', label: '待处理' },
              { value: 'paid', label: '已支付' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <Button onClick={load}>刷新</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          dataSource={data}
          loading={loading}
          columns={[
            { title: '账单日期', dataIndex: 'billDate', width: 120 },
            { title: '站点', dataIndex: 'siteName', width: 150, render: (v: string, r: any) => `${v}${r.siteCode ? ` (${r.siteCode})` : ''}` },
            { title: '类型', dataIndex: 'billType', width: 80, render: (v: string) => BILL_TYPE_LABELS[v] || v },
            {
              title: '金额',
              width: 150,
              align: 'right',
              render: (_: any, r: any) => `${(r.amountCents / 100).toFixed(2)} ${r.currency}`
            },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            { title: '账户', dataIndex: 'accountName', width: 120 },
            { title: '类别', dataIndex: 'categoryName', width: 120 },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => STATUS_LABELS[v] || v },
            { title: '支付日期', dataIndex: 'paymentDate', width: 120, render: (v: string) => v || '-' },
            { title: '备注', dataIndex: 'memo', ellipsis: true },
            { title: '创建人', dataIndex: 'creator_name', width: 100 },
            {
              title: '操作',
              width: 120,
              fixed: 'right',
              render: (_: any, r: any) => (
                <Space>
                  {canEdit && (
                    <Button size="small" onClick={() => {
                      setEditingBill(r)
                      editForm.setFieldsValue({
                        siteId: r.siteId,
                        billDate: dayjs(r.billDate),
                        billType: r.billType,
                        amount: r.amountCents / 100,
                        currency: r.currency,
                        description: r.description,
                        accountId: r.accountId,
                        categoryId: r.categoryId,
                        status: r.status,
                        paymentDate: r.paymentDate ? dayjs(r.paymentDate) : null,
                        memo: r.memo,
                      })
                      setEditOpen(true)
                    }}>编辑</Button>
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
              ),
            },
          ]}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />

        {/* 新建账单 */}
        <Modal title="新建站点账单" open={open} onOk={handleSubmit} onCancel={() => {
          setOpen(false)
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
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
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
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={2} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑账单 */}
        <Modal title="编辑站点账单" open={editOpen} onOk={handleEdit} onCancel={() => {
          setEditOpen(false)
          setEditingBill(null)
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
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
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
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
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

