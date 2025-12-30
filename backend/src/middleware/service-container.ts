/**
 * 服务容器 - 优化的依赖注入实现
 * 
 * 特点：
 * 1. 懒加载：服务只在首次访问时创建
 * 2. 单例模式：同一请求内服务实例复用
 * 3. 依赖管理：自动处理服务间依赖
 * 4. 类型安全：完整的 TypeScript 类型支持
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import type { Env } from '../types/index.js'

// 服务类导入
import { SystemConfigService } from '../services/system/SystemConfigService.js'
import { KVCachedMasterDataService } from '../services/system/KVCachedMasterDataService.js'
import { AuditService } from '../services/system/AuditService.js'
import { OperationHistoryService } from '../services/system/OperationHistoryService.js'
import { PermissionAuditService } from '../services/system/PermissionAuditService.js'
import { OrgDepartmentService } from '../services/system/OrgDepartmentService.js'
import { EmployeeService } from '../services/hr/EmployeeService.js'
import { PositionService } from '../services/hr/PositionService.js'
import { PermissionService } from '../services/hr/PermissionService.js'
import { SalaryService } from '../services/hr/SalaryService.js'
import { SalaryPaymentService } from '../services/hr/SalaryPaymentService.js'
import { SalaryPaymentGenerationService } from '../services/hr/SalaryPaymentGenerationService.js'
import { SalaryPaymentProcessingService } from '../services/hr/SalaryPaymentProcessingService.js'
import { AllowanceService } from '../services/hr/AllowanceService.js'
import { AllowancePaymentService } from '../services/hr/AllowancePaymentService.js'
import { EmployeeLeaveService } from '../services/hr/EmployeeLeaveService.js'
import { ExpenseReimbursementService } from '../services/hr/ExpenseReimbursementService.js'
import { AttendanceService } from '../services/hr/AttendanceService.js'
import { AnnualLeaveService } from '../services/hr/AnnualLeaveService.js'
import { EmployeeProjectService } from '../services/hr/EmployeeProjectService.js'
import { FinanceService } from '../services/finance/FinanceService.js'
import { ImportService } from '../services/finance/ImportService.js'
import { SiteBillService } from '../services/finance/SiteBillService.js'
import { ArApService } from '../services/finance/ArApService.js'
import { AccountTransferService } from '../services/finance/AccountTransferService.js'
import { FixedAssetService } from '../services/assets/FixedAssetService.js'
import { FixedAssetAllocationService } from '../services/assets/FixedAssetAllocationService.js'
import { FixedAssetChangeService } from '../services/assets/FixedAssetChangeService.js'
import { FixedAssetDepreciationService } from '../services/assets/FixedAssetDepreciationService.js'
import { RentalService } from '../services/assets/RentalService.js'
import { ReportService } from '../services/reports/ReportService.js'
import { AuthService } from '../services/auth/AuthService.js'
import { ApprovalService } from '../services/common/ApprovalService.js'
import { NotificationService } from '../services/common/NotificationService.js'
import { MyService } from '../services/common/MyService.js'
import { EmailService } from '../services/common/EmailService.js'
import { ProjectService, TaskService, TaskTimelogService } from '../services/pm/index.js'
import { PermissionCache, createPermissionCache } from '../utils/permission-cache.js'

/**
 * 服务容器类
 * 使用懒加载模式，服务只在首次访问时创建
 */
