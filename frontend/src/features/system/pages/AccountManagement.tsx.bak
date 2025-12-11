import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Select, Space, message, Switch, Popconfirm } from 'antd'
import { api } from '../../../config/api'
import { loadCurrencies } from '../../../utils/loaders'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../../../utils/api'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'

const TYPE_OPTIONS = [
  { value: 'cash', label: '现金' },
  { value: 'bank', label: '银行' },
  { value: 'other', label: '其他' },
]

export function AccountManagement() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<any>(null)
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  const [currencies, setCurrencies] = useState<{ value: string, label: string }[]>([])
  
  const { hasPermission } = usePermissions()
  const canManageAccounts = hasPermission('finance', 'account', 'create')

  const sorted = useMemo(() => data.slice().sort((a,b)=>a.name.localeCompare(b.name)), [data])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await apiGet(api.accounts)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadCurrencies().then(data => setCurrencies(data))
  }, [load])

  const deleteAccount = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(api.accountsById(id))
      message.success('删除成功')
      load()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [load])

  const handleToggleActive = useCallback(async (id: string, checked: boolean) => {
    try {
      await apiPut(api.accountsById(id), { active: checked ? 1 : 0 })
      message.success(checked ? '已启用' : '已停用')
      load()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }, [load])

  const handleCreate = useCallback(async () => {
    const v = await cForm.validateFields()
    try {
      await apiPost(api.accounts, v)
      message.success('已创建')
      setCreateOpen(false)
      cForm.resetFields()
      load()
    } catch (error: any) {
      handleConflictError(error, '账户名称', v.name)
    }
  }, [cForm, load])

  const handleEdit = useCallback(async () => {
    const v = await eForm.validateFields()
    const payload = { ...v, active: v.active ? 1 : 0 }
    try {
      await apiPut(api.accountsById(editRow!.id), payload)
      message.success('已更新')
      setEditOpen(false)
      setEditRow(null)
      eForm.resetFields()
      load()
    } catch (error: any) {
      handleConflictError(error, '账户名称', v.name)
    }
  }, [eForm, editRow, load])

  const handleEditClick = useCallback((r: any) => {
    setEditRow(r)
    setEditOpen(true)
    eForm.setFieldsValue({
      name: r.name,
      alias: r.alias,
      account_number: r.account_number,
      type: r.type,
      currency: r.currency,
      active: r.active === 1,
      manager: r.manager,
    })
  }, [eForm])

  return (
    <Card title="账户管理">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={()=>{ setCreateOpen(true); cForm.resetFields() }}>新建账户</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={sorted} columns={[
        { title: '名称', dataIndex: 'name' },
        { title: '账户号', dataIndex: 'account_number', render: (v:string)=> v || '-' },
        { title: '别名', dataIndex: 'alias', render: (v:string)=> v || '-' },
        { title: '类型', dataIndex: 'type', render: (v:string)=> TYPE_OPTIONS.find(o=>o.value===v)?.label || v },
        { title: '币种', render: (_:any, r:any)=> r.currency_name ? `${r.currency} - ${r.currency_name}` : r.currency },
        { title: '管理人员', dataIndex: 'manager', render: (v:string)=> v || '-' },
        { title: '启用', dataIndex: 'active', render: (v:number)=> v===1?'是':'否' },
        { title: '操作', render: (_:any, r:any)=> (
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
        ) },
      ]} />

      <FormModal
        title="新建账户"
        open={createOpen}
        form={cForm}
        onSubmit={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          cForm.resetFields()
        }}
        formProps={{ initialValues: { type: 'cash', currency: 'CNY' } }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="account_number" label="账户号">
          <Input placeholder="银行账号、卡号等" />
        </Form.Item>
        <Form.Item name="alias" label="别名">
          <Input placeholder="可选，支持模糊搜索" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
          <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
        </Form.Item>
        <Form.Item name="manager" label="管理人员">
          <Input placeholder="可选，填写管理人员姓名" />
        </Form.Item>
      </FormModal>

      <FormModal
        title={editRow ? `编辑：${editRow.name}` : '编辑账户'}
        open={editOpen}
        form={eForm}
        onSubmit={handleEdit}
        onCancel={() => {
          setEditOpen(false)
          setEditRow(null)
          eForm.resetFields()
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="account_number" label="账户号">
          <Input placeholder="银行账号、卡号等" />
        </Form.Item>
        <Form.Item name="alias" label="别名">
          <Input placeholder="可选" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
          <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
        </Form.Item>
        <Form.Item name="manager" label="管理人员">
          <Input placeholder="可选，填写管理人员姓名" />
        </Form.Item>
        <Form.Item name="active" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </FormModal>
    </Card>
  )
}


