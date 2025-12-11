/**
 * 通用业务Schema定义
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema, emailSchema } from './common.schema.js'

/**
 * 创建现金流Schema
 */
export const createCashFlowSchema = z.object({
  accountId: uuidSchema,
  categoryId: uuidSchema,
  bizDate: dateSchema,
  type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'type必须为income或expense' }) }),
  amountCents: z.number().int().positive('amountCents必须大于0'),
  voucherUrls: z.array(z.string().url('凭证URL格式不正确')).optional(),
  voucherUrl: z.string().url().optional(), // 向后兼容
  voucherNo: z.string().optional(),
  method: z.string().optional(),
  siteId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  ownerScope: z.enum(['hq', 'department']).optional(),
  counterparty: z.string().optional(),
  memo: z.string().optional(),
  createdBy: uuidSchema.optional(),
}).refine(
  (data) => {
    // 如果提供了voucherUrls，使用它；否则检查voucherUrl
    if (data.voucherUrls && data.voucherUrls.length > 0) return true
    if (data.voucherUrl) return true
    return false
  },
  { message: 'voucherUrls参数必填（凭证上传是必填的）' }
)

/**
 * 创建员工Schema
 */
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'name参数必填'),
  orgDepartmentId: uuidSchema,
  positionId: uuidSchema,
  departmentId: uuidSchema.optional(),
  joinDate: dateSchema,
  email: emailSchema,
  birthday: dateSchema,
  phone: z.string().optional(),
  // Salary data now managed via employee_salaries table
  probationSalaries: z.array(z.object({
    currencyId: z.string(),
    amountCents: z.number().int().nonnegative(),
  })).optional(),
  regularSalaries: z.array(z.object({
    currencyId: z.string(),
    amountCents: z.number().int().nonnegative(),
  })).optional(),
  // Allowance data now managed via employee_allowances table
  usdtAddress: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  address: z.string().optional(),
  memo: z.string().optional(),
  workSchedule: z.object({
    days: z.array(z.number().int().min(1).max(7)),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  annualLeaveCycleMonths: z.number().int().min(6).max(12).optional(),
  annualLeaveDays: z.number().int().min(0).max(365).optional(),
})

/**
 * 创建租赁房屋Schema
 */
export const createRentalPropertySchema = z.object({
  propertyCode: z.string().min(1, 'propertyCode参数必填'),
  name: z.string().min(1, 'name参数必填'),
  propertyType: z.enum(['office', 'warehouse', 'dormitory', 'other']),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  rentType: z.enum(['monthly', 'yearly']),
  monthlyRentCents: z.number().int().nonnegative().optional(),
  yearlyRentCents: z.number().int().nonnegative().optional(),
  departmentId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  paymentAccountId: uuidSchema.optional(),
  address: z.string().optional(),
  areaSqm: z.number().positive().optional(),
  paymentPeriodMonths: z.number().int().positive().optional(),
  landlordName: z.string().optional(),
  landlordContact: z.string().optional(),
  leaseStartDate: dateSchema.optional(),
  leaseEndDate: dateSchema.optional(),
  depositCents: z.number().int().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  status: z.string().optional(),
  contractFileUrl: z.string().url().optional(),
  memo: z.string().optional(),
}).refine(
  (data) => {
    if (data.rentType === 'yearly') {
      return data.yearlyRentCents !== undefined && data.yearlyRentCents > 0
    } else {
      return data.monthlyRentCents !== undefined && data.monthlyRentCents > 0
    }
  },
  {
    message: '年租模式需要yearlyRentCents参数，月租模式需要monthlyRentCents参数',
    path: ['rentType'],
  }
)

/**
 * 创建站点Schema
 */
export const createSiteSchema = z.object({
  departmentId: uuidSchema,
  name: z.string().min(1, 'name参数必填'),
  siteCode: z.string().optional(),
})

/**
 * 更新站点Schema
 */
export const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: uuidSchema.optional(),
  active: z.number().int().min(0).max(1).optional(),
  siteCode: z.string().optional(),
})

/**
 * 创建账户Schema
 */
export const createAccountSchema = z.object({
  name: z.string().min(1, 'name参数必填'),
  type: z.string().min(1, 'type参数必填'),
  currency: z.string().length(3, 'currency必须是3位币种代码').optional(),
  alias: z.string().optional(),
  accountNumber: z.string().optional(),
  openingCents: z.number().int().optional(),
})

