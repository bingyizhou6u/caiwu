import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
})

// Note: users table has been merged into employees table
// All auth fields are now in employees table

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  personalEmail: text('personal_email'),
  name: text('name'),
  positionId: text('position_id'),
  orgDepartmentId: text('org_department_id'),
  departmentId: text('department_id'),
  joinDate: text('join_date'),
  status: text('status'),
  active: integer('active').default(1),
  phone: text('phone'),
  usdtAddress: text('usdt_address'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  address: text('address'),
  memo: text('memo'),
  birthday: text('birthday'),
  regularDate: text('regular_date'),
  workSchedule: text('work_schedule'),
  annualLeaveCycleMonths: integer('annual_leave_cycle_months'),
  annualLeaveDays: integer('annual_leave_days'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
  // Auth fields (merged from users table)
  passwordHash: text('password_hash'),
  mustChangePassword: integer('must_change_password').default(0),
  passwordChanged: integer('password_changed').default(0),
  totpSecret: text('totp_secret'),
  lastLoginAt: integer('last_login_at'),
  activationToken: text('activation_token'),
  activationExpiresAt: integer('activation_expires_at'),
  resetToken: text('reset_token'),
  resetExpiresAt: integer('reset_expires_at'),
})

export const positions = sqliteTable('positions', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  canManageSubordinates: integer('can_manage_subordinates').default(0),
  dataScope: text('data_scope').default('self').notNull(), // all, project, group, self
  description: text('description'),
  permissions: text('permissions'),
  sortOrder: integer('sort_order').default(0),
  active: integer('active').default(1),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  hqId: text('hq_id'),
  name: text('name').notNull(),
  code: text('code'),
  active: integer('active').default(1),
  sortOrder: integer('sort_order').default(100),
  // PM 扩展字段
  managerId: text('manager_id'), // 项目经理（员工ID）
  status: text('status').default('active'), // active, on_hold, completed, cancelled
  priority: text('priority').default('medium'), // high, medium, low
  startDate: text('start_date'), // 计划开始日期
  endDate: text('end_date'), // 计划结束日期
  actualStartDate: text('actual_start_date'),
  actualEndDate: text('actual_end_date'),
  budgetCents: integer('budget_cents'), // 预算（分）
  description: text('description'),
  memo: text('memo'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const headquarters = sqliteTable('headquarters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  active: integer('active').default(1),
})

export const vendors = sqliteTable('vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contact: text('contact'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  memo: text('memo'),
  active: integer('active').default(1),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const orgDepartments = sqliteTable('org_departments', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  allowedModules: text('allowed_modules'),
  allowedPositions: text('allowed_positions'),
  defaultPositionId: text('default_position_id'),
  active: integer('active').default(1),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at'),
  lastActiveAt: integer('last_active_at'),
})

export const trustedDevices = sqliteTable('trusted_devices', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  deviceFingerprint: text('device_fingerprint').notNull(),
  deviceName: text('device_name'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  lastUsedAt: integer('last_used_at'),
  createdAt: integer('created_at'),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  alias: text('alias'),
  accountNumber: text('account_number'),
  openingCents: integer('opening_cents').default(0),
  active: integer('active').default(1),
  version: integer('version').default(1), // 乐观锁版本号
})

export const openingBalances = sqliteTable('opening_balances', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  refId: text('ref_id').notNull(),
  amountCents: integer('amount_cents').default(0).notNull(),
  createdAt: integer('created_at'),
})

export const cashFlows = sqliteTable(
  'cash_flows',
  {
    id: text('id').primaryKey(),
    voucherNo: text('voucher_no'),
    bizDate: text('biz_date').notNull(),
    type: text('type').notNull(),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    method: text('method'),
    amountCents: integer('amount_cents').notNull(),
    siteId: text('site_id'),
    departmentId: text('department_id'),
    counterparty: text('counterparty'),
    memo: text('memo'),
    voucherUrl: text('voucher_url'),
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    // 红冲相关字段
    isReversal: integer('is_reversal').default(0), // 是否为红冲记录
    reversalOfFlowId: text('reversal_of_flow_id'), // 冲正的原始流水ID
    isReversed: integer('is_reversed').default(0), // 是否已被冲正
    reversedByFlowId: text('reversed_by_flow_id'), // 冲正记录ID
  },
  t => ({
    idxAccountBiz: index('idx_cash_flows_account_biz').on(t.accountId, t.bizDate),
    idxType: index('idx_cash_flows_type').on(t.type),
    idxReversal: index('idx_cash_flows_reversal').on(t.reversalOfFlowId),
  })
)

