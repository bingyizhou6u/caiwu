import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'

/**
 * 报表相关 Hooks
 */

interface ReportParams {
  start: string
  end: string
}

/**
 * 应付账款汇总
 */
export interface APSummaryResponse {
  rows: Array<{
    id: string
    docNo: string
    issueDate: string
    dueDate: string
    partyId: string
    amountCents: number
    settledCents: number
    status: string
  }>
  totalCents: number
  settledCents: number
  byStatus: Record<string, number>
}

export function useAPSummary(params: ReportParams) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)

  return useApiQuery<APSummaryResponse>(
    ['reports', 'apSummary', params],
    `${api.reports.apSummary}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 应付账款明细
 */
export interface APDetailResponse {
  rows: Array<{
    id: string
    docNo: string
    issueDate: string
    dueDate: string
    partyId: string
    amountCents: number
    settledCents: number
    remainingCents: number
    status: string
    memo?: string
  }>
}

export function useAPDetail(params: ReportParams) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)

  return useApiQuery<APDetailResponse>(
    ['reports', 'apDetail', params],
    `${api.reports.apDetail}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 应收账款汇总
 */
export interface ARSummaryResponse {
  rows: Array<{
    id: string
    docNo: string
    issueDate: string
    dueDate: string
    partyId: string
    amountCents: number
    settledCents: number
    status: string
  }>
  totalCents: number
  settledCents: number
  byStatus: Record<string, number>
}

export function useARSummary(params: ReportParams & { kind?: string }) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)
  if (params.kind) queryParams.append('kind', params.kind)

  return useApiQuery<ARSummaryResponse>(
    ['reports', 'arSummary', params],
    `${api.reports.arSummary}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 应收账款明细
 */
export interface ARDetailResponse {
  rows: Array<{
    id: string
    docNo: string
    issueDate: string
    dueDate: string
    partyId: string
    amountCents: number
    settledCents: number
    remainingCents: number
    status: string
    memo?: string
  }>
}

export function useARDetail(params: ReportParams & { kind?: string }) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)
  if (params.kind) queryParams.append('kind', params.kind)

  return useApiQuery<ARDetailResponse>(
    ['reports', 'arDetail', params],
    `${api.reports.arDetail}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 费用明细报表
 */
export interface ExpenseDetailResponse {
  rows: Array<{
    id: string
    expenseDate: string
    expenseType: string
    categoryId?: string
    categoryName?: string
    amountCents: number
    currencyId?: string
    currencySymbol?: string
    description?: string
    departmentId?: string
    departmentName?: string
  }>
}

export function useExpenseDetail(params: ReportParams & { categoryId?: string }) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)
  if (params.categoryId) queryParams.append('categoryId', params.categoryId)

  return useApiQuery<ExpenseDetailResponse>(
    ['reports', 'expenseDetail', params],
    `${api.reports.expenseDetail}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 费用汇总报表
 */
export interface ExpenseSummaryResponse {
  rows: Array<{
    categoryId?: string
    categoryName?: string
    totalCents: number
    count: number
  }>
}

export function useExpenseSummary(params: ReportParams) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)

  return useApiQuery<ExpenseSummaryResponse>(
    ['reports', 'expenseSummary', params],
    `${api.reports.expenseSummary}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 年假报表
 */
export interface AnnualLeaveResponse {
  results: Array<{
    employeeId: string
    employeeName: string
    departmentName: string
    orgDepartmentName: string
    joinDate: string
    cycleNumber: number
    cycleStart: string
    cycleEnd: string
    isFirstCycle: boolean
    entitledDays: number
    usedDays: number
    remainingDays: number
    usageRate: number
  }>
  summary: {
    totalEmployees: number
    totalEntitled: number
    totalUsed: number
    totalRemaining: number
    avgUsageRate: number
  }
  config: {
    cycleMonths: number
    daysPerCycle: number
  }
}

export function useAnnualLeave(params?: { departmentId?: string }) {
  const queryParams = new URLSearchParams()
  if (params?.departmentId) queryParams.append('departmentId', params.departmentId)

  return useApiQuery<AnnualLeaveResponse>(
    ['reports', 'annualLeave', params],
    `${api.reports.annualLeave}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

/**
 * 借款报表 - 汇总
 */
export interface BorrowingSummaryResponse {
  results: Array<{
    userId: string
    borrowerName: string
    borrowerEmail?: string
    currency: string
    totalBorrowedCents: number
    totalRepaidCents: number
    balanceCents: number
  }>
}

export function useBorrowingSummary() {
  return useApiQuery<BorrowingSummaryResponse>(
    ['reports', 'borrowingSummary'],
    api.reports.borrowingSummary,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

/**
 * 借款报表 - 明细
 */
export interface BorrowingDetailResponse {
  user: {
    id: string
    name: string
    email?: string
  }
  borrowings: Array<{
    id: string
    userId: string
    amountCents: number
    currency: string
    memo?: string
    accountName?: string
    accountCurrency?: string
    creatorName?: string
    borrowDate: string
  }>
  repayments: Array<{
    id: string
    borrowingId: string
    userId: string
    amountCents: number
    currency: string
    repayDate: string
    memo?: string
    accountName?: string
    accountCurrency?: string
    creatorName?: string
    borrowDate?: string
  }>
}

export function useBorrowingDetail(userId: string) {
  return useApiQuery<BorrowingDetailResponse>(
    ['reports', 'borrowingDetail', userId],
    api.reports.borrowingDetail(userId),
    {
      enabled: !!userId,
      staleTime: 5 * 60 * 1000,
    }
  )
}

/**
 * 账户余额报表
 */
export interface AccountBalanceResponse {
  rows: Array<{
    accountId: string
    accountName: string
    accountType: string
    accountNumber?: string
    currency: string
    opening_cents: number
    income_cents: number
    expense_cents: number
    closing_cents: number
    transactionDate?: string
    transaction_type?: string
    amountCents?: number
    balance_before_cents?: number
    balance_after_cents?: number
    voucherNo?: string
    memo?: string
    counterparty?: string
    categoryName?: string
    voucherUrl?: string
  }>
}

export function useAccountBalance(params: { asOf: string }) {
  const queryParams = new URLSearchParams()
  queryParams.append('as_of', params.asOf)

  return useApiQuery<AccountBalanceResponse>(
    ['reports', 'accountBalance', params],
    `${api.reports.accountBalance}?${queryParams.toString()}`,
    {
      enabled: !!params.asOf,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 项目汇总报表
 */
export interface DepartmentCashResponse {
  rows: Array<{
    departmentId: string
    departmentName: string
    incomeCents: number
    expenseCents: number
    netCents: number
  }>
}

export function useDepartmentCash(params: ReportParams) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)

  return useApiQuery<DepartmentCashResponse>(
    ['reports', 'departmentCash', params],
    `${api.reports.departmentCash}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

/**
 * 员工薪资报表
 */
export interface EmployeeSalaryResponse {
  results: Array<{
    employeeId: string
    employeeName: string
    departmentId: string
    departmentName?: string
    year: number
    month: number
    joinDate: string
    status: 'probation' | 'regular'
    regularDate?: string
    baseSalaryCents: number
    workDays: number
    daysInMonth: number
    leaveDays?: number
    actualSalaryCents: number
  }>
}

export function useEmployeeSalary(params: { year: number; month?: number }) {
  const queryParams = new URLSearchParams()
  queryParams.append('year', params.year.toString())
  if (params.month !== undefined) {
    queryParams.append('month', params.month.toString())
  }

  return useApiQuery<EmployeeSalaryResponse>(
    ['reports', 'employeeSalary', params],
    `${api.reports.employeeSalary}?${queryParams.toString()}`,
    {
      staleTime: 5 * 60 * 1000,
      select: (data: any) => {
        // 确保返回的数据格式正确
        if (data && typeof data === 'object') {
          if (Array.isArray(data.results)) {
            return data
          }
          // 如果 data 本身就是数组，包装成 { results: [...] }
          if (Array.isArray(data)) {
            return { results: data }
          }
        }
        // 默认返回空数组
        return { results: [] }
      },
    }
  )
}

/**
 * 站点增长报表
 */
export interface SiteGrowthResponse {
  rows: Array<{
    siteId: string
    siteName: string
    incomeCents: number
    expenseCents: number
    netCents: number
    prevIncomeCents: number
    growthRate: number
  }>
}

export function useSiteGrowth(params: ReportParams) {
  const queryParams = new URLSearchParams()
  queryParams.append('start', params.start)
  queryParams.append('end', params.end)

  return useApiQuery<SiteGrowthResponse>(
    ['reports', 'siteGrowth', params],
    `${api.reports.siteGrowth}?${queryParams.toString()}`,
    {
      enabled: !!params.start && !!params.end,
      staleTime: 2 * 60 * 1000,
    }
  )
}

