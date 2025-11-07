import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Popconfirm, Switch, Select } from 'antd'
import { api } from '../config/api'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api'
import { loadDepartments } from '../utils/loaders'

interface OrgDepartment {
  id: string
  project_id: string | null
  project_name?: string
  display_project_name?: string
  parent_id?: string
  parent_name?: string
  name: string
  code?: string
  description?: string
  active: number
  sort_order: number
  created_at: number
  updated_at?: number
}

interface Project {
  id: string
  name: string
}

export function OrgDepartmentManagement({ userRole }: { userRole?: string }) {
  const [deptData, setDeptData] = useState<OrgDepartment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [orgDepartments, setOrgDepartments] = useState<OrgDepartment[]>([])
  const [deptOpen, setDeptOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<OrgDepartment | null>(null)
  const [deptForm] = Form.useForm()
  const [selectedProject, setSelectedProject] = useState<string>('')
  const isManager = userRole === 'manager'
  const canEdit = isManager || userRole === 'finance' || userRole === 'auditor'

  const loadProjectsData = async () => {
    const data = await loadDepartments()
    setProjects(data.map(d => ({ id: d.value as string, name: d.label })))
    // 默认不选择任何项目，显示所有部门
  }

  const loadDepts = async () => {
    try {
      let url = api.orgDepartments
      if (selectedProject === 'hq') {
        url = `${api.orgDepartments}?project_id=hq`
      } else if (selectedProject) {
        url = `${api.orgDepartments}?project_id=${selectedProject}`
      }
      const data = await apiGet<OrgDepartment>(url)
      setDeptData(data ?? [])
    } catch (error: any) {
      message.error(error.message || '加载失败')
    }
  }

  const loadOrgDepartments = async (projectId: string | null | 'hq') => {
    if (!projectId || projectId === '') {
      setOrgDepartments([])
      return
    }
    try {
      let url = api.orgDepartments
      if (projectId === 'hq') {
        url = `${api.orgDepartments}?project_id=hq`
      } else {
        url = `${api.orgDepartments}?project_id=${projectId}`
      }
      const data = await apiGet<OrgDepartment>(url)
      setOrgDepartments(data ?? [])
    } catch (error: any) {
      message.error(`加载部门列表失败: ${error.message || '网络错误'}`)
      setOrgDepartments([])
    }
  }

  useEffect(() => {
    loadProjectsData()
  }, [])

  useEffect(() => {
    loadDepts()
  }, [selectedProject])

  const handleCreate = () => {
    setEditingDept(null)
    deptForm.resetFields()
    if (selectedProject) {
      deptForm.setFieldsValue({ project_id: selectedProject })
      if (selectedProject === 'hq') {
        loadOrgDepartments('hq')
      } else {
        loadOrgDepartments(selectedProject)
      }
    }
    setDeptOpen(true)
  }

  const handleEdit = (dept: OrgDepartment) => {
    setEditingDept(dept)
    deptForm.setFieldsValue({
      project_id: dept.project_id || 'hq',  // 总部显示为'hq'
      parent_id: dept.parent_id || undefined,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      sort_order: dept.sort_order,
    })
    // 加载该项目或总部的部门列表
    if (dept.project_id) {
      loadOrgDepartments(dept.project_id)
    } else {
      loadOrgDepartments('hq')
    }
    setDeptOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await deptForm.validateFields()
      // 处理project_id：如果选择'hq'，转换为null
      if (values.project_id === 'hq') {
        values.project_id = null
      }
      if (editingDept) {
        await apiPut(`${api.orgDepartments}/${editingDept.id}`, values)
        message.success('更新成功')
      } else {
        await apiPost(api.orgDepartments, values)
        message.success('创建成功')
      }
      setDeptOpen(false)
      deptForm.resetFields()
      setEditingDept(null)
      setOrgDepartments([])
      loadDepts()
    } catch (error: any) {
      if (error.status === 409 || error.message?.includes('duplicate')) {
        message.error('同级部门名称已存在，请使用其他名称')
      } else {
        message.error(error.message || '操作失败')
      }
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      await apiDelete(`${api.orgDepartments}/${id}`)
      message.success('删除成功')
      loadDepts()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const handleToggleActive = async (dept: OrgDepartment) => {
    try {
      await apiPut(`${api.orgDepartments}/${dept.id}`, { active: dept.active === 1 ? 0 : 1 })
      message.success(dept.active === 1 ? '已停用' : '已启用')
      loadDepts()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  // 获取可选父部门列表（排除自身及其子部门，且必须属于同一项目或总部）
  const getAvailableParents = (excludeId?: string, projectId?: string | null): OrgDepartment[] => {
    const exclude = (dept: OrgDepartment): boolean => {
      if (excludeId && dept.id === excludeId) return true
      if (excludeId && dept.parent_id === excludeId) return true
      return false
    }
    const targetProjectId = projectId || null
    return deptData.filter(dept => {
      if (exclude(dept)) return false
      if (dept.active !== 1) return false
      // 必须属于同一项目或总部
      return (dept.project_id || null) === targetProjectId
    })
  }

  return (
    <Card title="部门管理">
      <Space style={{ marginBottom: 16 }} direction="vertical" size="large">
        <Space>
          <span>选择项目：</span>
          <Select
            style={{ width: 200 }}
            value={selectedProject}
            onChange={(value) => {
              setSelectedProject(value)
              if (value) {
                loadOrgDepartments(value === 'hq' ? 'hq' : value)
              }
            }}
            placeholder="选择项目或总部"
            allowClear
          >
            <Select.Option value="hq">总部</Select.Option>
            {projects.map(p => (
              <Select.Option key={p.id} value={p.id}>
                {p.name}
              </Select.Option>
            ))}
          </Select>
          {canEdit && (
            <Button type="primary" onClick={handleCreate} disabled={!selectedProject}>
              新建部门
            </Button>
          )}
          <Button onClick={loadDepts}>刷新</Button>
        </Space>
      </Space>

      {selectedProject && (
        <Table
          rowKey="id"
          dataSource={deptData}
          columns={[
              {
                title: '部门名称',
                dataIndex: 'name',
                render: (text, record) => (
                  <Space>
                    <span>{text}</span>
                    {record.parent_name && (
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        (父部门: {record.parent_name})
                      </span>
                    )}
                  </Space>
                ),
              },
              { title: '部门编码', dataIndex: 'code' },
              { title: '描述', dataIndex: 'description', ellipsis: true },
              { 
                title: '所属', 
                dataIndex: 'display_project_name',
                render: (text: string, record: OrgDepartment) => {
                  return text || (record.project_id ? record.project_name : '总部')
                }
              },
              {
                title: '排序',
                dataIndex: 'sort_order',
                width: 80,
              },
              {
                title: '状态',
                dataIndex: 'active',
                width: 80,
                render: (v: number) => (v ? '启用' : '停用'),
              },
              {
                title: '操作',
                width: 200,
                render: (_: any, r: OrgDepartment) => (
                  <Space>
                    {canEdit && (
                      <>
                        <Switch
                          size="small"
                          checked={r.active === 1}
                          onChange={() => handleToggleActive(r)}
                        />
                        <Button size="small" onClick={() => handleEdit(r)}>
                          编辑
                        </Button>
                      </>
                    )}
                    {isManager && (
                      <Popconfirm
                        title={`确定要删除部门"${r.name}"吗？`}
                        description="删除后该部门将被永久删除，如果有子部门或员工使用此部门，将无法删除。"
                        onConfirm={() => handleDelete(r.id, r.name)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
            pagination={{ pageSize: 20 }}
          />
      )}

      {/* 新建/编辑部门 */}
      <Modal
        title={editingDept ? '编辑部门' : '新建部门'}
        open={deptOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setDeptOpen(false)
          deptForm.resetFields()
          setEditingDept(null)
          setOrgDepartments([])
        }}
        width={600}
      >
        <Form form={deptForm} layout="vertical">
          <Form.Item name="project_id" label="所属项目/总部">
            <Select
              placeholder="选择项目或总部"
              allowClear
              disabled={!!editingDept}
              onChange={(value) => {
                if (value === 'hq') {
                  loadOrgDepartments('hq')
                  deptForm.setFieldsValue({ project_id: 'hq' })
                } else if (value) {
                  loadOrgDepartments(value)
                  deptForm.setFieldsValue({ project_id: value })
                } else {
                  setOrgDepartments([])
                  deptForm.setFieldsValue({ project_id: undefined })
                }
                deptForm.setFieldsValue({ parent_id: undefined })
              }}
            >
              <Select.Option value="hq">总部</Select.Option>
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="parent_id" label="父部门">
            <Select
              placeholder="不选择则创建顶级部门"
              allowClear
              disabled={!deptForm.getFieldValue('project_id')}
              options={orgDepartments.filter(d => {
                // 排除自身
                if (editingDept?.id && d.id === editingDept.id) return false
                // 排除自己的子部门
                if (editingDept?.id && d.parent_id === editingDept.id) return false
                // 只显示启用的部门
                return d.active === 1
              }).map(d => ({
                label: d.name,
                value: d.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="例如：人事部、开发部" />
          </Form.Item>
          <Form.Item name="code" label="部门编码" rules={[{ required: true, message: '请输入部门编码' }]}>
            <Input placeholder="例如：HR、FIN、ADM、DEV" />
          </Form.Item>
          <Form.Item name="description" label="部门描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" initialValue={0}>
            <Input type="number" min={0} placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

