import { useState, useMemo, useEffect } from 'react'
import { Card, Tag, Space, Collapse, Button, Checkbox, Form, message, Switch, Popconfirm, Select, Divider } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { DataTable, PageToolbar, StatusTag } from '../../../components/common'
import type { DataTableColumn } from '../../../components/common/DataTable'
// ActionColumn removed - using DataTable's built-in onEdit instead
import { FormModal } from '../../../components/FormModal'
import { COMMON_STATUS } from '../../../utils/status'
import { usePositions, useUpdatePosition, useFormModal, usePermissionConfig } from '../../../hooks'
import { usePermissions } from '../../../utils/permissions'
import { withErrorHandler } from '../../../utils/errorHandler'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import type { Position } from '../../../types'
import { PageContainer } from '../../../components/PageContainer'

const { Panel } = Collapse

// 层级选项 (保留用于显示，但主要使用 dataScope)
const LEVEL_LABELS: Record<number, string> = {
  1: '总部',
  2: '项目',
  3: '组',
}

// 权限摘要显示
function PermissionSummary({
  permissions,
  modules
}: {
  permissions: string | Record<string, unknown> | null | undefined
  modules: Record<string, { label: string; subModules: Record<string, { label: string; actions: string[] }> }>
}) {
  const perms = typeof permissions === 'string' ? JSON.parse(permissions || '{}') : permissions || {}

  const moduleCounts: string[] = []
  Object.entries(modules).forEach(([moduleKey, moduleConfig]) => {
    const modulePerms = perms[moduleKey]
    if (modulePerms && Object.keys(modulePerms).length > 0) {
      const subCount = Object.keys(modulePerms).length
      const totalSubs = Object.keys(moduleConfig.subModules).length
      moduleCounts.push(`${moduleConfig.label.replace('模块', '')}(${subCount}/${totalSubs})`)
    }
  })

  if (moduleCounts.length === 0) {
    return <Tag color="default">无权限</Tag>
  }

  return (
    <Space wrap size={[4, 4]}>
      {moduleCounts.map((m, i) => (
        <Tag key={i} color="blue">{m}</Tag>
      ))}
    </Space>
  )
}

// 权限详情展示
function PermissionDetail({
  permissions,
  modules,
  actionLabels,
}: {
  permissions: string | Record<string, unknown> | null | undefined
  modules: Record<string, { label: string; subModules: Record<string, { label: string; actions: string[] }> }>
  actionLabels: Record<string, string>
}) {
  const perms = typeof permissions === 'string' ? JSON.parse(permissions || '{}') : permissions || {}

  if (Object.keys(perms).length === 0) {
    return <span style={{ color: '#999' }}>无权限配置</span>
  }

  return (
    <Collapse size="small" ghost>
      {Object.entries(modules).map(([moduleKey, moduleConfig]) => {
        const modulePerms = perms[moduleKey]
        if (!modulePerms || Object.keys(modulePerms).length === 0) return null

        return (
          <Panel
            header={<span style={{ fontWeight: 500 }}>{moduleConfig.label}</span>}
            key={moduleKey}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(modulePerms).map(([subKey, actions]) => {
                const subConfig = moduleConfig.subModules[subKey]
                const actionList = Array.isArray(actions) ? actions : []

                return (
                  <div key={subKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="blue">{subConfig?.label || subKey}</Tag>
                    <span style={{ color: '#666' }}>
                      {actionList.map(a => actionLabels[a] || a).join('、')}
                    </span>
                  </div>
                )
              })}
            </Space>
          </Panel>
        )
      })}
    </Collapse>
  )
}

