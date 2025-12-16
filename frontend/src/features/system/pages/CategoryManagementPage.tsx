import { useMemo, useState } from 'react'
import { Card, Button, Input, Select, Space, message, Form } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { FormModal } from '../../../components/FormModal'
import { DataTable, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../../hooks/business/useCategories'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { categorySchema } from '../../../validations/category.schema'
import type { Category } from '../../../types'
import { PageContainer } from '../../../components/PageContainer'

const KIND_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
}

export function CategoryManagement() {
  const { data: data = [], isLoading, refetch } = useCategories()
  const { mutateAsync: createCategory } = useCreateCategory()
  const { mutateAsync: updateCategory } = useUpdateCategory()
  const { mutateAsync: deleteCategoryMutation } = useDeleteCategory()
  const [searchParams, setSearchParams] = useState<{ search?: string; kind?: string }>({})

  const { hasPermission } = usePermissions()
  const canManageCategory = hasPermission('finance', 'category', 'create')

  const { form, validateWithZod } = useZodForm(categorySchema)
  const {
    isOpen,
    data: editingRecord,
    openCreate,
    openEdit,
    close
  } = useFormModal<Category>()

  // 过滤数据
  const filteredCategories = useMemo(() => {
    let result = data
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(search))
    }
    if (searchParams.kind) {
      result = result.filter(c => c.kind === searchParams.kind)
    }
    return result
  }, [data, searchParams])

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      const values = await validateWithZod()
      try {
        if (editingRecord) {
          await updateCategory({ id: editingRecord.id, data: values })
          message.success('已更新')
        } else {
          await createCategory(values)
          message.success('已创建')
        }
        close()
        form.resetFields()
      } catch (error: any) {
        handleConflictError(error, `类别名称"${values.name}"已存在，请使用其他名称`)
        if (error.status !== 409) {
          throw error
        }
      }
    },
    {
      errorMessage: '操作失败'
    }
  ), [editingRecord, form, validateWithZod, close, createCategory, updateCategory])

  const deleteCategory = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteCategoryMutation(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteCategoryMutation])

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'kind', key: 'kind', render: (v: string) => KIND_LABELS[v] || v },
  ]

  return (
    <PageContainer
      title="类别管理"
      breadcrumb={[{ title: '财务管理' }, { title: '类别管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '类别名称', type: 'input', placeholder: '请输入类别名称' },
            {
              name: 'kind',
              label: '类型',
              type: 'select',
              placeholder: '请选择类型',
              options: [
                { label: '全部', value: '' },
                { value: 'income', label: '收入' },
                { value: 'expense', label: '支出' },
              ],
            },
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <PageToolbar
          actions={[
            {
              label: '新建类别',
              type: 'primary',
              onClick: () => { openCreate(); form.setFieldsValue({ kind: 'income' }) }
            },
            {
              label: '刷新',
              onClick: () => refetch()
            }
          ]}
          style={{ marginTop: 16 }}
        />

        <DataTable<Category>
          columns={columns}
          data={filteredCategories}
          loading={isLoading}
          rowKey="id"
          onEdit={canManageCategory ? (record) => {
            openEdit(record)
            form.setFieldsValue({ name: record.name, kind: record.kind })
          } : undefined}
          onDelete={canManageCategory ? (record) => deleteCategory(record.id) : undefined}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title={editingRecord ? `编辑：${editingRecord.name}` : '新建类别'}
          open={isOpen}
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => {
            close()
            form.resetFields()
          }}
        >
          <Form.Item
            name="name"
            label="名称"
            required
            validateStatus={form.getFieldError('name').length > 0 ? 'error' : ''}
            help={form.getFieldError('name')[0]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="kind"
            label="类型"
            required
            validateStatus={form.getFieldError('kind').length > 0 ? 'error' : ''}
            help={form.getFieldError('kind')[0]}
          >
            <Select options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }]} />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}
