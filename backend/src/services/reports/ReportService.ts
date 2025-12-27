/**
 * 报表服务（门面模式）
 * 委托给具体的报表服务类
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { AnnualLeaveService } from '../hr/AnnualLeaveService.js'
import { DashboardReportService } from './DashboardReportService.js'
import { FinancialReportService } from './FinancialReportService.js'
import { BusinessReportService } from './BusinessReportService.js'

export class ReportService {
  private dashboardService: DashboardReportService
  private financialService: FinancialReportService
  private businessService: BusinessReportService

  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private annualLeaveService: AnnualLeaveService,
    private kv: KVNamespace
  ) {
    this.dashboardService = new DashboardReportService(db, kv)
    this.financialService = new FinancialReportService(db, kv)
    this.businessService = new BusinessReportService(db, annualLeaveService, kv)
  }

  async getDashboardStats(projectId?: string) {
    return this.dashboardService.getDashboardStats(projectId)
  }

  async getDepartmentCashFlow(start: string, end: string, projectIds?: string[]) {
    return this.businessService.getDepartmentCashFlow(start, end, projectIds)
  }

  async getSiteGrowth(start: string, end: string, projectId?: string) {
    return this.businessService.getSiteGrowth(start, end, projectId)
  }

  async getArApSummary(kind: 'AR' | 'AP', start: string, end: string, projectId?: string) {
    return this.financialService.getArApSummary(kind, start, end, projectId)
  }

  async getArApDetail(kind: 'AR' | 'AP', start: string, end: string, projectId?: string) {
    return this.financialService.getArApDetail(kind, start, end, projectId)
  }

  async getExpenseSummary(start: string, end: string, projectId?: string) {
    return this.financialService.getExpenseSummary(start, end, projectId)
  }

  async getExpenseDetail(start: string, end: string, categoryId?: string, projectId?: string) {
    return this.financialService.getExpenseDetail(start, end, categoryId, projectId)
  }

  async getAccountBalance(asOf: string): Promise<{ rows: any[]; asOf: string }> {
    return this.financialService.getAccountBalance(asOf)
  }

  // Note: getBorrowingSummary and getBorrowingDetail removed - borrowing tracked via flows

  async getNewSiteRevenue(start: string, end: string, days: number = 30, projectId?: string) {
    return this.businessService.getNewSiteRevenue(start, end, days, projectId)
  }

  async getEmployeeSalaryReport(
    year: number,
    month?: number,
    projectId?: string,
    useCache = true
  ) {
    return this.businessService.getEmployeeSalaryReport(year, month, projectId, useCache)
  }

  async getAnnualLeaveReport(projectId?: string, orgDepartmentId?: string) {
    return this.businessService.getAnnualLeaveReport(projectId, orgDepartmentId)
  }
}
