import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Switch, Popconfirm } from 'antd'
import { api } from '../config/api'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../utils/api'
import { FormModal } from '../components/FormModal'

type Currency = {
  code: string
  name: string
  active: number
}

export function CurrencyManagement({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<Currency[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<Currency | null>(null)
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  const isManager = userRole === 'manager'

  const sorted = useMemo(() => data.slice().sort((a,b)=> a.code.localeCompare(b.code)), [data])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet(api.currencies)
      setData(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const deleteCurrency = useCallback(async (code: string, name: string) => {
    try {
      await apiDelete(api.currenciesByCode(code))
      message.success('删除成功')
      load()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [load])

  const handleToggleActive = useCallback(async (code: string, checked: boolean) => {
    try {
      await apiPut(api.currenciesByCode(code), { active: checked ? 1 : 0 })
      message.success(checked ? '已启用' : '已停用')
      load()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }, [load])

  const handleCreate = useCallback(async () => {
    const v = await cForm.validateFields()
    const payload = { code: v.code.trim().toUpperCase(), name: v.name }
    try {
      await apiPost(api.currencies, payload)
      message.success('已新增')
      setCreateOpen(false)
      cForm.resetFields()
      load()
    } catch (error: any) {
      handleConflictError(error, `币种代码"${payload.code}"已存在，请使用其他代码`)
    }
  }, [cForm, load])

  const handleEdit = useCallback(async () => {
    const v = await eForm.validateFields()
    const payload = { name: v.name, active: v.active ? 1 : 0 }
    try {
      await apiPut(api.currenciesByCode(editRow!.code), payload)
      message.success('已更新')
      setEditOpen(false)
      setEditRow(null)
      eForm.resetFields()
      load()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    }
  }, [eForm, editRow, load])

  return (
    <Card title="币种管理">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={()=>{ setCreateOpen(true); cForm.resetFields() }}>新增币种</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="code" loading={loading} dataSource={sorted} columns={[
        { title: '代码', dataIndex: 'code' },
        { title: '名称', dataIndex: 'name' },
        { title: '启用', dataIndex: 'active', render: (v:number)=> v===1?'是':'否' },
        { title: '操作', render: (_:any, r:Currency)=> (
          <Space>
            <Button size="small" onClick={()=>{
              setEditRow(r)
              setEditOpen(true)
              eForm.setFieldsValue({ name: r.name, active: r.active === 1 })
            }}>编辑</Button>
            {(isManager || userRole === 'finance') && (
              <Switch 
                size="small" 
                checked={r.active === 1}
                onChange={(checked) => handleToggleActive(r.code, checked)}
              />
            )}
            {isManager && (
              <Popconfirm
                title={`确定要删除币种"${r.code}"吗？`}
                description="删除后该币种将被永久删除，如果有账户使用此币种，将无法删除。"
                onConfirm={() => deleteCurrency(r.code, r.name)}
                okText="确定"
                cancelText="取消"
              >
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            )}
          </Space>
        ) }
      ]} />

      <FormModal
        title="新增币种"
        open={createOpen}
        form={cForm}
        onSubmit={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          cForm.resetFields()
        }}
      >
        <Form.Item name="code" label="币种代码" rules={[{ required: true, message: '请输入币种代码' }]}>
          <Input placeholder="如 CNY、USD" maxLength={8} />
        </Form.Item>
        <Form.Item name="name" label="币种名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input />
        </Form.Item>
      </FormModal>

      <FormModal
        title={editRow ? `编辑币种：${editRow.code}` : '编辑币种'}
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
        <Form.Item name="active" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </FormModal>
    </Card>
  )
}


