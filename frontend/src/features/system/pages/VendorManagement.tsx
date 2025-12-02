import { useEffect, useState, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Space, message } from 'antd'
import { api } from '../../../config/api'
import { apiGet, apiPost, apiPut, apiDelete, safeApiCall, handleConflictError } from '../../../utils/api'
import { FormModal } from '../../../components/FormModal'
import { ActionColumn } from '../../../components/ActionColumn'
import { usePermissions } from '../../../utils/permissions'

export function VendorManagement() {
  const [data, setData] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { hasPermission, isManager } = usePermissions()
  const canEdit = hasPermission('system', 'department', 'create')

  const load = useCallback(async () => {
    const result = await safeApiCall(() => apiGet(api.vendors), '获取供应商列表失败')
    if (result) setData(result)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = useCallback(async () => {
    const v = await form.validateFields()
    try {
      if (editing) {
        await apiPut(`${api.vendors}/${editing.id}`, v)
        message.success('更新成功')
      } else {
        await apiPost(api.vendors, v)
        message.success('创建成功')
      }
      setOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (error: any) {
      handleConflictError(error, '供应商名称', v.name)
    }
  }, [editing, form, load])

  const handleEdit = useCallback((record: any) => {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      contact: record.contact
    })
    setOpen(true)
  }, [form])

  const handleDelete = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(`${api.vendors}/${id}`)
      message.success('删除成功')
      load()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [load])

  const handleCancel = useCallback(() => {
    setOpen(false)
    setEditing(null)
    form.resetFields()
  }, [form])

  return (
    <Card title="供应商管理">
      <Space style={{ marginBottom: 12 }}>
        {canEdit && (
          <Button type="primary" onClick={() => {
            setEditing(null)
            form.resetFields()
            setOpen(true)
          }}>新建供应商</Button>
        )}
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={data} columns={[
        { title: '供应商名称', dataIndex: 'name' },
        { title: '联系方式', dataIndex: 'contact' },
        {
          title: '操作',
          render: (_: any, r: any) => (
            <ActionColumn
              record={r}
              canEdit={canEdit}
              canDelete={isManager()}
              onEdit={handleEdit}
              onDelete={handleDelete}
              deleteDescription="删除后该供应商将被永久删除，如果有应付账款记录，将无法删除。"
            />
          )
        },
      ]} />

      <FormModal
        title={editing ? '编辑供应商' : '新建供应商'}
        open={open}
        form={form}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      >
        <Form.Item name="name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
          <Input placeholder="请输入供应商名称" />
        </Form.Item>
        <Form.Item name="contact" label="联系方式">
          <Input placeholder="请输入联系方式" />
        </Form.Item>
      </FormModal>
    </Card>
  )
}

