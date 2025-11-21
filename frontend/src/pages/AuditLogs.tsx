import { Table, Space, Button, message, Tag, Select, Input, DatePicker, Card } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '../config/api'
import { apiRequest } from '../utils/api'
import dayjs, { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker

// 操作类型中文映射
const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  activate: '启用',
  deactivate: '停用',
  reset_password: '重置密码',
  update_role: '更新角色',
  update_department: '更新项目',
  settle: '结算',
  import: '导入',
  confirm: '确认',
  approve: '批准',
  reject: '拒绝',
  transfer: '转账',
  login: '登录',
  logout: '退出登录',
  change_password_first: '首次修改密码',
  bind_totp_first: '首次绑定TOTP',
  enable_totp: '启用TOTP',
  disable_totp: '停用TOTP',
}

// 实体类型中文映射
const ENTITY_LABELS: Record<string, string> = {
  user: '用户',
  employee: '员工',
  department: '项目',
  site: '站点',
  category: '分类',
  account: '账户',
  currency: '币种',
  vendor: '供应商',
  cash_flow: '现金流',
  ar_ap_doc: '应收应付单据',
  salary_payment: '薪资发放',
  salary_payment_allocation: '薪资分配',
  ip_whitelist_rule: 'IP白名单规则',
  role_permission: '角色权限',
  expense_reimbursement: '费用报销',
  borrowing: '借款',
  repayment: '还款',
  account_transfer: '账户转账',
  system_config: '系统配置',
  headquarters: '总部',
  fixed_asset: '固定资产',
}

// 字段名中文映射
const FIELD_LABELS: Record<string, string> = {
  email: '邮箱',
  name: '姓名',
  role: '角色',
  status: '状态',
  type: '类型',
  kind: '类型',
  amount_cents: '金额',
  amount: '金额',
  currency_id: '币种',
  employee_id: '员工ID',
  employee_name: '员工',
  department_id: '项目ID',
  account_id: '账户ID',
  voucher_no: '凭证号',
  doc_no: '单据号',
  settlement_id: '结算ID',
  site_id: '站点ID',
  bill_date: '账单日期',
  bill_type: '账单类型',
  from_account: '转出账户',
  to_account: '转入账户',
  from_amount_cents: '转出金额',
  to_amount_cents: '转入金额',
  exchange_rate: '汇率',
  year: '年份',
  month: '月份',
  allocations: '分配',
  rows: '行数',
  inserted: '插入',
  key: '配置键',
  value: '配置值',
}

// 状态值中文映射
const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  approved: '已批准',
  rejected: '已拒绝',
  paid: '已支付',
  unpaid: '未支付',
  active: '启用',
  inactive: '停用',
}

// 角色中文映射
const ROLE_LABELS: Record<string, string> = {
  read: '只读',
  write: '读写',
  manage: '管理',
  manager: '管理员',
}

// 类型值中文映射
const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  AR: '应收',
  AP: '应付',
}

