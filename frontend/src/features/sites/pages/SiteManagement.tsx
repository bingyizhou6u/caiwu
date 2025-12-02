import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Switch } from 'antd'
import { api } from '../../../config/api'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../../../utils/api'
import { loadDepartments } from '../../../utils/loaders'
import { usePermissions } from '../../../utils/permissions'

export function SiteManagement() {
  const [siteData, setSiteData] = useState<any[]>([])
  const [deptData, setDeptData] = useState<any[]>([])
  const [siteOpen, setSiteOpen] = useState(false)
  const [siteEditOpen, setSiteEditOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<any>(null)
  const [siteForm] = Form.useForm()
  const [siteEditForm] = Form.useForm()
  
  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canManageSites = hasPermission('site', 'site', 'create')

  const loadSite = async () => {
    const data = await apiGet(api.sites)
    setSiteData(data ?? [])
  }

  const loadDept = async () => {
    const data = await loadDepartments()
    setDeptData(data.map(d => ({ id: d.value as string, name: d.label })))
  }

  useEffect(() => {
    const loadMasterData = async () => {
      await Promise.all([loadSite(), loadDept()])
    }
    loadMasterData()
  }, [])

  const createSite = async () => {
    const v = await siteForm.validateFields()
    try {
      await apiPost(api.sites, v)
      message.success('创建成功')
      setSiteOpen(false)
      siteForm.resetFields()
      loadSite()
    } catch (error: any) {
      message.error(error.message || '创建失败')
    }
  }

  const editSite = async () => {
    const v = await siteEditForm.validateFields()
    try {
      await apiPut(`${api.sites}/${editingSite.id}`, v)
      message.success('更新成功')
      setSiteEditOpen(false)
      setEditingSite(null)
      siteEditForm.resetFields()
      loadSite()
    } catch (error: any) {
      handleConflictError(error, '站点名称或编号已存在')
    }
  }

  const deleteSite = async (id: string, name: string) => {
    try {
      await apiDelete(`${api.sites}/${id}`)
      message.success('删除成功')
      loadSite()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  return (
    <Card title="站点管理">
      <Space style={{ marginBottom: 12 }}>
        {canManageSites && (
          <Button type="primary" onClick={() => setSiteOpen(true)}>新建站点</Button>
        )}
        <Button onClick={loadSite}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={siteData} columns={[
        { title: '站点名称', dataIndex: 'name', width: 120 },
        { title: '站点编号', dataIndex: 'site_code', width: 120, render: (v: string) => v || '-' },
        { title: '版面风格', dataIndex: 'theme_style', width: 120, render: (v: string) => v || '-' },
        { title: '版面颜色', dataIndex: 'theme_color', width: 120, render: (v: string) => v ? (
          <span style={{ display: 'inline-block', width: 20, height: 20, backgroundColor: v, border: '1px solid #ddd', borderRadius: 2 }} /> 
        ) : '-' },
        { title: '前台网址', dataIndex: 'frontend_url', width: 200, render: (v: string) => v ? (
          <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>
        ) : '-' },
        { title: '所属项目', dataIndex: 'department_id', width: 120, render: (v: string) => {
          const dept = deptData.find((d: any) => d.id === v)
          return dept ? dept.name : '-'
        }},
        { title: '状态', dataIndex: 'active', width: 80, render: (v: number) => v ? '启用' : '禁用' },
        { title: '操作', width: 150, render: (_:any, r:any)=> (
          <Space>
            {canManageSites && (
              <>
                <Button size="small" onClick={() => {
                  setEditingSite(r)
                  siteEditForm.setFieldsValue({
                    department_id: r.department_id,
                    name: r.name,
                    site_code: r.site_code,
                    theme_style: r.theme_style,
                    theme_color: r.theme_color,
                    frontend_url: r.frontend_url
                  })
                  setSiteEditOpen(true)
                }}>编辑</Button>
                <Switch 
                  size="small" 
                  checked={r.active === 1}
                  onChange={async (checked) => {
                    try {
                      await apiPut(`${api.sites}/${r.id}`, { active: checked ? 1 : 0 })
                      message.success(checked ? '已启用' : '已停用')
                      loadSite()
                    } catch (error: any) {
                      message.error(error.message || '操作失败')
                    }
                  }}
                />
              </>
            )}
            {isManager && (
              <Popconfirm
                title={`确定要删除站点"${r.name}"吗？`}
                description="删除后该站点将被永久删除，此操作不可恢复。"
                onConfirm={() => deleteSite(r.id, r.name)}
                okText="确定"
                cancelText="取消"
              >
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            )}
          </Space>
        )},
      ]} pagination={{ pageSize: 20 }} />

      {/* 新建站点 */}
      <Modal title="新建站点" open={siteOpen} onOk={createSite} onCancel={() => {
        setSiteOpen(false)
        siteForm.resetFields()
      }} width={600}>
        <Form form={siteForm} layout="vertical">
          <Form.Item name="department_id" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select
              showSearch
              placeholder="请选择所属项目"
              optionFilterProp="label"
              options={deptData.map((d:any)=>({ value: d.id, label: d.name }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="name" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input placeholder="请输入站点名称" />
          </Form.Item>
          <Form.Item name="site_code" label="站点编号">
            <Input placeholder="请输入站点编号（可选）" />
          </Form.Item>
          <Form.Item name="theme_style" label="版面风格">
            <Input placeholder="请输入版面风格（可选）" />
          </Form.Item>
          <Form.Item name="theme_color" label="版面颜色">
            <Input type="color" placeholder="选择版面颜色（可选）" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="frontend_url" label="前台网址">
            <Input placeholder="请输入前台网址（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑站点 */}
      <Modal title="编辑站点" open={siteEditOpen} onOk={editSite} onCancel={() => {
        setSiteEditOpen(false)
        setEditingSite(null)
        siteEditForm.resetFields()
      }} width={600}>
        <Form form={siteEditForm} layout="vertical">
          <Form.Item name="department_id" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select
              showSearch
              placeholder="请选择所属项目"
              optionFilterProp="label"
              options={deptData.map((d:any)=>({ value: d.id, label: d.name }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="name" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input placeholder="请输入站点名称" />
          </Form.Item>
          <Form.Item name="site_code" label="站点编号">
            <Input placeholder="请输入站点编号（可选）" />
          </Form.Item>
          <Form.Item name="theme_style" label="版面风格">
            <Input placeholder="请输入版面风格（可选）" />
          </Form.Item>
          <Form.Item name="theme_color" label="版面颜色">
            <Input type="color" placeholder="选择版面颜色（可选）" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="frontend_url" label="前台网址">
            <Input placeholder="请输入前台网址（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

