import { useEffect, useState, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Popconfirm, Switch } from 'antd'
import { api } from '../config/api'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../utils/api'
import { FormModal } from '../components/FormModal'
import { usePermissions } from '../utils/permissions'

export function DepartmentManagement() {
  const [deptData, setDeptData] = useState<any[]>([])
  const [deptOpen, setDeptOpen] = useState(false)
  const [deptForm] = Form.useForm()
  
  const { hasPermission } = usePermissions()
  const canManageDepartments = hasPermission('system', 'department', 'create')

  const loadDept = useCallback(async () => {
    const data = await apiGet(api.departments)
    setDeptData(data ?? [])
  }, [])

  useEffect(() => {
    loadDept()
  }, [loadDept])

  const createDept = useCallback(async () => {
    const v = await deptForm.validateFields()
    try {
      await apiPost(api.departments, v)
      message.success('创建成功')
      setDeptOpen(false)
      deptForm.resetFields()
      loadDept()
    } catch (error: any) {
      handleConflictError(error, `项目名称"${v.name}"已存在，请使用其他名称`)
    }
  }, [deptForm, loadDept])

  const deleteDept = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(`${api.departments}/${id}`)
      message.success('删除成功')
      loadDept()
    } catch (error: any) {
      // 显示后端返回的具体错误信息
      const errorMessage = error.message || error.error || '删除失败'
      message.error(errorMessage)
      console.error('Delete department error:', error)
    }
  }, [loadDept])

  const handleToggleActive = useCallback(async (id: string, checked: boolean) => {
    try {
      await apiPut(`${api.departments}/${id}`, { active: checked ? 1 : 0 })
      message.success(checked ? '已启用' : '已停用')
      loadDept()
    } catch (error: any) {
      handleConflictError(error, '项目名称已存在，请使用其他名称')
    }
  }, [loadDept])

  return (
    <Card title="项目管理">
      <Space style={{ marginBottom: 12 }}>
        {canManageDepartments && (
          <Button type="primary" onClick={() => setDeptOpen(true)}>新建项目</Button>
        )}
        <Button onClick={loadDept}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={deptData} columns={[
        { title: '名称', dataIndex: 'name' },
        { title: '状态', dataIndex: 'active', render: (v: number) => v ? '启用' : '禁用' },
        { title: '操作', render: (_:any, r:any)=> (
          <Space>
            {canManageDepartments && (
              <Switch 
                size="small" 
                checked={r.active === 1}
                onChange={(checked) => handleToggleActive(r.id, checked)}
              />
            )}
            {canManageDepartments && (
              <Popconfirm
                title={`确定要删除项目"${r.name}"吗？`}
                description="删除后该项目将被永久删除。如果该项目下还有站点、员工或组织部门，将无法删除。"
                onConfirm={() => deleteDept(r.id, r.name)}
                okText="确定"
                cancelText="取消"
              >
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            )}
          </Space>
        )},
      ]} pagination={{ pageSize: 20 }} />

      <FormModal
        title="新建项目"
        open={deptOpen}
        form={deptForm}
        onSubmit={createDept}
        onCancel={() => {
          setDeptOpen(false)
          deptForm.resetFields()
        }}
      >
        <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </FormModal>
    </Card>
  )
}