// 格式化详情信息
function formatDetail(detail: string, entity: string, action: string): string {
  if (!detail) return '-'
  
  try {
    const data = JSON.parse(detail)
    const parts: string[] = []
    
    // 根据不同的实体类型和操作类型，格式化显示
    if (entity === 'salary_payment') {
      if (action === 'create') {
        parts.push(`员工: ${data.employee_name || data.employee_id || '-'}`)
        parts.push(`金额: ${data.amount_cents ? (data.amount_cents / 100).toFixed(2) : '-'}`)
        if (data.currency_id) parts.push(`币种: ${data.currency_id}`)
        if (data.year) parts.push(`年份: ${data.year}`)
        if (data.month) parts.push(`月份: ${data.month}`)
      } else if (action === 'update') {
        if (data.status) parts.push(`状态: ${STATUS_LABELS[data.status] || data.status}`)
        if (data.amount_cents) parts.push(`金额: ${(data.amount_cents / 100).toFixed(2)}`)
        if (data.action) parts.push(`操作: ${ACTION_LABELS[data.action] || data.action}`)
      }
    } else if (entity === 'salary_payment_allocation') {
      if (data.allocations) {
        const allocs = Array.isArray(data.allocations) ? data.allocations : []
        parts.push(`分配项数: ${allocs.length}`)
        allocs.forEach((a: any, i: number) => {
          if (a.currency_id && a.amount_cents) {
            parts.push(`  ${i + 1}. ${a.currency_id}: ${(a.amount_cents / 100).toFixed(2)}`)
          }
        })
      }
    } else if (entity === 'cash_flow') {
      if (data.amount_cents) parts.push(`金额: ${(data.amount_cents / 100).toFixed(2)}`)
      if (data.type) parts.push(`类型: ${TYPE_LABELS[data.type] || data.type}`)
      if (data.account_id) parts.push(`账户: ${data.account_id}`)
      if (data.voucher_no) parts.push(`凭证号: ${data.voucher_no}`)
    } else if (entity === 'ar_ap_doc') {
      if (data.kind) parts.push(`类型: ${TYPE_LABELS[data.kind] || data.kind}`)
      if (data.doc_no) parts.push(`单据号: ${data.doc_no}`)
      if (data.amount_cents) parts.push(`金额: ${(data.amount_cents / 100).toFixed(2)}`)
      if (data.settlement_id) parts.push(`结算ID: ${data.settlement_id}`)
      if (data.transaction_type) parts.push(`交易类型: ${TYPE_LABELS[data.transaction_type] || data.transaction_type}`)
      if (data.flow_id) parts.push(`现金流ID: ${data.flow_id}`)
    } else if (entity === 'user') {
      if (data.email) parts.push(`邮箱: ${data.email}`)
      if (data.role) parts.push(`角色: ${ROLE_LABELS[data.role] || data.role}`)
      if (data.name) parts.push(`姓名: ${data.name}`)
      if (data.department_ids) parts.push(`项目IDs: ${Array.isArray(data.department_ids) ? data.department_ids.join(', ') : data.department_ids}`)
    } else if (entity === 'employee') {
      if (data.name) parts.push(`姓名: ${data.name}`)
      if (data.email) parts.push(`邮箱: ${data.email}`)
      if (data.department_id) parts.push(`项目: ${data.department_id}`)
    } else if (entity === 'expense_reimbursement') {
      if (data.amount_cents) parts.push(`金额: ${(data.amount_cents / 100).toFixed(2)}`)
      if (data.status) parts.push(`状态: ${STATUS_LABELS[data.status] || data.status}`)
      if (data.employee_id) parts.push(`员工: ${data.employee_id}`)
    } else if (entity === 'account_transfer') {
      if (data.from_account) parts.push(`转出账户: ${data.from_account}`)
      if (data.to_account) parts.push(`转入账户: ${data.to_account}`)
      if (data.from_amount_cents) parts.push(`转出金额: ${(data.from_amount_cents / 100).toFixed(2)}`)
      if (data.to_amount_cents) parts.push(`转入金额: ${(data.to_amount_cents / 100).toFixed(2)}`)
      if (data.exchange_rate) parts.push(`汇率: ${data.exchange_rate}`)
    } else if (entity === 'site_bill') {
      if (data.site_id) parts.push(`站点ID: ${data.site_id}`)
      if (data.bill_date) parts.push(`账单日期: ${data.bill_date}`)
      if (data.bill_type) parts.push(`账单类型: ${data.bill_type}`)
      if (data.amount_cents) parts.push(`金额: ${(data.amount_cents / 100).toFixed(2)}`)
    } else if (entity === 'category') {
      if (data.name) parts.push(`名称: ${data.name}`)
      if (data.kind) parts.push(`类型: ${TYPE_LABELS[data.kind] || data.kind}`)
    } else if (entity === 'import') {
      if (data.kind) parts.push(`类型: ${TYPE_LABELS[data.kind] || data.kind}`)
      if (data.rows !== undefined) parts.push(`行数: ${data.rows}`)
      if (data.inserted !== undefined) parts.push(`插入: ${data.inserted}`)
    } else {
      // 通用格式化：显示所有字段，使用中文映射
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const fieldLabel = FIELD_LABELS[key] || key
          let displayValue: string
          
          // 特殊字段处理
          if (key === 'status') {
            displayValue = STATUS_LABELS[String(value)] || String(value)
          } else if (key === 'role') {
            displayValue = ROLE_LABELS[String(value)] || String(value)
          } else if (key === 'type' || key === 'kind') {
            displayValue = TYPE_LABELS[String(value)] || String(value)
          } else if (key.includes('amount_cents') || key.includes('amount')) {
            const num = Number(value)
            if (!isNaN(num)) {
              displayValue = (num / 100).toFixed(2)
            } else {
              displayValue = String(value)
            }
          } else {
            displayValue = String(value)
          }
          
          parts.push(`${fieldLabel}: ${displayValue}`)
        }
      })
    }
    
    return parts.length > 0 ? parts.join(' | ') : JSON.stringify(data, null, 2)
  } catch {
    return detail
  }
}

interface AuditLog {
  id: string
  at: number
  actor_name?: string
  actor_email?: string
  action: string
  entity: string
  entity_id?: string
  detail?: string
  ip?: string
  ip_location?: string
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [filterAction, setFilterAction] = useState<string | undefined>()
  const [filterEntity, setFilterEntity] = useState<string | undefined>()
  const [filterActor, setFilterActor] = useState<string | undefined>()
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', String(pageSize))
      params.append('offset', String((currentPage - 1) * pageSize))
      
