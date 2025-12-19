/**
 * 测试数据 Fixtures - 财务数据
 * 提供财务相关的测试数据
 */

import { v4 as uuid } from 'uuid'
import { FIXTURE_IDS } from './master-data'
import { EMPLOYEE_IDS } from './employees'

// 固定财务数据ID
export const FINANCE_IDS = {
  CASH_FLOW_INCOME_1: 'flow-001',
  CASH_FLOW_INCOME_2: 'flow-002',
  CASH_FLOW_EXPENSE_1: 'flow-003',
  CASH_FLOW_EXPENSE_2: 'flow-004',
  CASH_FLOW_TRANSFER: 'flow-005',
  AR_DOC_1: 'ar-001',
  AR_DOC_2: 'ar-002',
  AP_DOC_1: 'ap-001',
  AP_DOC_2: 'ap-002',
  BORROWING_1: 'borrow-001',
  BORROWING_2: 'borrow-002',
  BORROWER_1: 'borrower-001',
  BORROWER_2: 'borrower-002',
}

/**
 * 财务流水数据
 */
export function getCashFlowsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: FINANCE_IDS.CASH_FLOW_INCOME_1,
      voucherNo: 'V2024010001',
      bizDate: lastWeek,
      type: 'income',
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      categoryId: FIXTURE_IDS.CAT_INCOME_SALES,
      method: 'bank_transfer',
      amountCents: 10000000, // 100,000 CNY
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      counterparty: '客户A公司',
      memo: '销售收入-项目A',
      voucherUrl: 'https://example.com/voucher1.jpg',
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 7 * 86400000,
      isReversal: 0,
      reversalOfFlowId: null,
      isReversed: 0,
      reversedByFlowId: null,
    },
    {
      id: FINANCE_IDS.CASH_FLOW_INCOME_2,
      voucherNo: 'V2024010002',
      bizDate: yesterday,
      type: 'income',
      accountId: FIXTURE_IDS.ACCOUNT_BANK_USD,
      categoryId: FIXTURE_IDS.CAT_INCOME_SERVICE,
      method: 'bank_transfer',
      amountCents: 500000, // 5,000 USD
      siteId: null,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      counterparty: 'Client B Inc.',
      memo: '服务收入-技术服务',
      voucherUrl: 'https://example.com/voucher2.jpg',
      createdBy: EMPLOYEE_IDS.ACCOUNTANT_1,
      createdAt: now - 86400000,
      isReversal: 0,
      reversalOfFlowId: null,
      isReversed: 0,
      reversedByFlowId: null,
    },
    {
      id: FINANCE_IDS.CASH_FLOW_EXPENSE_1,
      voucherNo: 'V2024010003',
      bizDate: yesterday,
      type: 'expense',
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      categoryId: FIXTURE_IDS.CAT_EXPENSE_OFFICE,
      method: 'bank_transfer',
      amountCents: 50000, // 500 CNY
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      counterparty: '办公用品商店',
      memo: '办公用品采购',
      voucherUrl: 'https://example.com/voucher3.jpg',
      createdBy: EMPLOYEE_IDS.ACCOUNTANT_2,
      createdAt: now - 86400000,
      isReversal: 0,
      reversalOfFlowId: null,
      isReversed: 0,
      reversedByFlowId: null,
    },
    {
      id: FINANCE_IDS.CASH_FLOW_EXPENSE_2,
      voucherNo: 'V2024010004',
      bizDate: today,
      type: 'expense',
      accountId: FIXTURE_IDS.ACCOUNT_CASH_CNY,
      categoryId: FIXTURE_IDS.CAT_EXPENSE_RENT,
      method: 'cash',
      amountCents: 1000000, // 10,000 CNY
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      counterparty: '房东张三',
      memo: '办公室租金-1月',
      voucherUrl: null,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now,
      isReversal: 0,
      reversalOfFlowId: null,
      isReversed: 0,
      reversedByFlowId: null,
    },
    {
      id: FINANCE_IDS.CASH_FLOW_TRANSFER,
      voucherNo: 'V2024010005',
      bizDate: today,
      type: 'transfer',
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      categoryId: null,
      method: 'bank_transfer',
      amountCents: 500000, // 5,000 CNY
      siteId: null,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      counterparty: null,
      memo: '账户间转账',
      voucherUrl: null,
      createdBy: EMPLOYEE_IDS.CFO,
      createdAt: now,
      isReversal: 0,
      reversalOfFlowId: null,
      isReversed: 0,
      reversedByFlowId: null,
    },
  ]
}

/**
 * 账户交易明细
 */
