import { useMemo } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Switch, Popconfirm } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
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

  const { form: cForm, validateWithZod: validateCreate } = useZodForm(currencySchema)
  const { form: eForm, validateWithZod: validateEdit } = useZodForm(currencySchema)

  const { hasPermission } = usePermissions()
  const canManageCurrency = hasPermission('system', 'currency', 'create')

  const sorted = useMemo(() => currencies.slice().sort((a: Currency, b: Currency) => a.code.localeCompare(b.code)), [currencies])

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

  return (
    <PageContainer
      title="币种管理"
      breadcrumb={[{ title: '系统设置' }, { title: '币种管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => { cModal.openCreate(); cForm.resetFields() }}>新增币种</Button>
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
        </Space>
        <Table className="table-striped" rowKey="code" loading={isLoading} dataSource={sorted} columns={[
          { title: '代码', dataIndex: 'code' },
          { title: '名称', dataIndex: 'name' },
          { title: '启用', dataIndex: 'active', render: (v: number) => v === 1 ? '是' : '否' },
          {
            title: '操作', render: (_: any, r: Currency) => (
              <Space>
                <Button size="small" onClick={() => {
                  eModal.openEdit(r)
                  eForm.setFieldsValue({
                    code: r.code,
                    name: r.name,
                    active: r.active === 1
                  })
                }}>编辑</Button>
                {canManageCurrency && (
                  <Switch
                    size="small"
                    checked={r.active === 1}
                    onChange={(checked) => handleToggleActive(r.code, checked)}
                  />
                )}
                {canManageCurrency && (
                  <Popconfirm
                    title={`确定要删除币种"${r.code}"吗？`}
                    description="删除后该币种将被永久删除，如果有账户使用此币种，将无法删除。"
                    onConfirm={() => deleteCurrency(r.code)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                )}
              </Space>
            )
          }
        ]} />

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