      const { results, data } = await apiRequest(`${api.auditLogs}?${params.toString()}`)
      setLogs(results)
      setTotal((data as any)?.total ?? 0)
    } catch (e: any) {
      if (e.message?.includes('manager')) {
        message.error('需要manager权限')
      } else {
        message.error('加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [currentPage])

  // 筛选日志
  const filteredLogs = logs.filter(log => {
    if (filterAction && log.action !== filterAction) return false
    if (filterEntity && log.entity !== filterEntity) return false
    if (filterActor) {
      const actor = (log.actor_name || log.actor_email || '').toLowerCase()
      if (!actor.includes(filterActor.toLowerCase())) return false
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const logTime = dayjs(log.at)
      if (logTime.isBefore(filterDateRange[0].startOf('day')) || logTime.isAfter(filterDateRange[1].endOf('day'))) return false
    }
    return true
  })

  // 获取所有唯一的操作类型和实体类型
  const allActions = Array.from(new Set(logs.map(l => l.action))).sort()
  const allEntities = Array.from(new Set(logs.map(l => l.entity))).sort()
  const allActors = Array.from(new Set(logs.map(l => l.actor_name || l.actor_email).filter(Boolean))).sort()

  const columns: ColumnsType<AuditLog> = [
    { 
      title: '时间', 
      dataIndex: 'at', 
      width: 180,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => a.at - b.at,
      defaultSortOrder: 'descend',
    },
    { 
      title: '操作人', 
      dataIndex: 'actor_name', 
      width: 150,
      render: (v: string, r: AuditLog) => v || r.actor_email || '-',
      filteredValue: filterActor ? [filterActor] : null,
      onFilter: (value, record) => {
        const actor = (record.actor_name || record.actor_email || '').toLowerCase()
        return actor.includes(String(value).toLowerCase())
      },
    },
    { 
      title: '操作', 
      dataIndex: 'action', 
      width: 120,
      render: (v: string) => {
        const colors: Record<string, string> = {
          create: 'green',
          update: 'blue',
          delete: 'red',
          activate: 'green',
          deactivate: 'orange',
          reset_password: 'purple',
          update_role: 'cyan',
          update_department: 'blue',
          settle: 'green',
          import: 'geekblue',
          confirm: 'green',
          approve: 'green',
          reject: 'red',
          transfer: 'blue',
        }
        const label = ACTION_LABELS[v] || v
        return <Tag color={colors[v] || 'default'}>{label}</Tag>
      },
      filters: allActions.map(a => ({ text: ACTION_LABELS[a] || a, value: a })),
      filteredValue: filterAction ? [filterAction] : null,
      onFilter: (value, record) => record.action === value,
    },
    { 
      title: '实体类型', 
      dataIndex: 'entity',
      width: 140,
      render: (v: string) => ENTITY_LABELS[v] || v,
      filters: allEntities.map(e => ({ text: ENTITY_LABELS[e] || e, value: e })),
      filteredValue: filterEntity ? [filterEntity] : null,
      onFilter: (value, record) => record.entity === value,
    },
    { 
      title: 'IP地址', 
      dataIndex: 'ip',
      width: 150,
      render: (v: string) => v || '-',
    },
    { 
      title: 'IP归属地', 
      dataIndex: 'ip_location',
      width: 180,
      render: (v: string) => v || '-',
    },
    { 
      title: '详情', 
      dataIndex: 'detail',
      render: (v: string, r: AuditLog) => {
        const formatted = formatDetail(v || '', r.entity, r.action)
        return (
          <div style={{ maxWidth: 400, wordBreak: 'break-word' }}>
            {formatted}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <span>操作类型：</span>
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 150 }}
              value={filterAction}
              onChange={setFilterAction}
            >
              {allActions.map(a => (
                <Select.Option key={a} value={a}>{ACTION_LABELS[a] || a}</Select.Option>
              ))}
            </Select>
            
            <span>实体类型：</span>
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 150 }}
              value={filterEntity}
              onChange={setFilterEntity}
            >
              {allEntities.map(e => (
                <Select.Option key={e} value={e}>{ENTITY_LABELS[e] || e}</Select.Option>
              ))}
            </Select>
            
            <span>操作人：</span>
            <Input
              placeholder="搜索操作人"
              style={{ width: 150 }}
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              allowClear
            />
            
            <span>时间范围：</span>
            <RangePicker
              id="audit-logs-date-range"
              value={filterDateRange}
              onChange={(dates) => setFilterDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
              format="YYYY-MM-DD"
              allowClear
            />
            
            <Button onClick={loadLogs} loading={loading}>刷新</Button>
          </Space>
          <div>
            <span>共 {filteredLogs.length} 条记录（总计 {total} 条）</span>
          </div>
        </Space>
      </Card>
      
      <Table
        rowKey="id"
        dataSource={filteredLogs}
        loading={loading}
        columns={columns}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条（筛选后 ${filteredLogs.length} 条）`,
          onChange: (page) => setCurrentPage(page),
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  )
}