export const accountTransactions = sqliteTable(
  'account_transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    flowId: text('flow_id').notNull(),
    transactionDate: text('transaction_date').notNull(),
    transactionType: text('transaction_type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    balanceBeforeCents: integer('balance_before_cents').notNull(),
    balanceAfterCents: integer('balance_after_cents').notNull(),
    createdAt: integer('created_at'),
  },
  t => ({
    idxAccountDate: index('idx_acc_tx_account_date').on(t.accountId, t.transactionDate),
  })
)


export const currencies = sqliteTable('currencies', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol'),
  active: integer('active').default(1),
})

export const employeeSalaries = sqliteTable('employee_salaries', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  salaryType: text('salary_type').notNull(), // 'probation', 'regular'
  currencyId: text('currency_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  effectiveDate: text('effective_date'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const employeeAllowances = sqliteTable('employee_allowances', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  allowanceType: text('allowance_type').notNull(), // 'living', 'housing', 'transportation', 'meal'
  currencyId: text('currency_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const allowancePayments = sqliteTable(
  'allowance_payments',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    allowanceType: text('allowance_type').notNull(),
    currencyId: text('currency_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    paymentDate: text('payment_date').notNull(),
    paymentMethod: text('payment_method').default('cash'),
    voucherUrl: text('voucher_url'),
    memo: text('memo'),
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    unq: uniqueIndex('idx_unq_allowance_payments_emp_period_type').on(
      t.employeeId,
      t.year,
      t.month,
      t.allowanceType
    ),
  })
)

export const employeeLeaves = sqliteTable('employee_leaves', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  leaveType: text('leave_type').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  days: integer('days').notNull(),
  status: text('status').default('pending'),
  reason: text('reason'),
  memo: text('memo'),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at'),
  version: integer('version').default(1), // 乐观锁版本号
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const salaryPayments = sqliteTable(
  'salary_payments',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    salaryCents: integer('salary_cents').notNull(),
    status: text('status').notNull(), // pending_employee_confirmation, pending_finance_approval, pending_payment, pending_payment_confirmation, completed
    allocationStatus: text('allocation_status').default('pending'), // pending, requested, approved
    employeeConfirmedBy: text('employee_confirmed_by'),
    employeeConfirmedAt: integer('employee_confirmed_at'),
    financeApprovedBy: text('finance_approved_by'),
    financeApprovedAt: integer('finance_approved_at'),
    accountId: text('account_id'),
    paymentTransferredBy: text('payment_transferred_by'),
    paymentTransferredAt: integer('payment_transferred_at'),
    paymentVoucherPath: text('payment_voucher_path'),
    paymentConfirmedBy: text('payment_confirmed_by'),
    paymentConfirmedAt: integer('payment_confirmed_at'),
    rollbackReason: text('rollback_reason'),
    rollbackBy: text('rollback_by'),
    rollbackAt: integer('rollback_at'),
    version: integer('version').default(1), // 乐观锁版本号
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    unq: uniqueIndex('idx_unq_salary_payments_emp_period').on(t.employeeId, t.year, t.month),
  })
)

