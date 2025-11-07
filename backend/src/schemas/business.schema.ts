/**
 * 通用业务Schema定义
 */

import { z } from 'zod'
import { uuidSchema, dateSchema, emailSchema } from './common.schema.js'

/**
 * 创建现金流Schema
 */
export const createCashFlowSchema = z.object({
  account_id: uuidSchema,
  category_id: uuidSchema,
  biz_date: dateSchema,
  type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'type必须为income或expense' }) }),
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  voucher_urls: z.array(z.string().url('凭证URL格式不正确')).optional(),
  voucher_url: z.string().url().optional(), // 向后兼容
  voucher_no: z.string().optional(),
  method: z.string().optional(),
  site_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  owner_scope: z.enum(['hq', 'department']).optional(),
  counterparty: z.string().optional(),
  memo: z.string().optional(),
  created_by: uuidSchema.optional(),
}).refine(
  (data) => {
    // 如果提供了voucher_urls，使用它；否则检查voucher_url
    if (data.voucher_urls && data.voucher_urls.length > 0) return true
    if (data.voucher_url) return true
    return false
  },
  { message: 'voucher_urls参数必填（凭证上传是必填的）' }
)

/**
 * 创建员工Schema
 */
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'name参数必填'),
  org_department_id: uuidSchema,
  position_id: uuidSchema,
  department_id: uuidSchema.optional(),
  join_date: dateSchema,
  email: emailSchema,
  birthday: dateSchema,
  phone: z.string().optional(),
  probation_salary_cents: z.number().int().nonnegative('probation_salary_cents参数必填'),
  regular_salary_cents: z.number().int().nonnegative('regular_salary_cents参数必填'),
  probation_salaries: z.array(z.object({
    currency_id: z.string(),
    amount_cents: z.number().int().nonnegative(),
  })).optional(),
  regular_salaries: z.array(z.object({
    currency_id: z.string(),
    amount_cents: z.number().int().nonnegative(),
  })).optional(),
  living_allowance_cents: z.number().int().nonnegative().optional(),
  housing_allowance_cents: z.number().int().nonnegative().optional(),
  transportation_allowance_cents: z.number().int().nonnegative().optional(),
  meal_allowance_cents: z.number().int().nonnegative().optional(),
  usdt_address: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  address: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 创建租赁房屋Schema
 */
export const createRentalPropertySchema = z.object({
  property_code: z.string().min(1, 'property_code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  property_type: z.enum(['office', 'warehouse', 'dormitory', 'other']),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  rent_type: z.enum(['monthly', 'yearly']),
  monthly_rent_cents: z.number().int().nonnegative().optional(),
  yearly_rent_cents: z.number().int().nonnegative().optional(),
  department_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  payment_account_id: uuidSchema.optional(),
  address: z.string().optional(),
  area_sqm: z.number().positive().optional(),
  payment_period_months: z.number().int().positive().optional(),
  landlord_name: z.string().optional(),
  landlord_contact: z.string().optional(),
  lease_start_date: dateSchema.optional(),
  lease_end_date: dateSchema.optional(),
  deposit_cents: z.number().int().nonnegative().optional(),
  payment_method: z.string().optional(),
  payment_day: z.number().int().min(1).max(31).optional(),
  status: z.string().optional(),
  contract_file_url: z.string().url().optional(),
  memo: z.string().optional(),
}).refine(
  (data) => {
    if (data.rent_type === 'yearly') {
      return data.yearly_rent_cents !== undefined && data.yearly_rent_cents > 0
    } else {
      return data.monthly_rent_cents !== undefined && data.monthly_rent_cents > 0
    }
  },
  {
    message: '年租模式需要yearly_rent_cents参数，月租模式需要monthly_rent_cents参数',
    path: ['rent_type'],
  }
)

/**
 * 创建站点Schema
 */
export const createSiteSchema = z.object({
  department_id: uuidSchema,
  name: z.string().min(1, 'name参数必填'),
  site_code: z.string().optional(),
})

/**
 * 更新站点Schema
 */
export const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  department_id: uuidSchema.optional(),
  active: z.number().int().min(0).max(1).optional(),
  site_code: z.string().optional(),
})

/**
 * 创建账户Schema
 */