export class ServiceContainer {
  private _cache = new Map<string, any>()

  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private env: Env
  ) { }

  /**
   * 获取或创建服务实例（懒加载）
   */
  private getOrCreate<T>(key: string, factory: () => T): T {
    if (!this._cache.has(key)) {
      this._cache.set(key, factory())
    }
    return this._cache.get(key) as T
  }

  // ==================== 系统服务 (System Services) ====================

  get systemConfig(): SystemConfigService {
    return this.getOrCreate('systemConfig', () =>
      new SystemConfigService(this.db, this.env.SESSIONS_KV)
    )
  }

  get masterData(): KVCachedMasterDataService {
    return this.getOrCreate('masterData', () =>
      new KVCachedMasterDataService(this.db, this.env.SESSIONS_KV)
    )
  }

  get audit(): AuditService {
    return this.getOrCreate('audit', () => new AuditService(this.db))
  }

  get operationHistory(): OperationHistoryService {
    return this.getOrCreate('operationHistory', () => new OperationHistoryService(this.db))
  }

  get orgDepartment(): OrgDepartmentService {
    return this.getOrCreate('orgDepartment', () => new OrgDepartmentService(this.db, this.permissionAudit, this.permissionCache))
  }

  get permissionAudit(): PermissionAuditService {
    return this.getOrCreate('permissionAudit', () => new PermissionAuditService(this.db))
  }

  get permissionCache(): PermissionCache {
    return this.getOrCreate('permissionCache', () =>
      createPermissionCache(this.env.SESSIONS_KV, this.db)
    )
  }

  // ==================== 认证服务 (Auth Services) ====================

  get auth(): AuthService {
    return this.getOrCreate('auth', () =>
      new AuthService(this.db, this.env.SESSIONS_KV, this.audit)
    )
  }

  // ==================== 通用服务 (Common Services) ====================

  get email(): EmailService {
    return this.getOrCreate('email', () => new EmailService(this.env as any))
  }

  get notification(): NotificationService {
    return this.getOrCreate('notification', () =>
      new NotificationService(this.db, this.email, this.systemConfig)
    )
  }

  get permission(): PermissionService {
    return this.getOrCreate('permission', () => new PermissionService(this.db))
  }

  // ==================== 人事服务 (HR Services) ====================

  get employee(): EmployeeService {
    return this.getOrCreate('employee', () => new EmployeeService(this.db, this.email, this.permissionAudit, this.permissionCache))
  }

  get position(): PositionService {
    return this.getOrCreate('position', () => new PositionService(this.db, this.permissionAudit, this.permissionCache))
  }

  get salary(): SalaryService {
    return this.getOrCreate('salary', () => new SalaryService(this.db))
  }

  get salaryPayment(): SalaryPaymentService {
    return this.getOrCreate('salaryPayment', () =>
      new SalaryPaymentService(this.db, this.operationHistory)
    )
  }

  get salaryPaymentGeneration(): SalaryPaymentGenerationService {
    return this.getOrCreate('salaryPaymentGeneration', () =>
      new SalaryPaymentGenerationService(this.db)
    )
  }

  get salaryPaymentProcessing(): SalaryPaymentProcessingService {
    return this.getOrCreate('salaryPaymentProcessing', () =>
      new SalaryPaymentProcessingService(this.db, this.operationHistory, this.salaryPayment)
    )
  }

  get allowance(): AllowanceService {
    return this.getOrCreate('allowance', () => new AllowanceService(this.db))
  }

  get allowancePayment(): AllowancePaymentService {
    return this.getOrCreate('allowancePayment', () => new AllowancePaymentService(this.db))
  }

  get employeeLeave(): EmployeeLeaveService {
    return this.getOrCreate('employeeLeave', () => new EmployeeLeaveService(this.db))
  }

  get expenseReimbursement(): ExpenseReimbursementService {
    return this.getOrCreate('expenseReimbursement', () => new ExpenseReimbursementService(this.db))
  }

  get attendance(): AttendanceService {
    return this.getOrCreate('attendance', () => new AttendanceService(this.db))
  }

  get annualLeave(): AnnualLeaveService {
    return this.getOrCreate('annualLeave', () => new AnnualLeaveService(this.db))
  }

  get employeeProject(): EmployeeProjectService {
    return this.getOrCreate('employeeProject', () => new EmployeeProjectService(this.db))
  }

  // ==================== 财务服务 (Finance Services) ====================

  get finance(): FinanceService {
    return this.getOrCreate('finance', () => new FinanceService(this.db))
  }

  get import(): ImportService {
    return this.getOrCreate('import', () => new ImportService(this.db))
  }

  get siteBill(): SiteBillService {
    return this.getOrCreate('siteBill', () => new SiteBillService(this.db))
  }

  get arAp(): ArApService {
    return this.getOrCreate('arAp', () => new ArApService(this.db, this.finance))
  }

  get accountTransfer(): AccountTransferService {
    return this.getOrCreate('accountTransfer', () =>
      new AccountTransferService(this.db, this.finance)
    )
  }

  // ==================== 资产服务 (Asset Services) ====================

  get fixedAsset(): FixedAssetService {
    return this.getOrCreate('fixedAsset', () => new FixedAssetService(this.db))
  }

  get fixedAssetAllocation(): FixedAssetAllocationService {
    return this.getOrCreate('fixedAssetAllocation', () => new FixedAssetAllocationService(this.db))
  }

  get fixedAssetChange(): FixedAssetChangeService {
    return this.getOrCreate('fixedAssetChange', () => new FixedAssetChangeService(this.db))
  }

  get fixedAssetDepreciation(): FixedAssetDepreciationService {
    return this.getOrCreate('fixedAssetDepreciation', () => new FixedAssetDepreciationService(this.db))
  }

  get rental(): RentalService {
    return this.getOrCreate('rental', () => new RentalService(this.db))
  }

  // ==================== 报表服务 (Report Services) ====================

  get report(): ReportService {
    return this.getOrCreate('report', () =>
      new ReportService(this.db, this.annualLeave, this.env.SESSIONS_KV)
    )
  }

  // ==================== 审批服务 (Approval Services) ====================

  get approval(): ApprovalService {
    return this.getOrCreate('approval', () =>
      new ApprovalService(
        this.db,
        this.permission,
        this.employee,
        this.finance,
        this.notification,
        this.operationHistory
      )
    )
  }

  // ==================== 个人服务 (My Services) ====================

  get my(): MyService {
    return this.getOrCreate('my', () =>
      new MyService(
        this.db,
        this.employeeLeave,
        this.expenseReimbursement,
        this.attendance,
        this.finance,
        this.allowancePayment,
        this.fixedAsset,
        this.fixedAssetAllocation,
        this.employee,
        this.annualLeave,
        this.salary
      )
    )
  }

  // ==================== 项目管理服务 (PM Services) ====================

  get project(): ProjectService {
    return this.getOrCreate('project', () => new ProjectService(this.db))
  }

  get task(): TaskService {
    return this.getOrCreate('task', () => new TaskService(this.db))
  }

  get taskTimelog(): TaskTimelogService {
    return this.getOrCreate('taskTimelog', () => new TaskTimelogService(this.db))
  }

  // ==================== 调试 (Debug) ====================

  /**
   * 获取已创建的服务数量（用于调试）
   */
  get createdServicesCount(): number {
    return this._cache.size
  }

  /**
   * 获取已创建的服务名称列表（用于调试）
   */
  get createdServiceNames(): string[] {
    return Array.from(this._cache.keys())
  }
}

/**
 * 创建服务容器
 */
export function createServiceContainer(
  db: DrizzleD1Database<typeof schema>,
  env: Env
): ServiceContainer {
  return new ServiceContainer(db, env)
}
