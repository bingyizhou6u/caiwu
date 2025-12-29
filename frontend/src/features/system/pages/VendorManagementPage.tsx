import { useMemo, useCallback, useState } from 'react'
import { Card, Button, Form, Input, Space, message, Popconfirm } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useBatchDeleteVendor, useFormModal, useZodForm } from '../../../hooks'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { DeleteOutlined } from '@ant-design/icons'
import { vendorSchema } from '../../../validations/vendor.schema'
import { FormModal } from '../../../components/FormModal'
import { DataTable, type DataTableColumn, PageToolbar, BatchActionButton, EmptyText } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import type { Vendor } from '../../../types'
import { PageContainer } from '../../../components/PageContainer'
import styles from '../../../components/common/common.module.css'

export function VendorManagement() {
  const { data: vendors = [], isLoading } = useVendors()
  const { mutateAsync: createVendor } = useCreateVendor()
  const { mutateAsync: updateVendor } = useUpdateVendor()
  const { mutateAsync: deleteVendor } = useDeleteVendor()
  const { mutateAsync: batchDeleteVendor } = useBatchDeleteVendor()

  const modal = useFormModal<Vendor>()
  const { form, validateWithZod } = useZodForm(vendorSchema)
  const [searchParams, setSearchParams] = useState<{ search?: string; activeOnly?: string }>({})

  const { hasPermission, canManageSubordinates } = usePermissions()
  const canEdit = hasPermission('system', 'vendor', 'create')
  const canDelete = canManageSubordinates

  const tableActions = useTableActions<Vendor>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteVendor,
    tableActions,
    {
      onSuccess: () => {
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  // 过滤数据
  const filteredVendors = useMemo(() => {
    let result = vendors
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase()
      result = result.filter((v: Vendor) => v.name.toLowerCase().includes(search))
    }
    if (searchParams.activeOnly === 'true') {
      result = result.filter((v: Vendor) => v.active === 1)
    }
    return result
  }, [vendors, searchParams])

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      if (modal.isEdit && modal.data) {
        await updateVendor({ id: modal.data.id, data: v })
      } else {
        await createVendor(v)
      }
      modal.close()
      form.resetFields()
    },
    {
      successMessage: modal.isEdit ? '更新成功' : '创建成功',
      onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : ''
        if (errorMessage !== '表单验证失败') {
          handleConflictError(error, '供应商名称', form.getFieldValue('name'))
        }
      }
    }
  ), [modal, form, validateWithZod, createVendor, updateVendor])

  const handleEdit = useCallback((record: Vendor) => {
    modal.openEdit(record)
    form.setFieldsValue({
      name: record.name,
      contact: record.contact
    })
  }, [modal, form])

  const handleDelete = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteVendor(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteVendor])

  const handleCancel = useCallback(() => {
    modal.close()
    form.resetFields()
  }, [modal, form])

  const columns: DataTableColumn<Vendor>[] = [
    { title: '供应商名称', dataIndex: 'name', key: 'name' },
    { title: '联系方式', dataIndex: 'contact', key: 'contact', render: (v: string) => <EmptyText value={v} /> },
  ]

  return (
    <PageContainer
      title="供应商管理"
      breadcrumb={[{ title: '财务管理' }, { title: '供应商管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '供应商名称', type: 'input', placeholder: '请输入供应商名称' },
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
          actions={[
            ...(canEdit ? [{
              label: '新建供应商',
              type: 'primary' as const,
              onClick: () => {
                modal.openCreate()
                form.resetFields()
              }
            }] : []),
            ...(canDelete ? [{
              component: (
                <BatchActionButton
                  label="批量删除"
                  selectedCount={selectedRowKeys.length}
                  onConfirm={handleBatchDelete}
                  icon={<DeleteOutlined />}
                  loading={batchDeleting}
                  confirmTitle={(count) => `确定要删除选中的 ${count} 个供应商吗？`}
                />
              )
            }] : [])
          ]}
          className={styles.mtMd}
        />

        <DataTable<Vendor>
          columns={columns}
          data={filteredVendors}
          loading={isLoading}
          rowKey="id"
          rowSelection={canDelete ? rowSelection : undefined}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canManageSubordinates ? (record) => handleDelete(record.id) : undefined}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title={modal.isEdit ? '编辑供应商' : '新建供应商'}
          open={modal.isOpen}
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
    </PageContainer>
  )
}