export const createAccountSchema = z.object({
  name: z.string().min(1, 'name参数必填'),
  type: z.string().min(1, 'type参数必填'),
  currency: z.string().length(3, 'currency必须是3位币种代码').optional(),
  alias: z.string().optional(),
  account_number: z.string().optional(),
  opening_cents: z.number().int().optional(),
})

/**
 * 更新账户Schema
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  currency: z.string().length(3).optional(),
  alias: z.string().optional(),
  account_number: z.string().optional(),
  active: z.number().int().min(0).max(1).optional(),
})

/**
 * 创建AR/AP文档Schema
 */
export const createArApDocSchema = z.object({
  kind: z.enum(['AR', 'AP'], { errorMap: () => ({ message: 'kind必须为AR或AP' }) }),
  party_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  issue_date: dateSchema.optional(),
  due_date: dateSchema.optional(),
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  doc_no: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 创建结算Schema
 */
export const createSettlementSchema = z.object({
  doc_id: uuidSchema,
  flow_id: uuidSchema,
  settle_amount_cents: z.number().int().positive('settle_amount_cents必须大于0'),
  settle_date: dateSchema.optional(),
})

/**
 * 确认AR/AP文档Schema
 */
export const confirmArApDocSchema = z.object({
  doc_id: uuidSchema,
  account_id: uuidSchema,
  category_id: uuidSchema,
  biz_date: dateSchema,
  voucher_url: z.string().url('voucher_url参数必填（凭证上传是必填的）'),
  method: z.string().optional(),
  memo: z.string().optional(),
  created_by: uuidSchema.optional(),
})

/**
 * 查询参数Schema - 日期范围
 */
export const dateRangeQuerySchema = z.object({
  start: dateSchema,
  end: dateSchema,
})

/**
 * 查询参数Schema - ID参数
 */
export const idQuerySchema = z.object({
  doc_id: uuidSchema.optional(),
  employee_id: uuidSchema.optional(),
  account_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
})

/**
 * 创建借款Schema
 */
export const createBorrowingSchema = z.object({
  user_id: uuidSchema,
  account_id: uuidSchema,
  amount: z.number().positive('金额必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  borrow_date: dateSchema,
  memo: z.string().optional(),
})

/**
 * 创建账户转账Schema
 */
export const createAccountTransferSchema = z.object({
  transfer_date: dateSchema,
  from_account_id: uuidSchema,
  to_account_id: uuidSchema,
  from_amount_cents: z.number().int().positive('转出金额必须大于0'),
  to_amount_cents: z.number().int().positive('转入金额必须大于0'),
  exchange_rate: z.number().positive().optional(),
  memo: z.string().optional(),
  voucher_url: z.string().url().optional(),
}).refine(
  (data) => data.from_account_id !== data.to_account_id,
  { message: '转出账户和转入账户不能相同', path: ['to_account_id'] }
)

/**
 * 创建固定资产Schema
 */
export const createFixedAssetSchema = z.object({
  asset_code: z.string().min(1, 'asset_code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchase_date: dateSchema.optional(),
  purchase_price_cents: z.number().int().nonnegative('purchase_price_cents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  department_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
  current_value_cents: z.number().int().nonnegative().optional(),
  depreciation_method: z.string().optional(),
  useful_life_years: z.number().int().positive().optional(),
  memo: z.string().optional(),
})

/**
 * 更新固定资产Schema
 */
export const updateFixedAssetSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  purchase_date: dateSchema.optional(),
  purchase_price_cents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  department_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
  memo: z.string().optional(),
})

/**
 * 分配固定资产Schema
 */
export const allocateFixedAssetSchema = z.object({
  asset_id: uuidSchema,
  employee_id: uuidSchema,
  allocation_date: dateSchema,
  allocation_type: z.enum(['employee_onboarding', 'transfer', 'temporary']).optional(),
  expected_return_date: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 创建固定资产折旧Schema
 */
export const createDepreciationSchema = z.object({
  asset_id: uuidSchema,
  depreciation_date: dateSchema,
  amount_cents: z.number().int().positive('折旧金额必须大于0'),
  memo: z.string().optional(),
})

/**
 * 批量更新员工补贴Schema
 */
export const batchUpdateEmployeeAllowancesSchema = z.object({
  employee_id: uuidSchema,
  allowance_type: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
  allowances: z.array(z.object({
    currency_id: z.string().length(3, 'currency_id必须是3位币种代码'),
    amount_cents: z.number().int().nonnegative('amount_cents必须大于等于0'),
  })).min(0, 'allowances必须是数组'),
})

/**
 * 创建站点账单Schema
 */
export const createSiteBillSchema = z.object({
  site_id: uuidSchema,
  bill_date: dateSchema,
  bill_type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'bill_type必须为income或expense' }) }),
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  description: z.string().optional(),
  account_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  status: z.string().optional(),
  payment_date: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 更新站点账单Schema
 */
export const updateSiteBillSchema = z.object({
  bill_date: dateSchema.optional(),
  bill_type: z.enum(['income', 'expense']).optional(),
  amount_cents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  account_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  status: z.string().optional(),
  payment_date: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 创建还款Schema
 */
export const createRepaymentSchema = z.object({
  borrowing_id: uuidSchema,
  account_id: uuidSchema,
  amount: z.number().positive('金额必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  repay_date: dateSchema,
  memo: z.string().optional(),
})

/**
 * 生成薪资单Schema
 */
export const generateSalaryPaymentsSchema = z.object({
  year: z.number().int().min(2000).max(2100, '年份必须在2000-2100之间'),
  month: z.number().int().min(1).max(12, '月份必须在1-12之间'),
})

/**
 * 生成补贴发放Schema
 */
export const generateAllowancePaymentsSchema = z.object({
  year: z.number().int().min(2000).max(2100, '年份必须在2000-2100之间'),
  month: z.number().int().min(1).max(12, '月份必须在1-12之间'),
  payment_date: dateSchema,
})

/**
 * 创建职位Schema
 */
export const createPositionSchema = z.object({
  code: z.string().min(1, 'code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  level: z.string().min(1, 'level参数必填'),
  scope: z.string().min(1, 'scope参数必填'),
  permissions: z.any(), // permissions可以是任意JSON对象
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
})

/**
 * 更新职位Schema
 */
export const updatePositionSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  level: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  permissions: z.any().optional(),
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  active: z.number().int().min(0).max(1).optional(),
})

/**
 * 创建薪资分配Schema
 */
export const createSalaryAllocationSchema = z.object({
  currency_id: z.string().length(3, 'currency_id必须是3位币种代码'),
  account_id: uuidSchema,
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  memo: z.string().optional(),
})

/**
 * 批量创建薪资分配Schema
 */
export const batchCreateSalaryAllocationsSchema = z.object({
  allocations: z.array(createSalaryAllocationSchema).min(1, 'allocations数组不能为空'),
})

/**
 * 员工申请薪资分配Schema（account_id可选）
 */
export const requestSalaryAllocationsSchema = z.object({
  allocations: z.array(z.object({
    currency_id: z.string().length(3, 'currency_id必须是3位币种代码'),
    account_id: uuidSchema.optional(),
    amount_cents: z.number().int().positive('amount_cents必须大于0'),
  })).min(1, 'allocations数组不能为空'),
})

/**
 * 创建津贴支付Schema
 */
export const createAllowancePaymentSchema = z.object({
  employee_id: uuidSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  allowance_type: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
  currency_id: z.string().length(3, 'currency_id必须是3位币种代码'),
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  payment_date: dateSchema,
  payment_method: z.enum(['cash', 'transfer']).optional(),
  voucher_url: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 更新津贴支付Schema
 */
export const updateAllowancePaymentSchema = z.object({
  amount_cents: z.number().int().positive().optional(),
  payment_date: dateSchema.optional(),
  payment_method: z.enum(['cash', 'transfer']).optional(),
  voucher_url: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * IP白名单Schema
 */
export const createIPWhitelistSchema = z.object({
  ip_address: z.string().min(1, 'ip_address参数必填'),
  description: z.string().optional(),
})

/**
 * 批量创建IP白名单Schema
 */
export const batchCreateIPWhitelistSchema = z.object({
  ips: z.array(z.object({
    ip: z.string().min(1, 'ip地址不能为空'),
    description: z.string().optional(),
  })).min(1, 'ips数组必填且不能为空'),
})

/**
 * 批量删除IP白名单Schema
 */
export const batchDeleteIPWhitelistSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'ids数组必填且不能为空'),
})

/**
 * 切换IP白名单规则Schema
 */
export const toggleIPWhitelistRuleSchema = z.object({
  enabled: z.boolean(),
})

/**
 * 系统配置Schema
 */
export const updateSystemConfigSchema = z.object({
  value: z.any(), // 可以是任意类型
  description: z.string().optional(),
})

/**
 * 站点配置Schema
 */
export const updateSiteConfigSchema = z.object({
  config_value: z.string().min(1, 'config_value必须是字符串'),
})

/**
 * 批量更新站点配置Schema
 */
export const batchUpdateSiteConfigSchema = z.record(z.string(), z.string())

/**
 * 创建员工薪资Schema
 */
export const createEmployeeSalarySchema = z.object({
  employee_id: uuidSchema,
  salary_type: z.enum(['probation', 'regular']),
  currency_id: z.string().length(3, 'currency_id必须是3位币种代码'),
  amount_cents: z.number().int().nonnegative('amount_cents必须大于等于0'),
})

/**
 * 创建租赁付款Schema
 */
export const createRentalPaymentSchema = z.object({
  property_id: uuidSchema,
  payment_date: dateSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount_cents: z.number().int().positive('amount_cents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  account_id: uuidSchema,
  category_id: uuidSchema.optional(),
  payment_method: z.string().optional(),
  voucher_url: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 更新租赁付款Schema
 */
export const updateRentalPaymentSchema = z.object({
  payment_date: dateSchema.optional(),
  amount_cents: z.number().int().positive().optional(),
  voucher_url: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 分配宿舍Schema
 */
export const allocateDormitorySchema = z.object({
  employee_id: uuidSchema,
  allocation_date: dateSchema,
  room_number: z.string().optional().nullable(),
  bed_number: z.string().optional().nullable(),
  monthly_rent_cents: z.number().int().nonnegative().optional().nullable(),
  memo: z.string().optional().nullable(),
})

/**
 * 更新员工Schema
 */
export const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  department_id: uuidSchema.optional(),
  org_department_id: uuidSchema.optional(),
  position_id: uuidSchema.optional(),
  join_date: dateSchema.optional(),
  probation_salary_cents: z.number().int().nonnegative().optional(),
  regular_salary_cents: z.number().int().nonnegative().optional(),
  living_allowance_cents: z.number().int().nonnegative().optional(),
  housing_allowance_cents: z.number().int().nonnegative().optional(),
  transportation_allowance_cents: z.number().int().nonnegative().optional(),
  meal_allowance_cents: z.number().int().nonnegative().optional(),
  active: z.number().int().min(0).max(1).optional(),
  phone: z.string().optional(),
  email: emailSchema.optional(),
  usdt_address: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  address: z.string().optional(),
  memo: z.string().optional(),
  birthday: dateSchema.optional(),
})

/**
 * 薪资单操作Schema（无参数操作）
 */
export const salaryPaymentActionSchema = z.object({}).optional()

/**
 * 薪资转账Schema
 */
export const salaryPaymentTransferSchema = z.object({
  account_id: uuidSchema,
})

/**
 * 固定资产转移Schema
 */
export const transferFixedAssetSchema = z.object({
  to_department_id: uuidSchema.optional(),
  to_site_id: uuidSchema.optional(),
  to_custodian: z.string().optional(),
  transfer_date: dateSchema,
  memo: z.string().optional(),
})

/**
 * 固定资产购买Schema
 */
export const purchaseFixedAssetSchema = z.object({
  asset_code: z.string().min(1, 'asset_code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchase_date: dateSchema,
  purchase_price_cents: z.number().int().nonnegative('purchase_price_cents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  account_id: uuidSchema,
  vendor_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 固定资产出售Schema
 */
export const sellFixedAssetSchema = z.object({
  sale_date: dateSchema,
  sale_price_cents: z.number().int().positive('sale_price_cents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  account_id: uuidSchema,
  category_id: uuidSchema,
  voucher_url: z.string().url().optional(),
  sale_buyer: z.string().optional(),
  sale_memo: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 资产归还Schema
 */
export const returnFixedAssetSchema = z.object({
  return_date: dateSchema,
  memo: z.string().optional(),
})

/**
 * 登录Schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password参数必填'),
  totp: z.string().optional(),
})

/**
 * 修改密码Schema
 */
export const changePasswordSchema = z.object({
  email: emailSchema,
  oldPassword: z.string().min(1, 'oldPassword参数必填'),
  newPassword: z.string().min(6, '密码长度至少6位'),
})

/**
 * 重置密码Schema
 */
export const resetPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password参数必填'),
})

/**
 * 绑定TOTP Schema
 */
export const bindTotpSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password参数必填'),
  secret: z.string().min(1, 'secret参数必填'),
  totp: z.string().min(1, 'totp参数必填'),
})

/**
 * 员工转正Schema
 */
export const regularizeEmployeeSchema = z.object({
  regular_date: dateSchema,
})

/**
 * 员工离职Schema
 */
export const leaveEmployeeSchema = z.object({
  leave_date: dateSchema,
  leave_type: z.enum(['resigned', 'terminated', 'expired', 'retired', 'other']),
  leave_reason: z.string().optional(),
  leave_memo: z.string().optional(),
  disable_account: z.boolean().optional(),
})

/**
 * 创建请假Schema
 */
export const createEmployeeLeaveSchema = z.object({
  employee_id: uuidSchema,
  leave_type: z.string().min(1, 'leave_type参数必填'),
  start_date: dateSchema,
  end_date: dateSchema,
  days: z.number().int().positive('days必须为正数'),
  reason: z.string().optional(),
  memo: z.string().optional(),
}).refine(
  (data) => {
    const start = new Date(data.start_date + 'T00:00:00Z')
    const end = new Date(data.end_date + 'T00:00:00Z')
    return start <= end
  },
  { message: '开始日期必须早于或等于结束日期', path: ['end_date'] }
)

/**
 * 审批请假Schema
 */
export const approveEmployeeLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  memo: z.string().optional(),
})

/**
 * 创建报销Schema
 */
export const createExpenseSchema = z.object({
  employee_id: uuidSchema,
  expense_type: z.string().min(1, 'expense_type参数必填'),
  amount_cents: z.number().int().positive('amount_cents必须为正数'),
  expense_date: dateSchema,
  description: z.string().min(1, 'description参数必填'),
  currency_id: z.string().min(1, 'currency_id参数必填'),
  voucher_url: z.string().url().min(1, 'voucher_url参数必填'),
  memo: z.string().optional(),
})

/**
 * 创建币种Schema
 */
export const createCurrencySchema = z.object({
  code: z.string().min(1, 'code参数必填').transform(val => val.trim().toUpperCase()),
  name: z.string().min(1, 'name参数必填'),
})

/**
 * 更新币种Schema
 */
export const updateCurrencySchema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional(),
}).refine(
  (data) => data.name !== undefined || data.active !== undefined,
  { message: '没有需要更新的字段' }
)

/**
 * 创建类别Schema
 */
export const createCategorySchema = z.object({
  name: z.string().min(1, 'name参数必填'),
  kind: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'kind必须为income或expense' }) }),
  parent_id: uuidSchema.optional().nullable(),
})

/**
 * 更新类别Schema
 */
export const updateCategorySchema = z.object({
  name: z.string().optional(),
  kind: z.enum(['income', 'expense']).optional(),
}).refine(
  (data) => data.name !== undefined || data.kind !== undefined,
  { message: '没有需要更新的字段' }
)

/**
 * 上传凭证Schema（用于文件上传验证）
 */
export const uploadVoucherSchema = z.object({
  file: z.instanceof(File, { message: '文件必填' })
    .refine((file) => file.size > 0, { message: '文件不能为空' })
    .refine((file) => file.size <= 10 * 1024 * 1024, { message: '文件过大（最大10MB）' })
    .refine((file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type), {
      message: '只允许上传图片格式（JPEG、PNG、GIF、WebP）'
    })
    .refine((file) => file.type === 'image/webp', {
      message: '请在前端将图片转换为WebP格式后上传'
    }),
})

/**
 * 固定资产购买Schema（包含流水相关字段）
 */
export const purchaseFixedAssetWithFlowSchema = z.object({
  asset_code: z.string().min(1, 'asset_code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchase_date: dateSchema,
  purchase_price_cents: z.number().int().nonnegative('purchase_price_cents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  account_id: uuidSchema,
  category_id: uuidSchema,
  vendor_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  memo: z.string().optional(),
  voucher_url: z.string().url().optional(),
  depreciation_method: z.string().optional(),
  useful_life_years: z.number().int().positive().optional(),
})







