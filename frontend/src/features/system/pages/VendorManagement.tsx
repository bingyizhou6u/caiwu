import { useMemo, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Popconfirm } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useVendors, useFormModal, useZodForm } from '../../../hooks'
import { useBatchDeleteVendor } from '../../../hooks/business/useVendors'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { DeleteOutlined } from '@ant-design/icons'
import { vendorSchema } from '../../../validations/vendor.schema'
import { FormModal } from '../../../components/FormModal'
import { ActionColumn } from '../../../components/ActionColumn'
import { usePermissions } from '../../../utils/permissions'
import type { Vendor } from '../../../types'

import { PageContainer } from '../../../components/PageContainer'

export function VendorManagement() {
  const { data: vendors = [], isLoading, refetch } = useVendors()
  const modal = useFormModal<Vendor>()
  const { form, validateWithZod } = useZodForm(vendorSchema)

  const { hasPermission, isManager } = usePermissions()
  const canEdit = hasPermission('system', 'vendor', 'create')
  const canDelete = isManager()

  const { mutateAsync: batchDeleteVendor } = useBatchDeleteVendor()
  const tableActions = useTableActions<Vendor>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteVendor,
    tableActions,
    {
      onSuccess: () => {
        refetch()
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      if (modal.isEdit && modal.data) {
        await apiClient.put(`${api.vendors}/${modal.data.id}`, v)
      } else {
        await apiClient.post(api.vendors, v)
      }
      modal.close()
      form.resetFields()
      refetch()
    },
    {
      successMessage: modal.isEdit ? '更新成功' : '创建成功',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, '供应商名称', form.getFieldValue('name'))
        }
      }
    }
  ), [modal, form, validateWithZod, refetch])

  const handleEdit = useCallback((record: Vendor) => {
    modal.openEdit(record)
    form.setFieldsValue({
      name: record.name,
      contact: record.contact
    })
  }, [modal, form])

  const handleDelete = useCallback(async (id: string, name: string) => {
    try {
      await apiClient.delete(`${api.vendors}/${id}`)
      message.success('删除成功')
      refetch()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [refetch])

  const handleCancel = useCallback(() => {
    modal.close()
    form.resetFields()
  }, [modal, form])

  return (
    <PageContainer
      title="供应商管理"
      breadcrumb={[{ title: '系统设置' }, { title: '供应商管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          {canEdit && (
            <Button type="primary" onClick={() => {
              modal.openCreate()
              form.resetFields()
            }}>新建供应商</Button>
          )}
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
          {canDelete && (
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              loading={batchDeleting}
            >
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 个供应商吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0}
              >
                <span>批量删除 ({selectedRowKeys.length})</span>
              </Popconfirm>
            </Button>
          )}
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          dataSource={vendors}
          loading={isLoading}
          rowSelection={canDelete ? rowSelection : undefined}
          columns={[
            { title: '供应商名称', dataIndex: 'name' },
            { title: '联系方式', dataIndex: 'contact' },
            {
              title: '操作',
              render: (_: unknown, r: Vendor) => (
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
          ]}
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

