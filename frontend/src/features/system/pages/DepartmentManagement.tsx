import { useMemo } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Popconfirm, Switch } from 'antd'
import { api as apiUrls } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'
import { useDepartments, useFormModal, useZodForm } from '../../../hooks'
import { departmentSchema } from '../../../validations/department.schema'
import type { Department } from '../../../types'

import { PageContainer } from '../../../components/PageContainer'

export function DepartmentManagement() {
  const { data: deptData = [], isLoading, refetch } = useDepartments()
  const modal = useFormModal<Department>()
  const { form: deptForm, validateWithZod } = useZodForm(departmentSchema)

  const { hasPermission } = usePermissions()
  const canManageDepartments = hasPermission('system', 'department', 'create')

  const createDept = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      await apiClient.post(apiUrls.departments, v)
      modal.close()
      deptForm.resetFields()
      refetch()
    },
    {
      successMessage: '创建成功',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, `项目名称"${deptForm.getFieldValue('name')}"已存在，请使用其他名称`)
        }
      }
    }
  ), [deptForm, validateWithZod, modal, refetch])

  const deleteDept = useMemo(() => withErrorHandler(
    async (id: string) => {
      await apiClient.delete(`${apiUrls.departments}/${id}`)
      refetch()
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [refetch])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (id: string, checked: boolean) => {
      await apiClient.put(`${apiUrls.departments}/${id}`, { active: checked ? 1 : 0 })
      refetch()
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      onError: (error: any) => {
        handleConflictError(error, '项目名称已存在，请使用其他名称')
      }
    }
  ), [refetch])

  return (
    <PageContainer
      title="项目管理"
      breadcrumb={[{ title: '系统设置' }, { title: '项目管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          {canManageDepartments && (
            <Button type="primary" onClick={() => {
              modal.openCreate()
              deptForm.resetFields()
            }}>新建项目</Button>
          )}
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
        </Space>
        <Table className="table-striped" rowKey="id" loading={isLoading} dataSource={deptData} columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '状态', dataIndex: 'active', render: (v: number) => v ? '启用' : '禁用' },
          {
            title: '操作', render: (_: unknown, r: Department) => (
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
                    onConfirm={() => deleteDept(r.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                )}
              </Space>
            )
          },
        ]} pagination={{ pageSize: 20 }} />

        <FormModal
          title="新建项目"
          open={modal.isOpen}
          form={deptForm}
          onSubmit={createDept}
          onCancel={() => {
            modal.close()
            deptForm.resetFields()
          }}
        >
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
