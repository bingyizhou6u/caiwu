import { Table, Space, Button, message, Modal, Form, Input, Select, Tree, Card, Descriptions, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { api } from '../config/api'
import { apiGet, apiPost } from '../utils/api'
import type { DataNode } from 'antd/es/tree'

const ROLE_LABELS: Record<string, string> = {
  manager: '管理员',
  finance: '财务',
  hr: '人事',
  auditor: '审计',
  employee: '员工',
}

const MENU_LABELS: Record<string, string> = {
  'dashboard': '首页',
  'flows': '记账',
  'account-transactions': '账户明细查询',
  'import': '导入中心',
  'ar': '应收账款',
  'ap': '应付账款',
  'reports': '报表',
  'borrowing': '借款管理',
  'settings': '基础设置',
  'employees': '员工管理',
  'employee-salary': '员工薪资表',
  'salary-payments': '薪资发放管理',
  'employee-leave': '请假管理',
  'expense-reimbursement': '报销申请',
}

const ACTION_LABELS: Record<string, string> = {
  'read': '查看',
  'write': '编辑',
  'create': '创建',
  'delete': '删除',
}

export function RolePermissionsManagement() {
  const [roles, setRoles] = useState<any[]>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})

  const loadRoles = async () => {
    try {
      const data = await apiGet(api.rolePermissions)
      setRoles(data ?? [])
    } catch (error: any) {
      message.error(error.message || '加载失败')
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const handleEdit = (role: string) => {
    const roleData = roles.find((r: any) => r.role === role)
    if (!roleData) return
    
    setSelectedRole(role)
    const perms = typeof roleData.permissions === 'string' 
      ? JSON.parse(roleData.permissions) 
      : roleData.permissions
    
    editForm.setFieldsValue({
      role: roleData.role,
      description: roleData.description,
      permissions: perms.menus || {},
    })
    setPermissions(perms.menus || {})
    setEditOpen(true)
  }

  const handleSave = async () => {
    const values = await editForm.validateFields()
    const permissionsData = {
      menus: permissions,
      actions: {}
    }
    
    try {
      await apiPost(api.rolePermissions, {
        role: values.role,
        permissions: permissionsData,
        description: values.description,
      })
      message.success('保存成功')
      setEditOpen(false)
      loadRoles()
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const updatePermission = (menu: string, action: string, checked: boolean) => {
    const newPermissions = { ...permissions }
    if (!newPermissions[menu]) {
      newPermissions[menu] = []
    }
    
    if (checked) {
      if (!newPermissions[menu].includes(action)) {
        newPermissions[menu] = [...newPermissions[menu], action]
      }
    } else {
      newPermissions[menu] = newPermissions[menu].filter((a: string) => a !== action)
    }
    
    setPermissions(newPermissions)
  }

  const buildTreeData = (): DataNode[] => {
    const menus = Object.keys(MENU_LABELS)
    return menus.map(menu => ({
      title: MENU_LABELS[menu],
      key: menu,
      children: ['read', 'write', 'create', 'delete'].map(action => ({
        title: ACTION_LABELS[action],
        key: `${menu}:${action}`,
        isLeaf: true,
      })),
    }))
  }

  const checkedKeys = Object.keys(permissions).flatMap(menu => 
    permissions[menu].map((action: string) => `${menu}:${action}`)
  )

  const onCheck = (checkedKeysValue: any) => {
    const checked = Array.isArray(checkedKeysValue) ? checkedKeysValue : checkedKeysValue.checked
    const newPermissions: Record<string, string[]> = {}
    
    checked.forEach((key: string) => {
      const [menu, action] = key.split(':')
      if (menu && action) {
        if (!newPermissions[menu]) {
          newPermissions[menu] = []
        }
        newPermissions[menu].push(action)
      }
    })
    
    setPermissions(newPermissions)
  }

  return (
    <div>
      <Card 
        title="角色权限管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadRoles}>刷新</Button>
        }
      >
        <Table 
          rowKey="role" 
          dataSource={roles} 
          columns={[
            { title: '角色', dataIndex: 'role', render: (v: string) => ROLE_LABELS[v] || v },
            { title: '描述', dataIndex: 'description' },
            { title: '权限配置', dataIndex: 'permissions', render: (v: any) => {
              const perms = typeof v === 'string' ? JSON.parse(v) : v
              const menus = Object.keys(perms.menus || {})
              return (
                <Space wrap>
                  {menus.map((menu: string) => (
                    <Tag key={menu}>
                      {MENU_LABELS[menu] || menu}: {perms.menus[menu].join(', ')}
                    </Tag>
                  ))}
                </Space>
              )
            }},
            { title: '操作', render: (_: any, r: any) => (
              <Button size="small" onClick={() => handleEdit(r.role)}>编辑权限</Button>
            )},
          ]} 
        />
      </Card>

      <Modal
        title={`编辑权限：${selectedRole ? ROLE_LABELS[selectedRole] : ''}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        width={800}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="role" label="角色">
            <Input disabled />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item label="菜单权限">
            <Tree
              checkable
              checkedKeys={checkedKeys}
              onCheck={onCheck}
              treeData={buildTreeData()}
              defaultExpandAll
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

