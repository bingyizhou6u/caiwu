/**
 * 审计日志中文标签映射
 */

// 操作类型映射
export const ACTION_LABELS: Record<string, string> = {
  approve: '审批',
  create: '创建',
  delete: '删除',
  export: '导出',
  paid: '付款',
  resend_activation: '发送激活邮件',
  reset_totp: '重置2FA',
  return: '归还',
  sync: '同步',
  update: '更新',
  batch_create: '批量创建',
  batch_delete: '批量删除',
  login: '登录',
  logout: '登出',
  reject: '拒绝',
  reverse: '红冲', // 冲正操作
}

// 操作类型颜色
export const ACTION_COLORS: Record<string, string> = {
  approve: 'green',
  create: 'blue',
  delete: 'red',
  export: 'purple',
  paid: 'cyan',
  resend_activation: 'orange',
  reset_totp: 'orange',
  return: 'geekblue',
  sync: 'lime',
  update: 'gold',
  batch_create: 'blue',
  batch_delete: 'red',
  login: 'green',
  logout: 'default',
  reject: 'red',
  reverse: 'volcano', // 红冲操作用红色
}

// 对象类型映射
export const ENTITY_LABELS: Record<string, string> = {
  account: '账户',
  allowance_payment: '补贴发放',
  audit_log: '审计日志',
  borrowing: '借款',
  category: '分类',
  currency: '货币',
  department: '项目',
  dormitory_allocation: '宿舍分配',
  employee: '员工',
  employee_allowance: '员工补贴',
  employee_leave: '员工请假',
  employee_salary: '员工薪资',
  expense_reimbursement: '费用报销',
  fixed_asset: '固定资产',
  headquarters: '总部',
  ip_whitelist: 'IP白名单',
  ip_whitelist_rule: 'IP白名单规则',
  my_profile: '个人资料',
  position: '职位',
  rental_payable_bill: '租赁应付账单',
  rental_payment: '租赁付款',
  rental_property: '租赁物业',
  site: '场地',
  site_bill: '场地账单',
  system_config: '系统配置',
  vendor: '供应商',
  user: '用户',
  cash_flow: '现金流水',
  ar_ap_doc: '应收应付单据',
  settlement: '结算',
  account_transfer: '账户转账',
  salary_payment: '薪资发放',
  repayment: '还款',
}

// 获取操作类型中文标签
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

// 获取操作类型颜色
export function getActionColor(action: string): string {
  return ACTION_COLORS[action] || 'default'
}

// 获取对象类型中文标签
export function getEntityLabel(entity: string): string {
  return ENTITY_LABELS[entity] || entity
}

// 获取操作描述（组合 action + entity）
export function getAuditDescription(action: string, entity: string): string {
  const actionLabel = getActionLabel(action)
  const entityLabel = getEntityLabel(entity)
  return `${actionLabel}${entityLabel}`
}

// 详情字段中文映射
const DETAIL_FIELD_LABELS: Record<string, string> = {
  // 通用字段
  name: '名称',
  email: '邮箱',
  phone: '电话',
  status: '状态',
  active: '启用状态',
  memo: '备注',
  result: '结果',
  success: '成功',
  error: '错误',
  
  // 员工相关
  personalEmail: '个人邮箱',
  companyEmail: '公司邮箱',
  userAccountCreated: '账号已创建',
  emailSent: '邮件已发送',
  emailRoutingCreated: '邮箱路由已创建',
  positionId: '职位',
  projectId: '项目',
  orgDepartmentId: '部门',
  joinDate: '入职日期',
  regularDate: '转正日期',
  leaveDate: '离职日期',
  
  // 薪资相关
  amountCents: '金额(分)',
  amount: '金额',
  currencyId: '货币',
  salaryType: '薪资类型',
  allowanceType: '补贴类型',
  
  // 审批相关
  approved: '已批准',
  rejected: '已拒绝',
  approverName: '审批人',
  
  // 账户相关
  accountId: '账户',
  fromAccountId: '转出账户',
  toAccountId: '转入账户',
  
  // 其他
  count: '数量',
  successCount: '成功数',
  failedCount: '失败数',
  ipAddress: 'IP地址',
  enabled: '启用',
  ruleId: '规则ID',
}

// 状态值中文映射
const STATUS_VALUE_LABELS: Record<string, string> = {
  // 布尔值
  'true': '是',
  'false': '否',
  
  // 员工状态
  probation: '试用期',
  regular: '已转正',
  resigned: '已离职',
  
  // 审批状态
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  
  // 补贴类型
  living: '生活补贴',
  housing: '住房补贴',
  transportation: '交通补贴',
  meal: '伙食补贴',
  birthday: '生日补贴',
}

// 格式化详情字段值
function formatDetailValue(key: string, value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') {
    // 如果是金额（以 Cents 结尾），转换为元
    if (key.toLowerCase().includes('cents') || key.toLowerCase().includes('amount')) {
      return `¥${(value / 100).toFixed(2)}`
    }
    return value.toString()
  }
  if (typeof value === 'string') {
    return STATUS_VALUE_LABELS[value] || value
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

// 解析并格式化详情 JSON
export function formatAuditDetail(detail: string | null | undefined): string {
  if (!detail) return '-'
  
  try {
    const parsed = JSON.parse(detail)
    if (typeof parsed !== 'object' || parsed === null) {
      return detail
    }
    
    const parts: string[] = []
    
    for (const [key, value] of Object.entries(parsed)) {
      const label = DETAIL_FIELD_LABELS[key] || key
      
      // 特殊处理嵌套的 result 对象
      if (key === 'result' && typeof value === 'object' && value !== null) {
        const resultObj = value as Record<string, any>
        if ('success' in resultObj) {
          parts.push(`结果: ${resultObj.success ? '成功' : '失败'}`)
        }
        if ('error' in resultObj && resultObj.error) {
          parts.push(`错误: ${resultObj.error}`)
        }
        continue
      }
      
      const formattedValue = formatDetailValue(key, value)
      parts.push(`${label}: ${formattedValue}`)
    }
    
    return parts.join('; ') || '-'
  } catch {
    // 如果不是 JSON，直接返回原文
    return detail
  }
}

// 格式化对象ID（缩短 UUID）
export function formatEntityId(entityId: string | null | undefined): string {
  if (!entityId) return '-'
  
  // 如果是 UUID 格式，只显示前8位
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
    return entityId.substring(0, 8) + '...'
  }
  
  // 如果太长，截断显示
  if (entityId.length > 20) {
    return entityId.substring(0, 20) + '...'
  }
  
  return entityId
}








