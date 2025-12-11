import { useMemo, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Select, Space, message, Switch, Popconfirm } from 'antd'
import { api } from '../../../config/api'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { api as apiClient } from '../../../api/http'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'
import { useAccounts, useCurrencyOptions, useFormModal, useZodForm } from '../../../hooks'
import { useBatchDeleteAccount } from '../../../hooks/business/useAccounts'
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
  const { data: accounts = [], isLoading, refetch } = useAccounts()
  const { data: currencyOptions = [] } = useCurrencyOptions()

  const modal = useFormModal<Account>()
  const { form: cForm, validateWithZod: validateCreate } = useZodForm(accountSchema)
  const { form: eForm, validateWithZod: validateEdit } = useZodForm(accountSchema)

  const { hasPermission } = usePermissions()
  const canManageAccounts = hasPermission('finance', 'account', 'create')

  const { mutateAsync: batchDeleteAccount } = useBatchDeleteAccount()
  const tableActions = useTableActions<Account>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteAccount,
    tableActions,
    {
      onSuccess: () => {
        refetch()
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  const sorted = useMemo(() => accounts.slice().sort((a: Account, b: Account) => a.name.localeCompare(b.name)), [accounts])

  const deleteAccount = useCallback(async (id: string, name: string) => {
    try {
      await apiClient.delete(api.accountsById(id))
      message.success('删除成功')
      refetch()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [refetch])

  const handleToggleActive = useCallback(async (id: string, checked: boolean) => {
    try {
      await apiClient.put(api.accountsById(id), { active: checked ? 1 : 0 })
      message.success(checked ? '已启用' : '已停用')
      refetch()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }, [refetch])

  const handleCreate = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateCreate()
      await apiClient.post(api.accounts, v)
      modal.close()
      cForm.resetFields()
      refetch()
    },
    {
      successMessage: '已创建',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, '账户名称', cForm.getFieldValue('name'))
        }
      }
    }
  ), [cForm, validateCreate, modal, refetch])

  const handleEdit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateEdit()
      const payload = { ...v, active: v.active ? 1 : 0 }
      if (modal.data) {
        await apiClient.put(api.accountsById(modal.data.id), payload)
        modal.close()
        eForm.resetFields()
        refetch()
      }
    },
    {
      successMessage: '已更新',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, '账户名称', eForm.getFieldValue('name'))
        }
      }
    }
  ), [eForm, validateEdit, modal, refetch])

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

  return (
    <PageContainer
      title="账户管理"
      breadcrumb={[{ title: '系统设置' }, { title: '账户管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => {
            modal.openCreate()
            cForm.resetFields()
          }}>新建账户</Button>
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
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
        <Table
          className="table-striped"
          rowKey="id"
          loading={isLoading}
          dataSource={sorted}
          rowSelection={canManageAccounts ? rowSelection : undefined}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '账户号', dataIndex: 'accountNumber', render: (v: string) => v || '-' },
            { title: '别名', dataIndex: 'alias', render: (v: string) => v || '-' },
            { title: '类型', dataIndex: 'type', render: (v: string) => TYPE_OPTIONS.find(o => o.value === v)?.label || v },
            { title: '币种', render: (_: unknown, r: Account) => r.currencyName ? `${r.currency} - ${r.currencyName}` : r.currency },
            { title: '管理人员', dataIndex: 'manager', render: (v: string) => v || '-' },
            { title: '启用', dataIndex: 'active', render: (v: number) => v === 1 ? '是' : '否' },
            {
              title: '操作', render: (_: unknown, r: Account) => (
                <Space>
                  <Button size="small" onClick={() => handleEditClick(r)}>编辑</Button>
                  {canManageAccounts && (
                    <Switch
                      size="small"
                      checked={r.active === 1}
                      onChange={(checked) => handleToggleActive(r.id, checked)}
                    />
                  )}
                  {canManageAccounts && (
                    <Popconfirm
                      title={`确定要删除账户"${r.name}"吗？`}
                      description="删除后该账户将被永久删除，如果有流水使用此账户，将无法删除。"
                      onConfirm={() => deleteAccount(r.id, r.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              )
            },
          ]} />

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


