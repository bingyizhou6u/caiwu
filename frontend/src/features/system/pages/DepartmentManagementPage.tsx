import { useMemo, useState } from 'react'
import { Card, Button, Form, Input, Space, message, Popconfirm, Switch } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { DataTable, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment, useFormModal, useZodForm } from '../../../hooks'
import { departmentSchema } from '../../../validations/department.schema'
import type { Department } from '../../../types'
import { PageContainer } from '../../../components/PageContainer'

export function DepartmentManagement() {
  const { data: deptData = [], isLoading } = useDepartments()
  const { mutateAsync: createDeptMutation } = useCreateDepartment()
  const { mutateAsync: updateDeptMutation } = useUpdateDepartment()
  const { mutateAsync: deleteDeptMutation } = useDeleteDepartment()
  
  const modal = useFormModal<Department>()
  const { form: deptForm, validateWithZod } = useZodForm(departmentSchema)
  const [searchParams, setSearchParams] = useState<{ search?: string; activeOnly?: string }>({})

  const { hasPermission } = usePermissions()
  const canManageDepartments = hasPermission('system', 'department', 'create')

  // 过滤数据
  const filteredDepartments = useMemo(() => {
    let result = deptData
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter(d => d.name.toLowerCase().includes(search))
    }
    if (searchParams.activeOnly === 'true') {
      result = result.filter(d => d.active === 1)
    } else if (searchParams.activeOnly === 'false') {
      result = result.filter(d => d.active === 0)
    }
    return result
  }, [deptData, searchParams])

  const createDept = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      await createDeptMutation(v)
      modal.close()
      deptForm.resetFields()
    },
    {
      successMessage: '创建成功',
      onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : ''
        if (errorMessage !== '表单验证失败') {
          handleConflictError(error, `项目名称"${deptForm.getFieldValue('name')}"已存在，请使用其他名称`)
        }
      }
    }
  ), [deptForm, validateWithZod, modal, createDeptMutation])

  const deleteDept = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteDeptMutation(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteDeptMutation])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (id: string, checked: boolean) => {
      await updateDeptMutation({ id, data: { active: checked ? 1 : 0 } })
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      onError: (error: any) => {
        handleConflictError(error, '项目名称已存在，请使用其他名称')
      }
    }
  ), [updateDeptMutation])

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'active',
      key: 'active',
      render: (v: number) => <StatusTag status={v === 1 ? 'active' : 'inactive'} statusMap={COMMON_STATUS} />,
    },
  ]

  return (
    <PageContainer
      title="项目管理"
      breadcrumb={[{ title: '系统设置' }, { title: '项目管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '项目名称', type: 'input', placeholder: '请输入项目名称' },
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

        <PageToolbar
          actions={canManageDepartments ? [{
            label: '新建项目',
            type: 'primary',
            onClick: () => {
              modal.openCreate()
              deptForm.resetFields()
            }
          }] : []}
          style={{ marginTop: 16 }}
        />

        <DataTable<Department>
          columns={columns}
          data={filteredDepartments}
          loading={isLoading}
          rowKey="id"
          actions={(record) => (
            <Space>
              {canManageDepartments && (
                <Switch
                  size="small"
                  checked={record.active === 1}
                  onChange={(checked) => handleToggleActive(record.id, checked)}
                />
              )}
              {canManageDepartments && (
                <Popconfirm
                  title={`确定要删除项目"${record.name}"吗？`}
                  description="删除后该项目将被永久删除。如果该项目下还有站点、员工或组织部门，将无法删除。"
                  onConfirm={() => deleteDept(record.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </Space>
          )}
          tableProps={{ className: 'table-striped', pagination: { pageSize: 20 } }}
        />

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
