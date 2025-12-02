import { useEffect, useState, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Select, Space, message } from 'antd'
import { api } from '../../../config/api'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../../../utils/api'
import { FormModal } from '../../../components/FormModal'
import { ActionColumn } from '../../../components/ActionColumn'
import { usePermissions } from '../../../utils/permissions'

const KIND_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
}

export function CategoryManagement() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<any>(null)
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  
  const { hasPermission } = usePermissions()
  const canManageCategory = hasPermission('finance', 'category', 'create')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet(api.categories)
      setData(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const deleteCategory = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(api.categoriesById(id))
      message.success('删除成功')
      load()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [load])

  return (
    <Card title="类别管理">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={()=>{ setCreateOpen(true); cForm.resetFields() }}>新建类别</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={data} columns={[
        { title: '名称', dataIndex: 'name' },
        { title: '类型', dataIndex: 'kind', render: (v:string)=> KIND_LABELS[v] || v },
        {
          title: '操作',
          render: (_:any, r:any)=> (
            <ActionColumn
              record={r}
              canEdit={canManageCategory}
              canDelete={canManageCategory}
              onEdit={() => { setEditRow(r); setEditOpen(true); eForm.setFieldsValue({ name: r.name, kind: r.kind }) }}
              onDelete={deleteCategory}
              deleteDescription="删除后该类别将被永久删除，如果有流水使用该类别，将无法删除。"
            />
          )
        },
      ]} />

      <FormModal
        title="新建类别"
        open={createOpen}
        form={cForm}
        onSubmit={async () => {
          const v = await cForm.validateFields()
          try {
            await apiPost(api.categories, v)
            message.success('已创建')
            setCreateOpen(false)
            cForm.resetFields()
            load()
          } catch (error: any) {
            handleConflictError(error, `类别名称"${v.name}"已存在，请使用其他名称`)
          }
        }}
        onCancel={() => {
          setCreateOpen(false)
          cForm.resetFields()
        }}
        formProps={{ initialValues: { kind: 'income' } }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
          <Select options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }]} />
        </Form.Item>
      </FormModal>

      <FormModal
        title={editRow ? `编辑：${editRow.name}` : '编辑类别'}
        open={editOpen}
        form={eForm}
        onSubmit={async () => {
          const v = await eForm.validateFields()
          try {
            await apiPut(api.categoriesById(editRow.id), v)
            message.success('已更新')
            setEditOpen(false)
            setEditRow(null)
            eForm.resetFields()
            load()
          } catch (error: any) {
            handleConflictError(error, `类别名称"${v.name}"已存在，请使用其他名称`)
          }
        }}
        onCancel={() => {
          setEditOpen(false)
          setEditRow(null)
          eForm.resetFields()
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
          <Select options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }]} />
        </Form.Item>
      </FormModal>
    </Card>
  )
}
