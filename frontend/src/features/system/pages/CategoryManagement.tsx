import { useMemo } from 'react'
import { Card, Table, Button, Input, Select, Space, message, Form } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { ActionColumn } from '../../../components/ActionColumn'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../../hooks/business/useCategories'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { categorySchema } from '../../../validations/category.schema'
import type { Category } from '../../../types'

const KIND_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
}

import { PageContainer } from '../../../components/PageContainer'

export function CategoryManagement() {
  const { data: data = [], isLoading, refetch } = useCategories()
  const { mutateAsync: createCategory } = useCreateCategory()
  const { mutateAsync: updateCategory } = useUpdateCategory()
  const { mutateAsync: deleteCategoryMutation } = useDeleteCategory()

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

  return (
    <PageContainer
      title="类别管理"
      breadcrumb={[{ title: '系统设置' }, { title: '类别管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => { openCreate(); form.setFieldsValue({ kind: 'income' }) }}>新建类别</Button>
          <Button onClick={() => refetch()}>刷新</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'kind', render: (v: string) => KIND_LABELS[v] || v },
            {
              title: '操作',
              render: (_: unknown, r: Category) => (
                <ActionColumn
                  record={r}
                  canEdit={canManageCategory}
                  canDelete={canManageCategory}
                  onEdit={() => { openEdit(r); form.setFieldsValue({ name: r.name, kind: r.kind }) }}
                  onDelete={(id) => deleteCategory(id)}
                  deleteDescription="删除后该类别将被永久删除，如果有流水使用该类别，将无法删除。"
                />
              )
            },
          ]}
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
