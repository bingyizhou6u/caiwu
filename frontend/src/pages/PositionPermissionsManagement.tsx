import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, message, Select, Popconfirm, Tag, Switch, Space, TreeSelect, Checkbox } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api'

const { Option } = Select
const { TextArea } = Input

const LEVEL_OPTIONS = [
  { value: 'hq', label: '总部' },
  { value: 'project', label: '项目' },
  { value: 'department', label: '部门' },
  { value: 'group', label: '组' },
  { value: 'employee', label: '员工' },
]

const SCOPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'hq_all', label: '总部+所有项目' },
  { value: 'project_all', label: '项目全部' },
  { value: 'project_dept', label: '项目部门' },
  { value: 'dept', label: '部门' },
  { value: 'group', label: '组' },
  { value: 'self', label: '自己' },
]

// 所有菜单项
const MENU_ITEMS = [
  { key: 'dashboard', label: '首页' },
  { key: 'flows', label: '收支记账' },
  { key: 'account-transfer', label: '账户转账' },
  { key: 'account-transactions', label: '账户明细' },
  { key: 'import', label: '数据导入' },
  { key: 'ar', label: '应收账款' },
  { key: 'ap', label: '应付账款' },
  { key: 'employees', label: '人员管理' },
  { key: 'employee-salary', label: '员工薪资报表' },
  { key: 'salary-payments', label: '薪资发放管理' },
  { key: 'allowance-payments', label: '补贴发放管理' },
  { key: 'employee-leave', label: '请假管理' },
  { key: 'expense-reimbursement', label: '报销管理' },
  { key: 'fixed-assets', label: '资产列表' },
  { key: 'fixed-asset-purchase', label: '资产买入' },
  { key: 'fixed-asset-sale', label: '资产卖出' },
  { key: 'fixed-asset-allocation', label: '资产分配' },
  { key: 'rental-management', label: '租房管理' },
  { key: 'borrowings', label: '借款管理' },
  { key: 'repayments', label: '还款管理' },
  { key: 'department', label: '项目管理' },
  { key: 'org-department', label: '部门管理' },
  { key: 'category', label: '类别管理' },
  { key: 'account', label: '账户管理' },
  { key: 'currency', label: '币种管理' },
  { key: 'vendor', label: '供应商管理' },
  { key: 'reports', label: '报表中心' },
  { key: 'email-notification', label: '邮件提醒设置' },
  { key: 'ip-whitelist', label: 'IP白名单' },
  { key: 'audit', label: '审计日志' },
]

const ACTION_OPTIONS = [
  { value: 'employee', label: '人员管理' },
  { value: 'finance', label: '财务管理' },
  { value: 'admin', label: '行政管理' },
  { value: 'group', label: '组管理' },
  { value: 'self', label: '自己' },
]