/**
 * 更新账户Schema
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  currency: z.string().length(3).optional(),
  alias: z.string().optional(),
  accountNumber: z.string().optional(),
  active: z.number().int().min(0).max(1).optional(),
})

/**
 * 创建AR/AP文档Schema
 */
export const createArApDocSchema = z.object({
  kind: z.enum(['AR', 'AP'], { errorMap: () => ({ message: 'kind必须为AR或AP' }) }),
  partyId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  issueDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  amountCents: z.number().int().positive('amountCents必须大于0'),
  docNo: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 创建结算Schema
 */
export const createSettlementSchema = z.object({
  docId: uuidSchema,
  flowId: uuidSchema,
  settleAmountCents: z.number().int().positive('settleAmountCents必须大于0'),
  settleDate: dateSchema.optional(),
})

/**
 * 确认AR/AP文档Schema
 */
export const confirmArApDocSchema = z.object({
  docId: uuidSchema,
  accountId: uuidSchema,
  categoryId: uuidSchema,
  bizDate: dateSchema,
  voucherUrl: z.string().url('voucherUrl参数必填（凭证上传是必填的）'),
  method: z.string().optional(),
  memo: z.string().optional(),
  createdBy: uuidSchema.optional(),
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
  docId: uuidSchema.optional(),
  employeeId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
})

/**
 * 创建借款Schema
 */
export const createBorrowingSchema = z.object({
  userId: uuidSchema,
  accountId: uuidSchema,
  amount: z.number().positive('金额必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  borrowDate: dateSchema,
  memo: z.string().optional(),
})

/**
 * 创建账户转账Schema
 */
export const createAccountTransferSchema = z.object({
  transferDate: dateSchema,
  fromAccountId: uuidSchema,
  toAccountId: uuidSchema,
  fromAmountCents: z.number().int().positive('转出金额必须大于0'),
  toAmountCents: z.number().int().positive('转入金额必须大于0'),
  exchangeRate: z.number().positive().optional(),
  memo: z.string().optional(),
  voucherUrl: z.string().url().optional(),
}).refine(
  (data) => data.fromAccountId !== data.toAccountId,
  { message: '转出账户和转入账户不能相同', path: ['toAccountId'] }
)

/**
 * 创建固定资产Schema
 */
export const createFixedAssetSchema = z.object({
  assetCode: z.string().min(1, 'assetCode参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchaseDate: dateSchema.optional(),
  purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  departmentId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  vendorId: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
  currentValueCents: z.number().int().nonnegative().optional(),
  depreciationMethod: z.string().optional(),
  usefulLifeYears: z.number().int().positive().optional(),
  memo: z.string().optional(),
})

/**
 * 更新固定资产Schema
 */
export const updateFixedAssetSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  purchaseDate: dateSchema.optional(),
  purchasePriceCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  departmentId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  vendorId: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
  memo: z.string().optional(),
})

/**
 * 分配固定资产Schema
 */
export const allocateFixedAssetSchema = z.object({
  assetId: uuidSchema,
  employeeId: uuidSchema,
  allocationDate: dateSchema,
  allocationType: z.enum(['employee_onboarding', 'transfer', 'temporary']).optional(),
  expectedReturnDate: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 创建固定资产折旧Schema
 */
export const createDepreciationSchema = z.object({
  assetId: uuidSchema,
  depreciationDate: dateSchema,
  amountCents: z.number().int().positive('折旧金额必须大于0'),
  memo: z.string().optional(),
})

/**
 * 创建员工补贴Schema
 */
export const createEmployeeAllowanceSchema = z.object({
  employeeId: uuidSchema,
  allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
  currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
  amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
})

/**
 * 批量更新员工补贴Schema
 */
export const batchUpdateEmployeeAllowancesSchema = z.object({
  employeeId: uuidSchema,
  allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
  allowances: z.array(z.object({
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
  })).min(0, 'allowances必须是数组'),
})

export const employeeAllowanceResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  allowanceType: z.string(),
  currencyId: z.string(),
  amountCents: z.number(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  currencyName: z.string().nullable(),
  employeeName: z.string().nullable()
})

export const listEmployeeAllowancesResponseSchema = z.object({
  results: z.array(employeeAllowanceResponseSchema)
})

/**
 * 创建站点账单Schema
 */
export const createSiteBillSchema = z.object({
  siteId: uuidSchema,
  billDate: dateSchema,
  billType: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'billType必须为income或expense' }) }),
  amountCents: z.number().int().positive('amountCents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  description: z.string().optional(),
  accountId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  status: z.string().optional(),
  paymentDate: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 更新站点账单Schema
 */
export const updateSiteBillSchema = z.object({
  billDate: dateSchema.optional(),
  billType: z.enum(['income', 'expense']).optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  accountId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  status: z.string().optional(),
  paymentDate: dateSchema.optional(),
  memo: z.string().optional(),
})

/**
 * 创建还款Schema
 */
export const createRepaymentSchema = z.object({
  borrowingId: uuidSchema,
  accountId: uuidSchema,
  amount: z.number().positive('金额必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  repayDate: dateSchema,
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
  paymentDate: dateSchema,
})

/**
 * 创建职位Schema
 */
export const createPositionSchema = z.object({
  code: z.string().min(1, 'code参数必填'),
  name: z.string().min(1, 'name参数必填'),
  level: z.number().int('level必须是整数'),
  functionRole: z.enum(['director', 'hr', 'finance', 'admin', 'developer', 'support', 'member'], { errorMap: () => ({ message: '无效的职能角色' }) }),
  permissions: z.any(), // permissions可以是任意JSON对象
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

/**
 * 更新职位Schema
 */
export const updatePositionSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  level: z.number().int().optional(),
  functionRole: z.enum(['director', 'hr', 'finance', 'admin', 'developer', 'support', 'member']).optional(),
  permissions: z.any().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.number().int().min(0).max(1).optional(),
})

/**
 * 创建薪资分配Schema
 */
export const createSalaryAllocationSchema = z.object({
  currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
  accountId: uuidSchema,
  amountCents: z.number().int().positive('amountCents必须大于0'),
  memo: z.string().optional(),
})

/**
 * 批量创建薪资分配Schema
 */
export const batchCreateSalaryAllocationsSchema = z.object({
  allocations: z.array(createSalaryAllocationSchema).min(1, 'allocations数组不能为空'),
})

/**
 * 员工申请薪资分配Schema（accountId可选）
 */
export const requestSalaryAllocationsSchema = z.object({
  allocations: z.array(z.object({
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    accountId: uuidSchema.optional(),
    amountCents: z.number().int().positive('amountCents必须大于0'),
  })).min(1, 'allocations数组不能为空'),
})

/**
 * 创建津贴支付Schema
 */
export const createAllowancePaymentSchema = z.object({
  employeeId: uuidSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
  currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
  amountCents: z.number().int().positive('amountCents必须大于0'),
  paymentDate: dateSchema,
  paymentMethod: z.enum(['cash', 'transfer']).optional(),
  voucherUrl: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 更新津贴支付Schema
 */
export const updateAllowancePaymentSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  paymentDate: dateSchema.optional(),
  paymentMethod: z.enum(['cash', 'transfer']).optional(),
  voucherUrl: z.string().url().optional(),
  memo: z.string().optional(),
})

export const allowancePaymentResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  year: z.number(),
  month: z.number(),
  allowanceType: z.string(),
  currencyId: z.string(),
  amountCents: z.number(),
  paymentDate: z.string(),
  paymentMethod: z.string().nullable(),
  voucherUrl: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  employeeName: z.string().nullable(),
  departmentName: z.string().nullable(),
  currencyName: z.string().nullable(),
  createdByName: z.string().nullable()
})

export const listAllowancePaymentsResponseSchema = z.object({
  results: z.array(allowancePaymentResponseSchema)
})

/**
 * IP白名单Schema
 */
export const createIPWhitelistSchema = z.object({
  ipAddress: z.string().min(1, 'ipAddress参数必填'),
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
  configValue: z.string().min(1, 'configValue必须是字符串'),
})

/**
 * 批量更新站点配置Schema
 */
export const batchUpdateSiteConfigSchema = z.record(z.string(), z.string())

/**
 * 创建员工薪资Schema
 */
export const createEmployeeSalarySchema = z.object({
  employeeId: uuidSchema,
  salaryType: z.enum(['probation', 'regular']),
  currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
  amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
})

/**
 * 创建租赁付款Schema
 */
export const createRentalPaymentSchema = z.object({
  propertyId: uuidSchema,
  paymentDate: dateSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amountCents: z.number().int().positive('amountCents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  accountId: uuidSchema,
  categoryId: uuidSchema.optional(),
  paymentMethod: z.string().optional(),
  voucherUrl: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 更新租赁付款Schema
 */
export const updateRentalPaymentSchema = z.object({
  paymentDate: dateSchema.optional(),
  amountCents: z.number().int().positive().optional(),
  voucherUrl: z.string().url().optional(),
  memo: z.string().optional(),
})

/**
 * 分配宿舍Schema
 */
export const allocateDormitorySchema = z.object({
  employeeId: uuidSchema,
  allocationDate: dateSchema,
  roomNumber: z.string().optional().nullable(),
  bedNumber: z.string().optional().nullable(),
  monthlyRentCents: z.number().int().nonnegative().optional().nullable(),
  memo: z.string().optional().nullable(),
})

/**
 * 更新员工Schema
 */
export const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: z.string().optional(), // 允许 "hq" 或其他字符串，后端会处理
  orgDepartmentId: z.string().optional().nullable(), // 允许特殊值，后端会处理
  positionId: z.string().optional().nullable(), // 允许特殊值（如 "p001"），后端会处理
  joinDate: dateSchema.optional(),
  // Salary/allowance data now managed via employee_salaries and employee_allowances tables
  active: z.number().int().min(0).max(1).optional(),
  phone: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    // 如果只有区号（如 '+971'），也视为空
    if (typeof val === 'string' && val.length <= 5) return null
    return val
  }, z.string().nullable().optional()),
  email: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.string().email('邮箱格式不正确').nullable().optional()),
  usdtAddress: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.string().nullable().optional()),
  emergencyContact: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.string().nullable().optional()),
  emergencyPhone: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    // 如果只有区号（如 '+971'），也视为空
    if (typeof val === 'string' && val.length <= 5) return null
    return val
  }, z.string().nullable().optional()),
  address: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.string().nullable().optional()),
  memo: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.string().nullable().optional()),
  birthday: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return null
    return val
  }, z.union([dateSchema, z.null()]).optional()),
  workSchedule: z.object({
    days: z.array(z.number().int().min(1).max(7)),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional().nullable(),
  annualLeaveCycleMonths: z.number().int().min(6).max(12).optional(),
  annualLeaveDays: z.number().int().min(0).max(365).optional(),
})

