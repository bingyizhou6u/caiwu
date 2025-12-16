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
