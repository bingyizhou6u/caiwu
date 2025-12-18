import { useMemo, useState } from 'react'
import { Card, Button, Form, Input, Space, message, Popconfirm, Switch, InputNumber } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { DataTable, PageToolbar, StatusTag } from '../../../components/common'
import { COMMON_STATUS } from '../../../utils/status'
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

  // 过滤和排序数据
  const filteredDepartments = useMemo(() => {
    let result = deptData
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter((d: Department) => d.name.toLowerCase().includes(search))
    }
    if (searchParams.activeOnly === 'true') {
      result = result.filter((d: Department) => d.active === 1)
    } else if (searchParams.activeOnly === 'false') {
      result = result.filter((d: Department) => d.active === 0)
    }
    // 按排序字段排序（后端已排序，这里确保前端也按排序显示）
    result = [...result].sort((a, b) => {
      const sortA = a.sortOrder ?? 100
      const sortB = b.sortOrder ?? 100
      if (sortA !== sortB) {
        return sortA - sortB
      }
      return (a.name || '').localeCompare(b.name || '', 'zh-CN')
    })
    return result
  }, [deptData, searchParams])

  const createDept = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      await createDeptMutation({ ...v, active: v.active as any, sortOrder: v.sortOrder ?? 100 })
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

  const updateDept = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      if (!modal.data?.id) return
      await updateDeptMutation({ id: modal.data.id, data: { ...v, active: v.active as any } })
      modal.close()
      deptForm.resetFields()
    },
    {
      successMessage: '更新成功',
      onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : ''
        if (errorMessage !== '表单验证失败') {
          handleConflictError(error, `项目名称"${deptForm.getFieldValue('name')}"已存在，请使用其他名称`)
        }
      }
    }
  ), [deptForm, validateWithZod, modal, updateDeptMutation])

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
      await updateDeptMutation({ id, data: { active: (checked ? 1 : 0) as any } })
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
    { 
      title: '排序', 
      dataIndex: 'sortOrder', 
      key: 'sortOrder',
      width: 100,
      render: (sortOrder: number | undefined) => sortOrder ?? 100,
    },
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
                <Button
                  size="small"
                  onClick={() => {
                    modal.openEdit(record)
                    deptForm.setFieldsValue({
                      name: record.name,
                      active: record.active === 1,
                      sortOrder: record.sortOrder ?? 100,
                    })
                  }}
                >
                  编辑
                </Button>
              )}
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
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title={modal.isEdit ? '编辑项目' : '新建项目'}
          open={modal.isOpen}
          form={deptForm}
          onSubmit={modal.isEdit ? updateDept : createDept}
          onCancel={() => {
            modal.close()
            deptForm.resetFields()
          }}
        >
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" tooltip="数字越小越靠前，总部默认为0">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="默认100" />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