// 权限编辑表单 - 使用内部 state 管理
function PermissionEditForm({
  initialPermissions,
  onChange,
  modules,
  actionLabels,
}: {
  initialPermissions: Record<string, Record<string, string[]>>
  onChange: (perms: Record<string, Record<string, string[]>>) => void
  modules: Record<string, { label: string; subModules: Record<string, { label: string; actions: string[] }> }>
  actionLabels: Record<string, string>
}) {
  const [permissions, setPermissions] = useState<Record<string, Record<string, string[]>>>({})

  // 初始化权限
  useEffect(() => {
    setPermissions(initialPermissions || {})
  }, [initialPermissions])

  const isChecked = (module: string, subModule: string, action: string) => {
    return permissions[module]?.[subModule]?.includes(action) || false
  }

  const toggleAction = (module: string, subModule: string, action: string, checked: boolean) => {
    setPermissions(prev => {
      const newPerms = JSON.parse(JSON.stringify(prev)) // 深拷贝
      if (!newPerms[module]) newPerms[module] = {}
      if (!newPerms[module][subModule]) newPerms[module][subModule] = []

      const actions = [...newPerms[module][subModule]]
      if (checked) {
        if (!actions.includes(action)) actions.push(action)
      } else {
        const idx = actions.indexOf(action)
        if (idx >= 0) actions.splice(idx, 1)
      }

      newPerms[module][subModule] = actions

      if (actions.length === 0) {
        delete newPerms[module][subModule]
        if (Object.keys(newPerms[module]).length === 0) {
          delete newPerms[module]
        }
      }

      // 通知父组件
      onChange(newPerms)
      return newPerms
    })
  }

  const toggleSubModule = (module: string, subModule: string, checked: boolean) => {
    const actions = modules[module]?.subModules[subModule]?.actions || []
    setPermissions(prev => {
      const newPerms = JSON.parse(JSON.stringify(prev))
      if (!newPerms[module]) newPerms[module] = {}

      if (checked) {
        newPerms[module][subModule] = [...actions]
      } else {
        delete newPerms[module][subModule]
        if (Object.keys(newPerms[module]).length === 0) {
          delete newPerms[module]
        }
      }

      onChange(newPerms)
      return newPerms
    })
  }

  const isSubModuleAllChecked = (module: string, subModule: string) => {
    const actions = modules[module]?.subModules[subModule]?.actions || []
    return actions.every(action => isChecked(module, subModule, action))
  }

  const isSubModulePartialChecked = (module: string, subModule: string) => {
    const actions = modules[module]?.subModules[subModule]?.actions || []
    const checkedCount = actions.filter(action => isChecked(module, subModule, action)).length
    return checkedCount > 0 && checkedCount < actions.length
  }

  return (
    <Collapse size="small" defaultActiveKey={['finance', 'hr', 'asset', 'site', 'report', 'system', 'self']}>
      {Object.entries(modules).map(([moduleKey, moduleConfig]) => (
        <Panel header={moduleConfig.label} key={moduleKey}>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(moduleConfig.subModules).map(([subKey, subConfig]) => (
              <div key={subKey} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                <Checkbox
                  checked={isSubModuleAllChecked(moduleKey, subKey)}
                  indeterminate={isSubModulePartialChecked(moduleKey, subKey)}
                  onChange={(e) => toggleSubModule(moduleKey, subKey, e.target.checked)}
                >
                  <span style={{ fontWeight: 500, minWidth: 80, display: 'inline-block' }}>{subConfig.label}</span>
                </Checkbox>
                <Space size={4} wrap>
                  {subConfig.actions.map(action => (
                    <Checkbox
                      key={action}
                      checked={isChecked(moduleKey, subKey, action)}
                      onChange={(e) => toggleAction(moduleKey, subKey, action, e.target.checked)}
                    >
                      {actionLabels[action] || action}
                    </Checkbox>
                  ))}
                </Space>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </Collapse>
  )
}

export function PositionPermissionsManagement() {
  const { data: positions = [], isLoading, refetch } = usePositions()
  const { mutateAsync: updatePosition } = useUpdatePosition()
  const modal = useFormModal<Position>()
  const [form] = Form.useForm()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('system', 'position', 'update')

  // 从后端加载权限配置
  const { modules: PERMISSION_MODULES, actionLabels: ACTION_LABELS, dataScopes, dataScopeLabels } = usePermissionConfig()

  // 切换启用状态
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const handleToggleActive = useMemo(() => withErrorHandler(
    async (record: Position, checked: boolean) => {
      setTogglingId(record.id)
      await updatePosition({ id: record.id, data: { active: (checked ? 1 : 0) } as any })
      return `已${checked ? '启用' : '禁用'}职位：${record.name}`
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      onError: () => { },
      onFinally: () => setTogglingId(null)
    }
  ), [updatePosition])

  // 编辑权限状态
  const [editingPermissions, setEditingPermissions] = useState<Record<string, Record<string, string[]>>>({})
  // 编辑 DataScope 状态
  type DataScopeValue = 'all' | 'project' | 'group' | 'self'
  const [editingDataScope, setEditingDataScope] = useState<DataScopeValue>('self')

  // 编辑时初始化
  useEffect(() => {
    if (modal.isEdit && modal.data) {
      const perms = typeof modal.data.permissions === 'string'
        ? JSON.parse(modal.data.permissions || '{}')
        : modal.data.permissions || {}
      setEditingPermissions(perms)
      setEditingDataScope(((modal.data as any).dataScope || 'self') as DataScopeValue)
    }
  }, [modal.isEdit, modal.data])

  const handleSubmit = useMemo(() => withErrorHandler(
    async () => {
      if (!modal.data) return
      await updatePosition({
        id: modal.data.id,
        data: {
          permissions: editingPermissions,
          dataScope: editingDataScope,
        }
      })
      modal.close()
    },
    {
      successMessage: '权限保存成功',
      errorMessage: '保存失败'
    }
  ), [modal, editingPermissions, editingDataScope, updatePosition])

  const columns: DataTableColumn<Position>[] = [
    { title: '职位代码', dataIndex: 'code', width: 140 },
    { title: '职位名称', dataIndex: 'name', width: 120 },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
      render: (v: number) => <Tag>{LEVEL_LABELS[v] || v}</Tag>
    },
    {
      title: '数据范围',
      dataIndex: 'dataScope',
      width: 140,
      render: (v: string) => {
        const scopeColors: Record<string, string> = {
          all: 'red',
          project: 'orange',
          group: 'blue',
          self: 'green',
        }
        return <Tag color={scopeColors[v] || 'default'}>{dataScopeLabels[v] || v || '未设置'}</Tag>
      }
    },
    {
      title: '管理下属',
      dataIndex: 'canManageSubordinates',
      width: 90,
      render: (v: number) => <StatusTag status={v === 1 ? 'enabled' : 'disabled'} statusMap={COMMON_STATUS} />
    },
    {
      title: '权限配置',
      dataIndex: 'permissions',
      width: 280,
      render: (v: string | Record<string, unknown> | null | undefined) => <PermissionSummary permissions={v} modules={PERMISSION_MODULES} />
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'active',
      width: 90,
      render: (v: number, record: Position) => (
        canEdit ? (
          <Popconfirm
            title={`确认${v === 1 ? '禁用' : '启用'}该职位？`}
            description={v === 1 ? '禁用后，该职位的用户可能无法正常使用系统' : '启用后，该职位的用户可以正常使用系统'}
            onConfirm={() => handleToggleActive(record, v !== 1)}
            okText="确认"
            cancelText="取消"
          >
            <Switch
              checked={v === 1}
              loading={togglingId === record.id}
              size="small"
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </Popconfirm>
        ) : (
          <StatusTag status={v === 1 ? 'enabled' : 'disabled'} statusMap={COMMON_STATUS} />
        )
      )
    },
    // 操作列由 DataTable 的 onEdit 属性处理
  ]

  return (
    <PageContainer
      title="权限管理"
      breadcrumb={[{ title: '系统设置' }, { title: '权限管理' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            {
              label: '刷新',
              icon: <ReloadOutlined />,
              onClick: () => refetch(),
              loading: isLoading
            }
          ]}
        />
        <DataTable<Position>
          columns={columns}
          data={positions}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          onEdit={canEdit ? (record) => modal.openEdit(record) : undefined}
          showActions={canEdit}
          actionColumnTitle="操作"
          tableProps={{
            className: 'table-striped',
            scroll: { x: 1100 },
            locale: { emptyText: '暂无职位数据' },
            expandable: {
              expandedRowRender: (record) => (
                <div style={{ padding: '12px 0' }}>
                  <h4 style={{ marginBottom: 12 }}>权限详情</h4>
                  <PermissionDetail
                    permissions={record.permissions}
                    modules={PERMISSION_MODULES}
                    actionLabels={ACTION_LABELS}
                  />
                </div>
              ),
              rowExpandable: (record) => {
                const perms = typeof record.permissions === 'string'
                  ? JSON.parse(record.permissions || '{}')
                  : record.permissions || {}
                return Object.keys(perms).length > 0
              },
            },
          }}
        />
      </Card>

      <FormModal
        title={modal.data ? `编辑权限：${modal.data.name}` : '编辑权限'}
        open={modal.isEdit}
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => {
          modal.close()
          setEditingPermissions({})
          setEditingDataScope('self')
        }}
        width={900}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 500, marginRight: 12 }}>数据访问范围：</label>
          <Select
            value={editingDataScope}
            onChange={(v) => setEditingDataScope(v as DataScopeValue)}
            style={{ width: 240 }}
            options={dataScopes}
          />
          <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>
            决定该职位可以查看哪些业务数据
          </span>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <PermissionEditForm
          initialPermissions={editingPermissions}
          onChange={setEditingPermissions}
          modules={PERMISSION_MODULES}
          actionLabels={ACTION_LABELS}
        />
      </FormModal>
    </PageContainer>
  )
}