/**
 * 薪资单操作Schema（无参数操作）
 */
export const salaryPaymentActionSchema = z.object({}).optional()

/**
 * 薪资转账Schema
 */
export const salaryPaymentTransferSchema = z.object({
  accountId: uuidSchema,
})

/**
 * 固定资产转移Schema
 */
export const transferFixedAssetSchema = z.object({
  toDepartmentId: uuidSchema.optional(),
  toSiteId: uuidSchema.optional(),
  toCustodian: z.string().optional(),
  transferDate: dateSchema,
  memo: z.string().optional(),
})

/**
 * 固定资产购买Schema
 */
export const purchaseFixedAssetSchema = z.object({
  assetCode: z.string().min(1, 'assetCode参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchaseDate: dateSchema,
  purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  accountId: uuidSchema,
  vendorId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 固定资产出售Schema
 */
export const sellFixedAssetSchema = z.object({
  saleDate: dateSchema,
  salePriceCents: z.number().int().positive('salePriceCents必须大于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  accountId: uuidSchema,
  categoryId: uuidSchema,
  voucherUrl: z.string().url().optional(),
  saleBuyer: z.string().optional(),
  saleMemo: z.string().optional(),
  memo: z.string().optional(),
})

/**
 * 资产归还Schema
 */
export const returnFixedAssetSchema = z.object({
  returnDate: dateSchema,
  returnType: z.enum(['employee_resignation', 'transfer', 'expired', 'other']).optional(),
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
  oldPassword: z.string().optional(), // Optional for first password change
  newPassword: z.string().min(6, '密码长度至少6位'),
  totpCode: z.string().length(6, 'TOTP验证码必须为6位').optional(),
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
  regularDate: dateSchema,
})

/**
 * 员工离职Schema
 */
export const leaveEmployeeSchema = z.object({
  leaveDate: dateSchema,
  leaveType: z.enum(['resigned', 'terminated', 'expired', 'retired', 'other']),
  leaveReason: z.string().optional(),
  leaveMemo: z.string().optional(),
  disableAccount: z.boolean().optional(),
})

/**
 * 创建请假Schema
 */
export const createEmployeeLeaveSchema = z.object({
  employeeId: uuidSchema,
  leaveType: z.string().min(1, 'leaveType参数必填'),
  startDate: dateSchema,
  endDate: dateSchema,
  days: z.number().int().positive('days必须为正数'),
  reason: z.string().optional(),
  memo: z.string().optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate + 'T00:00:00Z')
    const end = new Date(data.endDate + 'T00:00:00Z')
    return start <= end
  },
  { message: '开始日期必须早于或等于结束日期', path: ['endDate'] }
)

export const fixedAssetResponseSchema = z.object({
  id: z.string(),
  assetCode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  purchasePriceCents: z.number(),
  currency: z.string(),
  vendorId: z.string().nullable(),
  departmentId: z.string().nullable(),
  siteId: z.string().nullable(),
  custodian: z.string().nullable(),
  status: z.string().nullable(),
  depreciationMethod: z.string().nullable(),
  usefulLifeYears: z.number().nullable(),
  currentValueCents: z.number().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  departmentName: z.string().nullable(),
  siteName: z.string().nullable(),
  vendorName: z.string().nullable(),
  currencyName: z.string().nullable(),
  createdByName: z.string().nullable(),
  depreciations: z.array(z.any()).optional(),
  changes: z.array(z.any()).optional()
})

export const listFixedAssetsResponseSchema = z.object({
  results: z.array(fixedAssetResponseSchema)
})

export const fixedAssetAllocationResponseSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  employeeId: z.string(),
  allocationDate: z.string(),
  allocationType: z.string().nullable(),
  returnDate: z.string().nullable(),
  returnType: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  assetCode: z.string().nullable(),
  assetName: z.string().nullable(),
  employeeName: z.string().nullable(),
  employeeDepartmentId: z.string().nullable(),
  employeeDepartmentName: z.string().nullable(),
  createdByName: z.string().nullable()
})

export const listFixedAssetAllocationsResponseSchema = z.object({
  results: z.array(fixedAssetAllocationResponseSchema)
})

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
  employeeId: uuidSchema,
  expenseType: z.string().min(1, 'expenseType参数必填'),
  amountCents: z.number().int().positive('amountCents必须为正数'),
  expenseDate: dateSchema,
  description: z.string().min(1, 'description参数必填'),
  currencyId: z.string().min(1, 'currencyId参数必填'),
  voucherUrl: z.string().url().min(1, 'voucherUrl参数必填'),
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
  parentId: uuidSchema.optional().nullable(),
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
  assetCode: z.string().min(1, 'assetCode参数必填'),
  name: z.string().min(1, 'name参数必填'),
  category: z.string().optional(),
  purchaseDate: dateSchema,
  purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
  currency: z.string().length(3, 'currency必须是3位币种代码'),
  accountId: uuidSchema,
  categoryId: uuidSchema,
  vendorId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  siteId: uuidSchema.optional(),
  custodian: z.string().optional(),
  location: z.string().optional(),
  memo: z.string().optional(),
  voucherUrl: z.string().url().optional(),
  depreciationMethod: z.string().optional(),
  usefulLifeYears: z.number().int().positive().optional(),
})








/**
 * 更新租赁房屋Schema
 */
export const updateRentalPropertySchema = z.object({
  name: z.string().optional(),
  propertyType: z.string().optional(),
  address: z.string().optional(),
  areaSqm: z.number().optional(),
  rentType: z.string().optional(),
  monthlyRentCents: z.number().optional(),
  yearlyRentCents: z.number().optional(),
  currency: z.string().length(3).optional(),
  paymentPeriodMonths: z.number().int().optional(),
  landlordName: z.string().optional(),
  landlordContact: z.string().optional(),
  leaseStartDate: dateSchema.optional(),
  leaseEndDate: dateSchema.optional(),
  depositCents: z.number().optional(),
  paymentMethod: z.string().optional(),
  paymentAccountId: uuidSchema.optional(),
  paymentDay: z.number().int().optional(),
  departmentId: uuidSchema.optional(),
  status: z.string().optional(),
  memo: z.string().optional(),
  contractFileUrl: z.string().url().optional(),
})

/**
 * 归还宿舍Schema
 */
export const returnDormitorySchema = z.object({
  returnDate: dateSchema,
  memo: z.string().optional(),
})
