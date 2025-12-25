import { useMemo, useCallback } from 'react'
import { Card, Button, Form, Input, Space, message, Select, Popconfirm, Switch, ColorPicker } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useSites, useCreateSite, useUpdateSite, useDeleteSite, useDepartmentOptions, useFormModal, useZodForm } from '../../../hooks'
import { siteSchema } from '../../../validations/site.schema'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'
import type { Site } from '../../../types'
import { DataTable, EmptyText, PageToolbar, StatusTag } from '../../../components/common'
import { COMMON_STATUS } from '../../../utils/status'
import type { DataTableColumn } from '../../../components/common/DataTable'
import { PageContainer } from '../../../components/PageContainer'

export function SiteManagement() {
  const { data: siteData = [], isLoading, refetch } = useSites()
  const { data: deptOptions = [] } = useDepartmentOptions(false) // 不包含总部，因为站点必须属于某个具体项目
  const { mutateAsync: createSite } = useCreateSite()
  const { mutateAsync: updateSite } = useUpdateSite()
  const { mutateAsync: deleteSiteMutation } = useDeleteSite()

  const modal = useFormModal<Site>()
  const { form, validateWithZod } = useZodForm(siteSchema)

  const { hasPermission, canManageSubordinates } = usePermissions()
  const canManageSites = hasPermission('site', 'site', 'create')

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      if (modal.isEdit && modal.data) {
        await updateSite({ id: modal.data.id, data: { ...v, active: v.active as any } })
      } else {
        await createSite({ ...v, active: v.active as any })
      }
      modal.close()
      form.resetFields()
    },
    {
      successMessage: modal.isEdit ? '更新成功' : '创建成功',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, '站点名称或编号已存在')
        }
      }
    }
  ), [modal, form, validateWithZod, createSite, updateSite])

  const deleteSite = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteSiteMutation(id)
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteSiteMutation])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (id: string, checked: boolean) => {
      await updateSite({ id, data: { active: (checked ? 1 : 0) as any } })
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '操作失败'
    }
  ), [updateSite])

  const handleEdit = useCallback((record: Site) => {
    modal.openEdit(record)
    form.setFieldsValue({
      departmentId: record.departmentId,
      name: record.name,
      siteCode: record.siteCode,
      themeStyle: record.themeStyle,
      themeColor: record.themeColor,
      frontendUrl: record.frontendUrl,
      active: record.active === 1
    })
  }, [modal, form])

  const handleCancel = useCallback(() => {
    modal.close()
    form.resetFields()
  }, [modal, form])

  return (
    <PageContainer
      title="站点管理"
      breadcrumb={[{ title: '站点管理' }, { title: '站点列表' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            ...(canManageSites ? [{
              label: '新建站点',
              type: 'primary' as const,
              onClick: () => {
                modal.openCreate()
                form.resetFields()
              }
            }] : []),
            {
              label: '刷新',
              onClick: () => refetch(),
              loading: isLoading
            }
          ]}
        />
        <DataTable<Site>
          columns={[
            { title: '站点名称', dataIndex: 'name', key: 'name', width: 120 },
            { title: '站点编号', dataIndex: 'siteCode', key: 'siteCode', width: 120, render: (v: string) => <EmptyText value={v} /> },
            { title: '版面风格', dataIndex: 'themeStyle', key: 'themeStyle', width: 120, render: (v: string) => <EmptyText value={v} /> },
            {
              title: '主题色',
              dataIndex: 'themeColor',
              key: 'themeColor',
              width: 100,
              render: (v: string) => v ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: v }} />
                  {v}
                </div>
              ) : <EmptyText value={v} />
            },
            {
              title: '前台网址', dataIndex: 'frontendUrl', key: 'frontendUrl', width: 200, render: (v: string) => v ? (
                <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>
              ) : <EmptyText value={v} />
            },
            {
              title: '所属项目', dataIndex: 'departmentId', key: 'departmentId', width: 120, render: (v: string) => {
                const dept = deptOptions.find((d: any) => d.value === v)
                return <EmptyText value={dept ? dept.label : null} />
              }
            },
            { title: '状态', dataIndex: 'active', key: 'active', width: 80, render: (v: number) => <StatusTag status={v === 1 ? 'active' : 'inactive'} statusMap={COMMON_STATUS} /> },
          ] as DataTableColumn<Site>[]}
          data={siteData}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped' }}
          actions={(r: Site) => (
            <Space>
              {canManageSites && (
                <>
                  <Button size="small" onClick={() => handleEdit(r)}>编辑</Button>
                  <Switch
                    size="small"
                    checked={r.active === 1}
                    onChange={(checked) => handleToggleActive(r.id, checked)}
                  />
                </>
              )}
              {canManageSubordinates && (
                <Popconfirm
                  title={`确定要删除站点"${r.name}"吗？`}
                  description="删除后该站点将被永久删除，此操作不可恢复。"
                  onConfirm={() => deleteSite(r.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </Space>
          )}
        />

        <FormModal
          title={modal.isEdit ? '编辑站点' : '新建站点'}
          open={modal.isOpen}
          form={form}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          width={600}
        >
          <Form.Item name="departmentId" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select
              showSearch
              placeholder="请选择所属项目"
              optionFilterProp="label"
              options={deptOptions}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="name" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input placeholder="请输入站点名称" />
          </Form.Item>
          <Form.Item name="siteCode" label="站点编号">
            <Input placeholder="请输入站点编号（可选）" />
          </Form.Item>
          <Form.Item name="themeStyle" label="版面风格">
            <Input placeholder="请输入版面风格" />
          </Form.Item>

          <Form.Item name="themeColor" label="主题色">
            <ColorPicker showText />
          </Form.Item>

          <Form.Item name="frontendUrl" label="前台网址">
            <Input placeholder="请输入前台网址（可选）" />
          </Form.Item>
        </FormModal>
      </Card>
    </PageContainer>
  )
}

