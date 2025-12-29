/**
 * 通用业务Schema定义 - 桶文件
 * 重新导出所有拆分后的 schema 模块
 */

// 财务相关
export {
  createCashFlowSchema,
  createAccountSchema,
  updateAccountSchema,
  createArApDocSchema,
  createSettlementSchema,
  confirmArApDocSchema,
  createBorrowingSchema,
  createRepaymentSchema,
  createAccountTransferSchema,
  createCurrencySchema,
  updateCurrencySchema,
  createCategorySchema,
  updateCategorySchema,
} from './finance.schema.js'

// 固定资产相关
export {
  createFixedAssetSchema,
  updateFixedAssetSchema,
  allocateFixedAssetSchema,
  createDepreciationSchema,
  transferFixedAssetSchema,
  purchaseFixedAssetSchema,
  sellFixedAssetSchema,
  returnFixedAssetSchema,
  purchaseFixedAssetWithFlowSchema,
  fixedAssetResponseSchema,
  listFixedAssetsResponseSchema,
  fixedAssetAllocationResponseSchema,
  listFixedAssetAllocationsResponseSchema,
} from './asset.schema.js'

// HR相关
export {
  createEmployeeSchema,
  updateEmployeeSchema,
  regularizeEmployeeSchema,
  leaveEmployeeSchema,
  createEmployeeSalarySchema,
  generateSalaryPaymentsSchema,
  salaryPaymentActionSchema,
  salaryPaymentTransferSchema,
  createSalaryAllocationSchema,
  batchCreateSalaryAllocationsSchema,
  requestSalaryAllocationsSchema,
  createEmployeeAllowanceSchema,
  batchUpdateEmployeeAllowancesSchema,
  generateAllowancePaymentsSchema,
  createAllowancePaymentSchema,
  updateAllowancePaymentSchema,
  createEmployeeLeaveSchema,
  approveEmployeeLeaveSchema,
  createExpenseSchema,
  employeeAllowanceResponseSchema,
  listEmployeeAllowancesResponseSchema,
  allowancePaymentResponseSchema,
  listAllowancePaymentsResponseSchema,
} from './hr.schema.js'

// 租赁相关
export {
  createRentalPropertySchema,
  updateRentalPropertySchema,
  createRentalPaymentSchema,
  updateRentalPaymentSchema,
  allocateDormitorySchema,
  returnDormitorySchema,
} from './rental.schema.js'

// 站点相关
export {
  createSiteSchema,
  updateSiteSchema,
  createSiteBillSchema,
  updateSiteBillSchema,
  updateSiteConfigSchema,
  batchUpdateSiteConfigSchema,
} from './site.schema.js'

// 系统相关
export {
  createPositionSchema,
  updatePositionSchema,
  updateSystemConfigSchema,
  dateRangeQuerySchema,
  idQuerySchema,
  uploadVoucherSchema,
} from './system.schema.js'


