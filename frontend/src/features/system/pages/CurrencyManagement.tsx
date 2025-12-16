import { useMemo, useState } from 'react'
import { Card, Button, Form, Input, Space, message, Switch, Popconfirm } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import { useCurrencies, useCreateCurrency, useUpdateCurrency, useDeleteCurrency, useToggleCurrencyActive } from '../../../hooks/business/useCurrencies'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { currencySchema } from '../../../validations/currency.schema'
import type { Currency } from '../../../types'

import { PageContainer } from '../../../components/PageContainer'

export function CurrencyManagement() {
  const { data: currencies = [], isLoading, refetch } = useCurrencies()
  const { mutateAsync: createCurrency } = useCreateCurrency()
  const { mutateAsync: updateCurrency } = useUpdateCurrency()
  const { mutateAsync: deleteCurrencyMutation } = useDeleteCurrency()
  const { mutateAsync: toggleCurrencyActive } = useToggleCurrencyActive()

  const cModal = useFormModal<Currency>()
  const eModal = useFormModal<Currency>()
  const [searchParams, setSearchParams] = useState<{ search?: string; activeOnly?: string }>({})

  const { form: cForm, validateWithZod: validateCreate } = useZodForm(currencySchema)
  const { form: eForm, validateWithZod: validateEdit } = useZodForm(currencySchema)

  const { hasPermission } = usePermissions()
  const canManageCurrency = hasPermission('system', 'currency', 'create')

  // 过滤和排序数据
  const filteredAndSorted = useMemo(() => {
    let result = currencies.slice()
    
    // 搜索过滤
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter((c: Currency) => 
        c.code.toLowerCase().includes(search) || 
        c.name.toLowerCase().includes(search)
      )
    }
    
    // 状态过滤
    if (searchParams.activeOnly === 'true') {
      result = result.filter((c: Currency) => c.active === 1)
    } else if (searchParams.activeOnly === 'false') {
      result = result.filter((c: Currency) => c.active === 0)
    }
    
    // 排序
    return result.sort((a: Currency, b: Currency) => a.code.localeCompare(b.code))
  }, [currencies, searchParams])

  const deleteCurrency = useMemo(() => withErrorHandler(
    async (code: string) => {
      await deleteCurrencyMutation(code)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteCurrencyMutation])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (code: string, checked: boolean) => {
      await toggleCurrencyActive({ code, active: checked })
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '操作失败'
    }
  ), [toggleCurrencyActive])

  const handleCreate = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateCreate()
      const payload = { code: v.code.trim().toUpperCase(), name: v.name }
      await createCurrency(payload)
      cModal.close()
      cForm.resetFields()
    },
    {
      successMessage: '已新增',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, `币种代码"${cForm.getFieldValue('code')}"已存在，请使用其他代码`)
        }
      }
    }
  ), [cForm, validateCreate, cModal, createCurrency])

  const handleEdit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateEdit()
      const payload = { name: v.name, active: v.active ? 1 : 0 }
      if (eModal.data) {
        await updateCurrency({ code: eModal.data.code, data: payload })
        eModal.close()
        eForm.resetFields()
      }
    },
    {
      successMessage: '已更新',
      errorMessage: '更新失败'
    }
  ), [eForm, validateEdit, eModal, updateCurrency])

  const columns: DataTableColumn<Currency>[] = [
    { title: '代码', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '启用', dataIndex: 'active', key: 'active', render: (v: number) => v === 1 ? '是' : '否' },
  ]

  return (
    <PageContainer
      title="币种管理"
      breadcrumb={[{ title: '系统设置' }, { title: '币种管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '币种代码/名称', type: 'input', placeholder: '请输入币种代码或名称' },
            {
              name: 'activeOnly',
              label: '状态',
              type: 'select',
              placeholder: '请选择状态',
              options: [
                { label: '全部', value: '' },
                { label: '启用', value: 'true' },
                { label: '禁用', value: 'false' },
              ],
            },
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <Space style={{ marginBottom: 12, marginTop: 16 }}>
          <Button type="primary" onClick={() => { cModal.openCreate(); cForm.resetFields() }}>新增币种</Button>
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
        </Space>

        <DataTable<Currency>
          columns={columns}
          data={filteredAndSorted}
          loading={isLoading}
          rowKey="code"
          onEdit={(record) => {
            eModal.openEdit(record)
            eForm.setFieldsValue({
              code: record.code,
              name: record.name,
              active: record.active === 1
            })
          }}
          actions={(record) => (
            <Space>
              {canManageCurrency && (
                <Switch
                  size="small"
                  checked={record.active === 1}
                  onChange={(checked) => handleToggleActive(record.code, checked)}
                />
              )}
              {canManageCurrency && (
                <Popconfirm
                  title={`确定要删除币种"${record.code}"吗？`}
                  description="删除后该币种将被永久删除，如果有账户使用此币种，将无法删除。"
                  onConfirm={() => deleteCurrency(record.code)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </Space>
          )}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title="新增币种"
          open={cModal.isOpen}
          form={cForm}
          onSubmit={handleCreate}
          onCancel={() => {
            cModal.close()
            cForm.resetFields()
          }}
        >
          <Form.Item name="code" label="币种代码" rules={[{ required: true }]}>
            <Input placeholder="如 CNY、USD" maxLength={8} />
          </Form.Item>
          <Form.Item name="name" label="币种名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </FormModal>

        <FormModal
          title={eModal.data ? `编辑币种：${eModal.data.code}` : '编辑币种'}
          open={eModal.isOpen}
          form={eForm}
          onSubmit={handleEdit}
          onCancel={() => {
            eModal.close()
            eForm.resetFields()
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
