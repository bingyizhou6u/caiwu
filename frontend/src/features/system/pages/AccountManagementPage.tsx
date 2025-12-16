import { useMemo, useCallback, useState } from 'react'
import { Card, Button, Form, Input, Select, Space, message, Switch, Popconfirm } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useBatchDeleteAccount, useCurrencyOptions, useFormModal, useZodForm } from '../../../hooks'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { DeleteOutlined } from '@ant-design/icons'
import { accountSchema } from '../../../validations/account.schema'
import type { Account } from '../../../types'

const TYPE_OPTIONS = [
  { value: 'cash', label: '现金' },
  { value: 'bank', label: '银行' },
  { value: 'other', label: '其他' },
]

import { PageContainer } from '../../../components/PageContainer'

export function AccountManagement() {
  const { data: accounts = [], isLoading } = useAccounts()
  const { data: currencyOptions = [] } = useCurrencyOptions()
  const { mutateAsync: createAccount } = useCreateAccount()
  const { mutateAsync: updateAccount } = useUpdateAccount()
  const { mutateAsync: deleteAccountMutation } = useDeleteAccount()
  const { mutateAsync: batchDeleteAccount } = useBatchDeleteAccount()
  
  const [searchParams, setSearchParams] = useState<{ search?: string; type?: string; currency?: string; activeOnly?: string }>({})

  const modal = useFormModal<Account>()
  const { form: cForm, validateWithZod: validateCreate } = useZodForm(accountSchema)
  const { form: eForm, validateWithZod: validateEdit } = useZodForm(accountSchema)

  const { hasPermission } = usePermissions()
  const canManageAccounts = hasPermission('finance', 'account', 'create')

  const tableActions = useTableActions<Account>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteAccount,
    tableActions,
    {
      onSuccess: () => {
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  // 过滤和排序数据
  const filteredAndSorted = useMemo(() => {
    let result = accounts.slice()
    
    // 搜索过滤
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter((a: Account) => 
        a.name.toLowerCase().includes(search) ||
        (a.alias && a.alias.toLowerCase().includes(search)) ||
        (a.accountNumber && a.accountNumber.toLowerCase().includes(search))
      )
    }
    
    // 类型过滤
    if (searchParams.type) {
      result = result.filter((a: Account) => a.type === searchParams.type)
    }
    
    // 币种过滤
    if (searchParams.currency) {
      result = result.filter((a: Account) => a.currency === searchParams.currency)
    }
    
    // 状态过滤
    if (searchParams.activeOnly === 'true') {
      result = result.filter((a: Account) => a.active === 1)
    } else if (searchParams.activeOnly === 'false') {
      result = result.filter((a: Account) => a.active === 0)
    }
    
    // 排序
    return result.sort((a: Account, b: Account) => a.name.localeCompare(b.name))
  }, [accounts, searchParams])

  const deleteAccount = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteAccountMutation(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteAccountMutation])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (id: string, checked: boolean) => {
      await updateAccount({ id, data: { active: checked ? 1 : 0 } })
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '操作失败'
    }
  ), [updateAccount])

  const handleCreate = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateCreate()
      await createAccount(v)
      modal.close()
      cForm.resetFields()
    },
    {
      successMessage: '已创建',
      onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : ''
        if (errorMessage !== '表单验证失败') {
          handleConflictError(error, '账户名称', cForm.getFieldValue('name'))
        }
      }
    }
  ), [cForm, validateCreate, modal, createAccount])

  const handleEdit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateEdit()
      const payload = { ...v, active: v.active ? 1 : 0 }
      if (modal.data) {
        await updateAccount({ id: modal.data.id, data: payload })
        modal.close()
        eForm.resetFields()
      }
    },
    {
      successMessage: '已更新',
      onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : ''
        if (errorMessage !== '表单验证失败') {
          handleConflictError(error, '账户名称', eForm.getFieldValue('name'))
        }
      }
    }
  ), [eForm, validateEdit, modal, updateAccount])

  const handleEditClick = useCallback((r: Account) => {
    modal.openEdit(r)
    eForm.setFieldsValue({
      name: r.name,
      alias: r.alias,
      accountNumber: r.accountNumber,
      type: r.type,
      currency: r.currency,
      active: r.active === 1,
      manager: r.manager,
    })
  }, [eForm, modal])

  const columns: DataTableColumn<Account>[] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '账户号', dataIndex: 'accountNumber', key: 'accountNumber', render: (v: string) => v || '-' },
    { title: '别名', dataIndex: 'alias', key: 'alias', render: (v: string) => v || '-' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => TYPE_OPTIONS.find(o => o.value === v)?.label || v },
    { title: '币种', key: 'currency', render: (_: unknown, r: Account) => r.currencyName ? `${r.currency} - ${r.currencyName}` : r.currency },
    { title: '管理人员', dataIndex: 'manager', key: 'manager', render: (v: string) => v || '-' },
    { title: '启用', dataIndex: 'active', key: 'active', render: (v: number) => v === 1 ? '是' : '否' },
  ]

  return (
    <PageContainer
      title="账户管理"
      breadcrumb={[{ title: '系统设置' }, { title: '账户管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '账户名称/别名/账户号', type: 'input', placeholder: '请输入搜索关键词' },
            {
              name: 'type',
              label: '类型',
              type: 'select',
              placeholder: '请选择类型',
              options: [
                { label: '全部', value: '' },
                ...TYPE_OPTIONS,
              ],
            },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              placeholder: '请选择币种',
              options: [
                { label: '全部', value: '' },
                ...currencyOptions,
              ],
            },
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
          <Button type="primary" onClick={() => {
            modal.openCreate()
            cForm.resetFields()
          }}>新建账户</Button>
          {canManageAccounts && (
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              loading={batchDeleting}
            >
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 个账户吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0}
              >
                <span>批量删除 ({selectedRowKeys.length})</span>
              </Popconfirm>
            </Button>
          )}
        </Space>

        <DataTable<Account>
          columns={columns}
          data={filteredAndSorted}
          loading={isLoading}
          rowKey="id"
          rowSelection={canManageAccounts ? rowSelection : undefined}
          onEdit={(record) => handleEditClick(record)}
          actions={(record) => (
            <Space>
              {canManageAccounts && (
                <Switch
                  size="small"
                  checked={record.active === 1}
                  onChange={(checked) => handleToggleActive(record.id, checked)}
                />
              )}
              {canManageAccounts && (
                <Popconfirm
                  title={`确定要删除账户"${record.name}"吗？`}
                  description="删除后该账户将被永久删除，如果有流水使用此账户，将无法删除。"
                  onConfirm={() => deleteAccount(record.id)}
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
          title="新建账户"
          open={modal.isCreate}
          form={cForm}
          onSubmit={handleCreate}
          onCancel={() => {
            modal.close()
            cForm.resetFields()
          }}
          formProps={{ initialValues: { type: 'cash', currency: 'CNY' } }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountNumber" label="账户号">
            <Input placeholder="银行账号、卡号等" />
          </Form.Item>
          <Form.Item name="alias" label="别名">
            <Input placeholder="可选，支持模糊搜索" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencyOptions} showSearch optionFilterProp="label" placeholder="选择币种" />
          </Form.Item>
          <Form.Item name="manager" label="管理人员">
            <Input placeholder="可选，填写管理人员姓名" />
          </Form.Item>
        </FormModal>

        <FormModal
          title={modal.data ? `编辑：${modal.data.name}` : '编辑账户'}
          open={modal.isEdit}
          form={eForm}
          onSubmit={handleEdit}
          onCancel={() => {
            modal.close()
            eForm.resetFields()
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountNumber" label="账户号">
            <Input placeholder="银行账号、卡号等" />
          </Form.Item>
          <Form.Item name="alias" label="别名">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencyOptions} showSearch optionFilterProp="label" placeholder="选择币种" />
          </Form.Item>
          <Form.Item name="manager" label="管理人员">
            <Input placeholder="可选，填写管理人员姓名" />
          </Form.Item>
          <Form.Item name="active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}