export function getAccountTransactionsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      flowId: FINANCE_IDS.CASH_FLOW_INCOME_1,
      transactionDate: lastWeek,
      transactionType: 'income',
      amountCents: 10000000,
      balanceBeforeCents: 10000000,
      balanceAfterCents: 20000000,
      createdAt: now - 7 * 86400000,
    },
    {
      id: uuid(),
      accountId: FIXTURE_IDS.ACCOUNT_BANK_USD,
      flowId: FINANCE_IDS.CASH_FLOW_INCOME_2,
      transactionDate: yesterday,
      transactionType: 'income',
      amountCents: 500000,
      balanceBeforeCents: 5000000,
      balanceAfterCents: 5500000,
      createdAt: now - 86400000,
    },
    {
      id: uuid(),
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      flowId: FINANCE_IDS.CASH_FLOW_EXPENSE_1,
      transactionDate: yesterday,
      transactionType: 'expense',
      amountCents: -50000,
      balanceBeforeCents: 20000000,
      balanceAfterCents: 19950000,
      createdAt: now - 86400000,
    },
    {
      id: uuid(),
      accountId: FIXTURE_IDS.ACCOUNT_CASH_CNY,
      flowId: FINANCE_IDS.CASH_FLOW_EXPENSE_2,
      transactionDate: today,
      transactionType: 'expense',
      amountCents: -1000000,
      balanceBeforeCents: 1000000,
      balanceAfterCents: 0,
      createdAt: now,
    },
  ]
}

/**
 * 应收账款单据
 */
export function getArDocsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: FINANCE_IDS.AR_DOC_1,
      kind: 'AR',
      partyId: null, // 可以关联客户表
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      issueDate: today,
      dueDate: futureDate,
      amountCents: 5000000, // 50,000 CNY
      docNo: 'AR202401001',
      memo: '客户A应收款',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FINANCE_IDS.AR_DOC_2,
      kind: 'AR',
      partyId: null,
      siteId: null,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      issueDate: today,
      dueDate: futureDate,
      amountCents: 300000, // 3,000 USD (以分为单位)
      docNo: 'AR202401002',
      memo: 'Client B Receivable',
      status: 'partial',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 应付账款单据
 */
export function getApDocsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const pastDate = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0]
  const futureDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: FINANCE_IDS.AP_DOC_1,
      kind: 'AP',
      partyId: FIXTURE_IDS.VENDOR_A,
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      issueDate: pastDate,
      dueDate: futureDate,
      amountCents: 2000000, // 20,000 CNY
      docNo: 'AP202401001',
      memo: '供应商A应付款',
      status: 'open',
      createdAt: now - 15 * 86400000,
      updatedAt: now - 15 * 86400000,
    },
    {
      id: FINANCE_IDS.AP_DOC_2,
      kind: 'AP',
      partyId: FIXTURE_IDS.VENDOR_B,
      siteId: null,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      issueDate: today,
      dueDate: futureDate,
      amountCents: 1500000, // 15,000 CNY
      docNo: 'AP202401002',
      memo: '供应商B应付款-IT设备',
      status: 'settled',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 借款人数据
 */
export function getBorrowersFixtures() {
  const now = Date.now()
  
  return [
    {
      id: FINANCE_IDS.BORROWER_1,
      name: '张三',
      userId: EMPLOYEE_IDS.ENGINEER_1,
      active: 1,
      createdAt: now,
    },
    {
      id: FINANCE_IDS.BORROWER_2,
      name: '李四',
      userId: EMPLOYEE_IDS.ENGINEER_2,
      active: 1,
      createdAt: now,
    },
  ]
}

/**
 * 借款数据
 */
export function getBorrowingsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: FINANCE_IDS.BORROWING_1,
      userId: EMPLOYEE_IDS.CFO,
      borrowerId: FINANCE_IDS.BORROWER_1,
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      amountCents: 1000000, // 10,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      borrowDate: lastMonth,
      memo: '临时借款',
      status: 'approved',
      approvedBy: EMPLOYEE_IDS.CFO,
      approvedAt: now - 29 * 86400000,
      version: 1,
      createdAt: now - 30 * 86400000,
      updatedAt: now - 29 * 86400000,
    },
    {
      id: FINANCE_IDS.BORROWING_2,
      userId: EMPLOYEE_IDS.FINANCE_MANAGER,
      borrowerId: FINANCE_IDS.BORROWER_2,
      accountId: FIXTURE_IDS.ACCOUNT_BANK_USD,
      amountCents: 200000, // 2,000 USD
      currency: FIXTURE_IDS.CURRENCY_USD,
      borrowDate: today,
      memo: '项目预支',
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 加载所有财务fixtures
 */
export function getAllFinanceFixtures() {
  return {
    cashFlows: getCashFlowsFixtures(),
    accountTransactions: getAccountTransactionsFixtures(),
    arDocs: getArDocsFixtures(),
    apDocs: getApDocsFixtures(),
    borrowers: getBorrowersFixtures(),
    borrowings: getBorrowingsFixtures(),
  }
}
