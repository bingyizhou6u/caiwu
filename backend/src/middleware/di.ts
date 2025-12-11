import { Context, Next } from 'hono'
import { createDb } from '../db/index.js'
import { SystemConfigService } from '../services/SystemConfigService.js'
import { EmployeeService } from '../services/EmployeeService.js'
import { UserService } from '../services/UserService.js'
import { FinanceService } from '../services/FinanceService.js'
import { ImportService } from '../services/ImportService.js'
import { SalaryPaymentService } from '../services/SalaryPaymentService.js'
import { ReportService } from '../services/ReportService.js'
import { AuthService } from '../services/AuthService.js'
import { MasterDataService } from '../services/MasterDataService.js'
import { FixedAssetService } from '../services/FixedAssetService.js'
import { RentalService } from '../services/RentalService.js'
import { ApprovalService } from '../services/ApprovalService.js'
import { MyService } from '../services/MyService.js'
import { AuditService } from '../services/AuditService.js'
import { IPWhitelistService } from '../services/IPWhitelistService.js'
import { PositionService } from '../services/PositionService.js'
import { SalaryService } from '../services/SalaryService.js'
import { AllowanceService } from '../services/AllowanceService.js'
import { AllowancePaymentService } from '../services/AllowancePaymentService.js'

import type { Env, AppVariables } from '../types.js'

export const di = async (c: Context<{ Bindings: Env, Variables: AppVariables }>, next: Next) => {
    const db = createDb(c.env.DB)

    // Initialize services
    const systemConfigService = new SystemConfigService(db)

    const userService = new UserService(db) // Updated to use Drizzle db
    const employeeService = new EmployeeService(db)
    const financeService = new FinanceService(db)
    const importService = new ImportService(db)
    const salaryPaymentService = new SalaryPaymentService(db)
    const reportService = new ReportService(db)
    const authService = new AuthService(db, c.env.SESSIONS_KV, systemConfigService) // Updated to use Drizzle db
    const masterDataService = new MasterDataService(db) // Updated to use Drizzle db
    const fixedAssetService = new FixedAssetService(db)
    const rentalService = new RentalService(db)
    const approvalService = new ApprovalService(db)
    const myService = new MyService(db)
    const auditService = new AuditService(db)
    const ipWhitelistService = new IPWhitelistService(c.env)
    const positionService = new PositionService(db, c.env.SESSIONS_KV)
    const salaryService = new SalaryService(db)
    const allowanceService = new AllowanceService(db)
    const allowancePaymentService = new AllowancePaymentService(db)

    // Inject into context
    c.set('db', db)
    c.set('services', {
        systemConfig: systemConfigService,
        finance: financeService,
        user: userService,
        employee: employeeService,
        import: importService,
        salaryPayment: salaryPaymentService,
        report: reportService,
        auth: authService,
        masterData: masterDataService,
        fixedAsset: fixedAssetService,
        rental: rentalService,
        approval: approvalService,
        my: myService,
        audit: auditService,
        ipWhitelist: ipWhitelistService,
        position: positionService,
        salary: salaryService,
        allowance: allowanceService,
        allowancePayment: allowancePaymentService
    })

    await next()
}