export const salaryPaymentAllocations = sqliteTable('salary_payment_allocations', {
  id: text('id').primaryKey(),
  salaryPaymentId: text('salary_payment_id').notNull(),
  currencyId: text('currency_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  accountId: text('account_id'),
  status: text('status').default('pending'), // pending, approved, rejected
  requestedBy: text('requested_by'),
  requestedAt: integer('requested_at'),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  name: text('name').notNull(),
  siteCode: text('site_code'),
  active: integer('active').default(1),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // income, expense
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').default(0),
  active: integer('active').default(1),
})

export const arApDocs = sqliteTable('ar_ap_docs', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // AR, AP
  partyId: text('party_id'),
  siteId: text('site_id'),
  departmentId: text('department_id'),
  issueDate: text('issue_date'),
  dueDate: text('due_date'),
  amountCents: integer('amount_cents').notNull(),
  docNo: text('doc_no'),
  memo: text('memo'),
  status: text('status').default('open'), // open, partial, settled
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

// Note: borrowings, borrowers, repayments tables have been removed
// Borrowing/lending is now tracked via flows with type = 'borrowing_in' | 'lending_out' | 'repayment_in' | 'repayment_out'

export const expenseReimbursements = sqliteTable('expense_reimbursements', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  expenseType: text('expense_type').notNull(), // travel, office, meal, transport, other
  amountCents: integer('amount_cents').notNull(),
  currencyId: text('currency_id').default('CNY'),
  expenseDate: text('expense_date').notNull(),
  description: text('description').notNull(),
  voucherUrl: text('voucher_url'),
  status: text('status').default('pending'), // pending, approved, rejected
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at'),
  memo: text('memo'),
  version: integer('version').default(1), // 乐观锁版本号
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const attendanceRecords = sqliteTable('attendance_records', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  date: text('date').notNull(),
  clockInTime: integer('clock_in_time'),
  clockOutTime: integer('clock_out_time'),
  clockInLocation: text('clock_in_location'),
  clockOutLocation: text('clock_out_location'),
  status: text('status'), // normal, late, early, late_early
  memo: text('memo'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  docId: text('doc_id').notNull(),
  flowId: text('flow_id').notNull(),
  settleAmountCents: integer('settle_amount_cents').notNull(),
  settleDate: text('settle_date'),
  createdAt: integer('created_at'),
})

export const accountTransfers = sqliteTable('account_transfers', {
  id: text('id').primaryKey(),
  transferDate: text('transfer_date').notNull(),
  fromAccountId: text('from_account_id').notNull(),
  toAccountId: text('to_account_id').notNull(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  fromAmountCents: integer('from_amount_cents').notNull(),
  toAmountCents: integer('to_amount_cents').notNull(),
  exchangeRate: real('exchange_rate'), // 汇率，使用 real 类型存储浮点数
  memo: text('memo'),
  voucherUrl: text('voucher_url'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
})

export const siteBills = sqliteTable('site_bills', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull(),
  billDate: text('bill_date').notNull(),
  billType: text('bill_type').notNull(), // 'water', 'electricity', 'internet', 'other'
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  description: text('description'),
  accountId: text('account_id'),
  categoryId: text('category_id'),
  status: text('status').default('pending'), // 'pending', 'paid'
  paymentDate: text('payment_date'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const ipWhitelistRule = sqliteTable('ip_whitelist_rule', {
  id: text('id').primaryKey(),
  cloudflareRuleId: text('cloudflare_rule_id').notNull(),
  cloudflareRulesetId: text('cloudflare_ruleset_id').notNull(),
  enabled: integer('enabled').default(0),
  description: text('description'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const fixedAssets = sqliteTable('fixed_assets', {
  id: text('id').primaryKey(),
  assetCode: text('asset_code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category'),
  purchaseDate: text('purchase_date'),
  purchasePriceCents: integer('purchase_price_cents').notNull(),
  currency: text('currency').notNull(),
  vendorId: text('vendor_id'),
  departmentId: text('department_id'),
  siteId: text('site_id'),
  custodian: text('custodian'),
  status: text('status').default('in_use'), // in_use, idle, maintenance, scrapped, sold
  depreciationMethod: text('depreciation_method'),
  usefulLifeYears: integer('useful_life_years'),
  currentValueCents: integer('current_value_cents'),
  memo: text('memo'),
  saleDate: text('sale_date'),
  salePriceCents: integer('sale_price_cents'),
  saleBuyer: text('sale_buyer'),
  saleMemo: text('sale_memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const fixedAssetDepreciations = sqliteTable('fixed_asset_depreciations', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  depreciationDate: text('depreciation_date').notNull(),
  depreciationAmountCents: integer('depreciation_amount_cents').notNull(),
  accumulatedDepreciationCents: integer('accumulated_depreciation_cents').notNull(),
  remainingValueCents: integer('remaining_value_cents').notNull(),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
})

export const fixedAssetChanges = sqliteTable('fixed_asset_changes', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  changeType: text('change_type').notNull(), // status_change, transfer, allocation, return, purchase, sale
  changeDate: text('change_date').notNull(),
  fromDeptId: text('from_dept_id'),
  toDeptId: text('to_dept_id'),
  fromSiteId: text('from_site_id'),
  toSiteId: text('to_site_id'),
  fromCustodian: text('from_custodian'),
  toCustodian: text('to_custodian'),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
})

export const fixedAssetAllocations = sqliteTable('fixed_asset_allocations', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  employeeId: text('employee_id').notNull(),
  allocationDate: text('allocation_date').notNull(),
  allocationType: text('allocation_type').default('employee_onboarding'),
  returnDate: text('return_date'),
  returnType: text('return_type'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const rentalProperties = sqliteTable('rental_properties', {
  id: text('id').primaryKey(),
  propertyCode: text('property_code').notNull(),
  name: text('name').notNull(),
  propertyType: text('property_type').notNull(), // office, dormitory, apartment, warehouse
  address: text('address'),
  areaSqm: real('area_sqm'),
  rentType: text('rent_type').default('monthly'), // monthly, yearly
  monthlyRentCents: integer('monthly_rent_cents'),
  yearlyRentCents: integer('yearly_rent_cents'),
  currency: text('currency').notNull(),
  paymentPeriodMonths: integer('payment_period_months').default(1),
  landlordName: text('landlord_name'),
  landlordContact: text('landlord_contact'),
  leaseStartDate: text('lease_start_date'),
  leaseEndDate: text('lease_end_date'),
  depositCents: integer('deposit_cents'),
  paymentMethod: text('payment_method'),
  paymentAccountId: text('payment_account_id'),
  paymentDay: integer('payment_day').default(1),
  departmentId: text('department_id'),
  status: text('status').default('active'), // active, inactive
  memo: text('memo'),
  contractFileUrl: text('contract_file_url'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const rentalPayments = sqliteTable('rental_payments', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  paymentDate: text('payment_date').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  accountId: text('account_id').notNull(),
  categoryId: text('category_id'),
  paymentMethod: text('payment_method'),
  voucherUrl: text('voucher_url'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const rentalChanges = sqliteTable('rental_changes', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  changeType: text('change_type').notNull(), // modify, renew, terminate
  changeDate: text('change_date').notNull(),
  fromLeaseStart: text('from_lease_start'),
  toLeaseStart: text('to_lease_start'),
  fromLeaseEnd: text('from_lease_end'),
  toLeaseEnd: text('to_lease_end'),
  fromMonthlyRentCents: integer('from_monthly_rent_cents'),
  toMonthlyRentCents: integer('to_monthly_rent_cents'),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
})

export const dormitoryAllocations = sqliteTable('dormitory_allocations', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  employeeId: text('employee_id').notNull(),
  roomNumber: text('room_number'),
  bedNumber: text('bed_number'),
  allocationDate: text('allocation_date').notNull(),
  monthlyRentCents: integer('monthly_rent_cents'),
  returnDate: text('return_date'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const rentalPayableBills = sqliteTable('rental_payable_bills', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  billDate: text('bill_date').notNull(),
  dueDate: text('due_date').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  paymentPeriodMonths: integer('payment_period_months').default(1),
  status: text('status').default('unpaid'), // unpaid, paid
  paidDate: text('paid_date'),
  paidPaymentId: text('paid_payment_id'),
  memo: text('memo'),
  createdBy: text('created_by'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
})

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    action: text('action'),
    entity: text('entity'),
    entityId: text('entity_id'),
    at: integer('at').notNull(),
    detail: text('detail'),
    ip: text('ip'),
    ipLocation: text('ip_location'),
  },
  t => ({
    idxTime: index('idx_audit_logs_time').on(t.at),
    idxEntity: index('idx_audit_logs_entity').on(t.entityId),
  })
)

export const businessOperationHistory = sqliteTable('business_operation_history', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'salary_payment', 'borrowing', 'reimbursement', 'leave', etc.
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'created', 'updated', 'approved', 'rejected', 'rolled_back', etc.
  operatorId: text('operator_id'),
  operatorName: text('operator_name'),
  beforeData: text('before_data'), // JSON
  afterData: text('after_data'), // JSON
  memo: text('memo'),
  createdAt: integer('created_at').notNull(),
})

// ==========================================
// 项目管理模块 (PM - Project Management)
// ==========================================

// 项目表
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // 项目编码，如 PRJ-001
    name: text('name').notNull(),
    description: text('description'),
    departmentId: text('department_id').notNull(), // 所属部门
    managerId: text('manager_id'), // 项目经理（员工ID）
    status: text('status').default('active'), // active, on_hold, completed, cancelled
    startDate: text('start_date'), // 计划开始日期
    endDate: text('end_date'), // 计划结束日期
    actualStartDate: text('actual_start_date'),
    actualEndDate: text('actual_end_date'),
    priority: text('priority').default('medium'), // high, medium, low
    budgetCents: integer('budget_cents'), // 预算（分）
    memo: text('memo'),
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
    active: integer('active').default(1),
  },
  t => ({
    idxDepartment: index('idx_projects_department').on(t.departmentId),
    idxStatus: index('idx_projects_status').on(t.status),
  })
)

// 需求表
export const requirements = sqliteTable(
  'requirements',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // 需求编号，如 REQ-001
    projectId: text('project_id'), // 所属项目（旧字段，逐步废弃）
    departmentId: text('department_id'), // 所属项目（关联 departments 表）
    title: text('title').notNull(),
    description: text('description'), // 支持 Markdown
    type: text('type').notNull(), // feature, bug, improvement, task
    priority: text('priority').default('medium'), // critical, high, medium, low
    status: text('status').default('draft'), // draft, reviewing, approved, in_progress, testing, completed, rejected, cancelled
    estimatedHours: integer('estimated_hours'), // 预估工时
    actualHours: integer('actual_hours'), // 实际工时（汇总自 task_timelogs）
    deadline: text('deadline'), // 截止日期
    assigneeId: text('assignee_id'), // 指派人
    reviewerId: text('reviewer_id'), // 评审人
    reviewedAt: integer('reviewed_at'),
    reviewMemo: text('review_memo'),
    attachmentUrls: text('attachment_urls'), // 附件URL列表（JSON）
    version: integer('version').default(1), // 乐观锁
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    idxProject: index('idx_requirements_project').on(t.projectId),
    idxDepartment: index('idx_requirements_department').on(t.departmentId),
    idxStatus: index('idx_requirements_status').on(t.status),
    idxAssignee: index('idx_requirements_assignee').on(t.assigneeId),
  })
)

// 任务表
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // 任务编号，如 TASK-001
    requirementId: text('requirement_id'), // 关联需求（可选）
    projectId: text('project_id'), // 所属项目（旧字段，逐步废弃）
    departmentId: text('department_id'), // 所属项目（关联 departments 表）
    parentTaskId: text('parent_task_id'), // 父任务（支持子任务）
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').default('dev'), // dev, design, test, doc, deploy, meeting, other
    priority: text('priority').default('medium'), // high, medium, low
    status: text('status').default('todo'), // todo, in_progress, review, completed, blocked, cancelled
    estimatedHours: integer('estimated_hours'),
    actualHours: integer('actual_hours'), // 汇总自 task_timelogs
    startDate: text('start_date'),
    dueDate: text('due_date'),
    completedAt: integer('completed_at'),
    assigneeId: text('assignee_id'),
    sortOrder: integer('sort_order').default(0), // 排序顺序（看板用）
    version: integer('version').default(1), // 乐观锁
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    idxProject: index('idx_tasks_project').on(t.projectId),
    idxDepartment: index('idx_tasks_department').on(t.departmentId),
    idxRequirement: index('idx_tasks_requirement').on(t.requirementId),
    idxStatus: index('idx_tasks_status').on(t.status),
    idxAssignee: index('idx_tasks_assignee').on(t.assigneeId),
  })
)

// 工时记录表
export const taskTimelogs = sqliteTable(
  'task_timelogs',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(), // 关联任务
    departmentId: text('department_id'), // 所属项目（即查询优化）
    employeeId: text('employee_id').notNull(), // 员工
    logDate: text('log_date').notNull(), // 日志日期
    hours: real('hours').notNull(), // 工时（支持 0.5 小时）
    description: text('description'), // 工作描述
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    idxTask: index('idx_timelogs_task').on(t.taskId),
    idxDepartment: index('idx_timelogs_department').on(t.departmentId),
    idxEmployeeDate: index('idx_timelogs_employee_date').on(t.employeeId, t.logDate),
  })
)

// 里程碑表
export const milestones = sqliteTable(
  'milestones',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id'), // 所属项目（旧字段，逐步废弃）
    departmentId: text('department_id'), // 所属项目（关联 departments 表）
    name: text('name').notNull(),
    description: text('description'),
    dueDate: text('due_date').notNull(), // 截止日期
    status: text('status').default('pending'), // pending, completed, overdue
    completedAt: integer('completed_at'),
    sortOrder: integer('sort_order').default(0),
    createdBy: text('created_by'),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    idxProject: index('idx_milestones_project').on(t.projectId),
    idxDepartment: index('idx_milestones_department').on(t.departmentId),
  })
)

// 需求/任务评论表
export const pmComments = sqliteTable(
  'pm_comments',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(), // requirement, task
    entityId: text('entity_id').notNull(), // 关联实体ID
    content: text('content').notNull(), // 评论内容（支持 Markdown）
    authorId: text('author_id').notNull(), // 评论人
    parentCommentId: text('parent_comment_id'), // 父评论（支持回复）
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
  },
  t => ({
    idxEntity: index('idx_pm_comments_entity').on(t.entityType, t.entityId),
  })
)
