import { useMemo, useCallback } from 'react'
import { Card, Table, Button, Form, Input, Space, message, Select, Popconfirm, Switch, ColorPicker } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useSites, useDepartmentOptions, useFormModal, useZodForm } from '../../../hooks'
import { siteSchema } from '../../../validations/site.schema'
import { FormModal } from '../../../components/FormModal'
import { usePermissions } from '../../../utils/permissions'
import type { Site } from '../../../types'

import { PageContainer } from '../../../components/PageContainer'

export function SiteManagement() {
  const { data: siteData = [], isLoading, refetch } = useSites()
  const { data: deptOptions = [] } = useDepartmentOptions(false) // 不包含总部，因为站点必须属于某个具体项目

  const modal = useFormModal<Site>()
  const { form, validateWithZod } = useZodForm(siteSchema)

  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canManageSites = hasPermission('site', 'site', 'create')

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      const v = await validateWithZod()
      if (modal.isEdit && modal.data) {
        await apiClient.put(`${api.sites}/${modal.data.id}`, v)
      } else {
        await apiClient.post(api.sites, v)
      }
      modal.close()
      form.resetFields()
      refetch()
    },
    {
      successMessage: modal.isEdit ? '更新成功' : '创建成功',
      onError: (error: any) => {
        if (error.message !== '表单验证失败') {
          handleConflictError(error, '站点名称或编号已存在')
        }
      }
    }
  ), [modal, form, validateWithZod, refetch])

  const deleteSite = useMemo(() => withErrorHandler(
    async (id: string) => {
      await apiClient.delete(`${api.sites}/${id}`)
      refetch()
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [refetch])

  const handleToggleActive = useMemo(() => withErrorHandler(
    async (id: string, checked: boolean) => {
      await apiClient.put(`${api.sites}/${id}`, { active: checked ? 1 : 0 })
      refetch()
      return checked ? '已启用' : '已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '操作失败'
    }
  ), [refetch])

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
        <Space style={{ marginBottom: 12 }}>
          {canManageSites && (
            <Button type="primary" onClick={() => {
              modal.openCreate()
              form.resetFields()
            }}>新建站点</Button>
          )}
          <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          loading={isLoading}
          dataSource={siteData}
          columns={[
            { title: '站点名称', dataIndex: 'name', width: 120 },
            { title: '站点编号', dataIndex: 'siteCode', width: 120, render: (v: string) => v || '-' },
            { title: '版面风格', dataIndex: 'themeStyle', width: 120, render: (v: string) => v || '-' },
            {
              title: '主题色',
              dataIndex: 'themeColor',
              width: 100,
              render: (v: string) => v ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: v }} />
                  {v}
                </div>
              ) : '-'
            },
            {
              title: '前台网址', dataIndex: 'frontendUrl', width: 200, render: (v: string) => v ? (
                <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>
              ) : '-'
            },
            {
              title: '所属项目', dataIndex: 'departmentId', width: 120, render: (v: string) => {
                const dept = deptOptions.find((d: any) => d.value === v)
                return dept ? dept.label : '-'
              }
            },
            { title: '状态', dataIndex: 'active', width: 80, render: (v: number) => v ? '启用' : '禁用' },
            {
              title: '操作', width: 150, render: (_: unknown, r: Site) => (
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
                  {isManager && (
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
              )
            },
          ]}
          pagination={{ pageSize: 20 }}
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

