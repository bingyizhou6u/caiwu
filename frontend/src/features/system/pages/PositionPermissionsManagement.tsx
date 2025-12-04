import { Card, Table, Tag, Space, Collapse, Tooltip, Button } from 'antd'
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usePositions } from '../../../hooks'
import type { Position } from '../../../types'


const { Panel } = Collapse

// 操作标签映射
const ACTION_LABELS: Record<string, string> = {
  view: '查看',
  create: '创建',
  update: '编辑',
  delete: '删除',
  export: '导出',
  approve: '审批',
  reject: '拒绝',
  allocate: '分配',
  all: '全部',
}

// 权限模块配置
const PERMISSION_MODULES: Record<string, {
  label: string
  subModules: Record<string, { label: string }>
}> = {
  finance: {
    label: '财务模块',
    subModules: {
      flow: { label: '资金流水' },
      transfer: { label: '账户转账' },
      ar: { label: '应收管理' },
      ap: { label: '应付管理' },
      borrowing: { label: '借支管理' },
    }
  },
  hr: {
    label: '人事模块',
    subModules: {
      employee: { label: '员工管理' },
      salary: { label: '工资管理' },
      leave: { label: '请假管理' },
      reimbursement: { label: '报销审批' },
    }
  },
  asset: {
    label: '资产模块',
    subModules: {
      fixed: { label: '固定资产' },
      rental: { label: '租赁管理' },
    }
  },
  site: {
    label: '站点模块',
    subModules: {
      info: { label: '站点信息' },
      bill: { label: '站点账单' },
    }
  },
  report: {
    label: '报表模块',
    subModules: {
      view: { label: '报表查看' },
      export: { label: '报表导出' },
    }
  },
  system: {
    label: '系统模块',
    subModules: {
      user: { label: '用户管理' },
      position: { label: '职位管理' },
      department: { label: '项目管理' },
      audit: { label: '审计日志' },
      config: { label: '系统配置' },
    }
  },
  self: {
    label: '个人模块',
    subModules: {
      leave: { label: '我的请假' },
      reimbursement: { label: '我的报销' },
      salary: { label: '我的工资' },
      asset: { label: '我的资产' },
      borrowing: { label: '我的借支' },
    }
  },
}

// 层级选项
const LEVEL_LABELS: Record<number, string> = {
  1: '总部',
  2: '项目',
  3: '组',
}

// 职能角色选项
const FUNCTION_ROLE_LABELS: Record<string, string> = {
  director: '主管',
  hr: '人事',
  finance: '财务',
  admin: '行政',
  developer: '开发',
  support: '客服',
  member: '工程师',
}

// 权限详情展示
function PermissionDetail({ permissions }: { permissions: any }) {
  const perms = typeof permissions === 'string' ? JSON.parse(permissions || '{}') : permissions || {}

  if (Object.keys(perms).length === 0) {
    return <span style={{ color: '#999' }}>无权限配置</span>
  }

  return (
    <Collapse size="small" ghost>
      {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleConfig]) => {
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
                      {actionList.map(a => ACTION_LABELS[a] || a).join('、')}
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

// 权限摘要显示
function PermissionSummary({ permissions }: { permissions: any }) {
  const perms = typeof permissions === 'string' ? JSON.parse(permissions || '{}') : permissions || {}

  const moduleCounts: string[] = []
  Object.entries(PERMISSION_MODULES).forEach(([moduleKey, moduleConfig]) => {
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

import { PageContainer } from '../../../components/PageContainer'

export function PositionPermissionsManagement() {
  const { data: positions = [], isLoading, refetch } = usePositions()

  const columns: ColumnsType<any> = [
    { title: '职位代码', dataIndex: 'code', width: 140 },
    { title: '职位名称', dataIndex: 'name', width: 120 },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
      render: (v: number) => <Tag>{LEVEL_LABELS[v] || v}</Tag>
    },
    {
      title: '职能',
      dataIndex: 'function_role',
      width: 80,
      render: (v: string) => <Tag color="cyan">{FUNCTION_ROLE_LABELS[v] || v}</Tag>
    },
    {
      title: '管理下属',
      dataIndex: 'can_manage_subordinates',
      width: 90,
      render: (v: number) => v === 1 ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    {
      title: '权限配置',
      dataIndex: 'permissions',
      width: 280,
      render: (v: any) => <PermissionSummary permissions={v} />
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'active',
      width: 70,
      render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>
    },
  ]

  return (
    <PageContainer
      title="权限管理"
      breadcrumb={[{ title: '系统设置' }, { title: '权限管理' }]}
    >
      <Card
        title={
          <Space>
            <span>权限管理</span>
            <Tooltip title="职位权限由系统预设，如需调整请联系系统管理员">
              <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
        }
        className="page-card"
        bordered={false}
      >
        <Table
          className="table-striped"
          columns={columns}
          dataSource={positions}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无职位数据' }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 0' }}>
                <h4 style={{ marginBottom: 12 }}>权限详情</h4>
                <PermissionDetail permissions={record.permissions} />
              </div>
            ),
            rowExpandable: (record) => {
              const perms = typeof record.permissions === 'string'
                ? JSON.parse(record.permissions || '{}')
                : record.permissions || {}
              return Object.keys(perms).length > 0
            },
          }}
        />
      </Card>
    </PageContainer>
  )
}