export function PositionPermissionsManagement() {
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<any>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const loadPositions = async () => {
    setLoading(true)
    try {
      // apiGet 返回的是数组，不是 { results: [] } 格式
      const results = await apiGet(api.positionPermissions)
      setPositions(results)
      if (results.length === 0) {
        message.warning('暂无职位数据')
      }
    } catch (error: any) {
      console.error('Failed to load positions:', error)
      message.error(error.message || '加载职位列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPositions()
  }, [])

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields()
      // 处理权限配置
      const permissions: any = {
        menus: {},
        actions: {},
        reports: values.reports || false,
      }

      // 处理菜单权限
      if (values.menuPermissions && Array.isArray(values.menuPermissions)) {
        values.menuPermissions.forEach((item: any) => {
          if (item.menu && item.actions && item.actions.length > 0) {
            permissions.menus[item.menu] = item.actions
          }
        })
      }

      // 处理操作权限
      if (values.actionPermissions) {
        values.actionPermissions.forEach((action: string) => {
          permissions.actions[action] = true
        })
      }

      // 如果有全部权限
      if (values.allMenus) {
        permissions.menus['*'] = ['read', 'write', 'create', 'delete']
      }
      if (values.allActions) {
        permissions.actions['*'] = true
      }

      await apiPost(api.positionPermissions, {
        ...values,
        permissions,
      })
      message.success('创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      loadPositions()
    } catch (error: any) {
      message.error(error.message || '创建失败')
    }
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      // 处理权限配置
      const permissions: any = {
        menus: {},
        actions: {},
        reports: values.reports || false,
      }

      // 处理菜单权限
      if (values.menuPermissions && Array.isArray(values.menuPermissions)) {
        values.menuPermissions.forEach((item: any) => {
          if (item.menu && item.actions && item.actions.length > 0) {
            permissions.menus[item.menu] = item.actions
          }
        })
      }

      // 处理操作权限
      if (values.actionPermissions) {
        values.actionPermissions.forEach((action: string) => {
          permissions.actions[action] = true
        })
      }

      // 如果有全部权限
      if (values.allMenus) {
        permissions.menus['*'] = ['read', 'write', 'create', 'delete']
      }
      if (values.allActions) {
        permissions.actions['*'] = true
      }

      await apiPut(api.positionPermissionsById(currentPosition.id), {
        ...values,
        permissions,
      })
      message.success('更新成功')
      setEditOpen(false)
      setCurrentPosition(null)
      editForm.resetFields()
      loadPositions()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(api.positionPermissionsById(id))
      message.success('删除成功')
      loadPositions()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const openEditModal = (position: any) => {
    setCurrentPosition(position)
    const permissions = typeof position.permissions === 'string' 
      ? JSON.parse(position.permissions) 
      : position.permissions || {}
    
    const menuPermissions: any[] = []
    if (permissions.menus) {
      if (permissions.menus['*']) {
        // 如果有全部权限，不显示菜单权限列表
      } else {
        Object.keys(permissions.menus).forEach((key) => {
          menuPermissions.push({
            menu: key,
            actions: permissions.menus[key]
          })
        })
      }
    }

    editForm.setFieldsValue({
      code: position.code,
      name: position.name,
      level: position.level,
      scope: position.scope,
      description: position.description,
      sort_order: position.sort_order,
      active: position.active === 1,
      reports: permissions.reports || false,
      allMenus: !!permissions.menus?.['*'],
      allActions: !!permissions.actions?.['*'],
      menuPermissions,
      actionPermissions: permissions.actions && permissions.actions['*'] 
        ? ['*'] 
        : Object.keys(permissions.actions || {}).filter(k => permissions.actions[k] === true),
    })
    setEditOpen(true)
  }

  const columns: ColumnsType<any> = [
    { title: '职位代码', dataIndex: 'code', width: 150 },
    { title: '职位名称', dataIndex: 'name', width: 150 },
    { 
      title: '层级', 
      dataIndex: 'level', 
      width: 100,
      render: (v: string) => LEVEL_OPTIONS.find(o => o.value === v)?.label || v
    },
    { 
      title: '权限范围', 
      dataIndex: 'scope', 
      width: 120,
      render: (v: string) => SCOPE_OPTIONS.find(o => o.value === v)?.label || v
    },
    {
      title: '权限配置',
      dataIndex: 'permissions',
      width: 200,
      render: (v: any) => {
        const perms = typeof v === 'string' ? JSON.parse(v) : v
        const menusCount = perms.menus?.['*'] ? '全部菜单' : Object.keys(perms.menus || {}).length
        const actionsCount = perms.actions?.['*'] ? '全部操作' : Object.keys(perms.actions || {}).filter((k: string) => perms.actions[k]).length
        const reports = perms.reports ? '可查看报表' : ''
        return (
          <div>
            <div>菜单: {menusCount}</div>
            <div>操作: {actionsCount}</div>
            {reports && <div>{reports}</div>}
          </div>
        )
      }
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { 
      title: '状态', 
      dataIndex: 'active', 
      width: 80,
      render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm
            title="确定要删除此职位吗？"
            description="删除前请确保没有员工或用户使用此职位"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="权限管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPositions} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setCreateOpen(true)
            createForm.resetFields()
          }}>
            新建职位
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={positions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: positions.length === 0 && !loading ? '暂无职位数据，请点击"新建职位"创建' : '暂无数据' }}
      />

      {/* 新建职位Modal */}
      <Modal
        title="新建职位"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
        }}
        width={800}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label="职位代码" rules={[{ required: true, message: '请输入职位代码' }]}>
            <Input placeholder="例如：hq_admin" />
          </Form.Item>
          <Form.Item name="name" label="职位名称" rules={[{ required: true, message: '请输入职位名称' }]}>
            <Input placeholder="例如：总部负责人" />
          </Form.Item>
          <Form.Item name="level" label="层级" rules={[{ required: true, message: '请选择层级' }]}>
            <Select placeholder="选择层级">
              {LEVEL_OPTIONS.map(o => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scope" label="权限范围" rules={[{ required: true, message: '请选择权限范围' }]}>
            <Select placeholder="选择权限范围">
              {SCOPE_OPTIONS.map(o => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="职位描述" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reports" valuePropName="checked" initialValue={false}>
            <Checkbox>可查看报表</Checkbox>
          </Form.Item>
          <Form.Item name="allMenus" valuePropName="checked" initialValue={false}>
            <Checkbox>全部菜单权限</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.allMenus !== currentValues.allMenus}>
            {({ getFieldValue }) => {
              const allMenus = getFieldValue('allMenus')
              if (allMenus) return null
              return (
                <Form.Item name="menuPermissions" label="菜单权限">
                  <Form.List name="menuPermissions">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'menu']} rules={[{ required: true }]}>
                              <Select placeholder="选择菜单" style={{ width: 200 }}>
                                {MENU_ITEMS.map(m => (
                                  <Option key={m.key} value={m.key}>{m.label}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'actions']} rules={[{ required: true }]}>
                              <Select mode="multiple" placeholder="选择操作" style={{ width: 200 }}>
                                <Option value="read">查看</Option>
                                <Option value="write">编辑</Option>
                                <Option value="create">创建</Option>
                                <Option value="delete">删除</Option>
                              </Select>
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger>删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                            添加菜单权限
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="allActions" valuePropName="checked" initialValue={false}>
            <Checkbox>全部操作权限</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.allActions !== currentValues.allActions}>
            {({ getFieldValue }) => {
              const allActions = getFieldValue('allActions')
              if (allActions) return null
              return (
                <Form.Item name="actionPermissions" label="操作权限">
                  <Select mode="multiple" placeholder="选择操作权限">
                    {ACTION_OPTIONS.map(o => (
                      <Option key={o.value} value={o.value}>{o.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑职位Modal */}
      <Modal
        title="编辑职位"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditOpen(false)
          setCurrentPosition(null)
          editForm.resetFields()
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="code" label="职位代码" rules={[{ required: true, message: '请输入职位代码' }]}>
            <Input placeholder="例如：hq_admin" />
          </Form.Item>
          <Form.Item name="name" label="职位名称" rules={[{ required: true, message: '请输入职位名称' }]}>
            <Input placeholder="例如：总部负责人" />
          </Form.Item>
          <Form.Item name="level" label="层级" rules={[{ required: true, message: '请选择层级' }]}>
            <Select placeholder="选择层级">
              {LEVEL_OPTIONS.map(o => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scope" label="权限范围" rules={[{ required: true, message: '请选择权限范围' }]}>
            <Select placeholder="选择权限范围">
              {SCOPE_OPTIONS.map(o => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="职位描述" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="active" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="reports" valuePropName="checked">
            <Checkbox>可查看报表</Checkbox>
          </Form.Item>
          <Form.Item name="allMenus" valuePropName="checked">
            <Checkbox>全部菜单权限</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.allMenus !== currentValues.allMenus}>
            {({ getFieldValue }) => {
              const allMenus = getFieldValue('allMenus')
              if (allMenus) return null
              return (
                <Form.Item name="menuPermissions" label="菜单权限">
                  <Form.List name="menuPermissions">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'menu']} rules={[{ required: true }]}>
                              <Select placeholder="选择菜单" style={{ width: 200 }}>
                                {MENU_ITEMS.map(m => (
                                  <Option key={m.key} value={m.key}>{m.label}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'actions']} rules={[{ required: true }]}>
                              <Select mode="multiple" placeholder="选择操作" style={{ width: 200 }}>
                                <Option value="read">查看</Option>
                                <Option value="write">编辑</Option>
                                <Option value="create">创建</Option>
                                <Option value="delete">删除</Option>
                              </Select>
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger>删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                            添加菜单权限
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="allActions" valuePropName="checked">
            <Checkbox>全部操作权限</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.allActions !== currentValues.allActions}>
            {({ getFieldValue }) => {
              const allActions = getFieldValue('allActions')
              if (allActions) return null
              return (
                <Form.Item name="actionPermissions" label="操作权限">
                  <Select mode="multiple" placeholder="选择操作权限">
                    {ACTION_OPTIONS.map(o => (
                      <Option key={o.value} value={o.value}>{o.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

