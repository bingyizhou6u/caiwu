/**
 * 数据库测试辅助函数
 * 提供便捷的数据库操作方法用于测试
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { v4 as uuid } from 'uuid'

type DbType = DrizzleD1Database<typeof schema>

/**
 * 批量插入数据
 */
export async function bulkInsert<T extends keyof typeof schema>(
  db: DbType,
  tableName: T,
  records: any[]
): Promise<void> {
  if (records.length === 0) return

  const table = schema[tableName]
  await db.insert(table as any).values(records).execute()
}

/**
 * 清空指定表
 */
export async function truncateTable<T extends keyof typeof schema>(
  db: DbType,
  tableName: T
): Promise<void> {
  const table = schema[tableName]
  await db.delete(table as any).execute()
}

/**
 * 清空所有业务表（按依赖顺序）
 */
export async function truncateAllTables(db: DbType): Promise<void> {
  // 按照外键依赖顺序清理表
  const tablesToClean = [
    // 审计和历史记录
    'auditLogs',
    'businessOperationHistory',

    // 资产相关
    'fixedAssetAllocations',
    'fixedAssetDepreciations',
    'fixedAssetChanges',
    'fixedAssets',

    // 租赁相关
    'dormitoryAllocations',
    'rentalPayableBills',
    'rentalPayments',
    'rentalChanges',
    'rentalProperties',

    // 人事相关
    'salaryPaymentAllocations',
    'salaryPayments',
    'allowancePayments',
    'employeeLeaves',
    'expenseReimbursements',
    'employeeAllowances',
    'employeeSalaries',

    // 财务相关
    'accountTransactions',
    'cashFlows',
    'borrowings',
    'borrowers',
    'arApDocs',

    // 会话相关
    'trustedDevices',
    'sessions',

    // 员工
    'employees',

    // 主数据
    'sites',
    'accounts',
    'categories',
    'vendors',
    'orgDepartments',
    'positions',
    'projects',
    'headquarters',
    'currencies',
    'openingBalances',
  ] as const

  for (const tableName of tablesToClean) {
    try {
      await truncateTable(db, tableName as any)
    } catch (error) {
      // 忽略表不存在的错误
      console.warn(`Failed to truncate ${tableName}:`, error)
    }
  }
}

/**
 * 创建测试实体的辅助函数
 */
export const createTestEntity = {
  /**
   * 创建测试员工
   */
  async employee(
    db: DbType,
    overrides: Partial<typeof schema.employees.$inferInsert> = {}
  ) {
    const now = Date.now()
    const employeeData = {
      id: uuid(),
      email: `test-${uuid()}@example.com`,
      name: 'Test Employee',
      positionId: null,
      orgDepartmentId: null,
      departmentId: null,
      active: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }

    await db.insert(schema.employees).values(employeeData).execute()
    return employeeData
  },

  /**
   * 创建测试账户
   */
  async account(
    db: DbType,
    overrides: Partial<typeof schema.accounts.$inferInsert> = {}
  ) {
    const accountData = {
      id: uuid(),
      name: 'Test Account',
      type: 'bank',
      currency: 'CNY',
      openingCents: 0,
      active: 1,
      version: 1,
      ...overrides,
    }

    await db.insert(schema.accounts).values(accountData).execute()
    return accountData
  },

  /**
   * 创建测试部门
   */
  async department(
    db: DbType,
    overrides: Partial<typeof schema.projects.$inferInsert> = {}
  ) {
    const now = Date.now()
    const deptData = {
      id: uuid(),
      code: 'TEST-HELPER-' + uuid().substring(0, 8),
      name: 'Test Department',
      active: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }

    await db.insert(schema.projects).values(deptData).execute()
    return deptData
  },

  /**
   * 创建测试职位
   */
  async position(
    db: DbType,
    overrides: Partial<typeof schema.positions.$inferInsert> = {}
  ) {
    const now = Date.now()
    const posData = {
      id: uuid(),
      code: `test_pos_${Date.now()}`,
      name: 'Test Position',
      active: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }

    await db.insert(schema.positions).values(posData).execute()
    return posData
  },

  /**
   * 创建测试现金流水
   */
  async cashFlow(
    db: DbType,
    overrides: Partial<typeof schema.cashFlows.$inferInsert> = {}
  ) {
    const now = Date.now()
    const today = new Date().toISOString().split('T')[0]
    const flowData = {
      id: uuid(),
      bizDate: today,
      type: 'income',
      accountId: uuid(), // 需要提供有效的accountId
      amountCents: 100000,
      createdAt: now,
      ...overrides,
    }

    await db.insert(schema.cashFlows).values(flowData).execute()
    return flowData
  },

  /**
   * 创建测试固定资产
   */
  async fixedAsset(
    db: DbType,
    overrides: Partial<typeof schema.fixedAssets.$inferInsert> = {}
  ) {
    const now = Date.now()
    const today = new Date().toISOString().split('T')[0]
    const assetData = {
      id: uuid(),
      assetCode: `ASSET-${Date.now()}`,
      name: 'Test Asset',
      purchasePriceCents: 100000,
      currency: 'CNY',
      purchaseDate: today,
      status: 'in_use',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }

    await db.insert(schema.fixedAssets).values(assetData).execute()
    return assetData
  },
}

/**
 * 从数据库获取实体
 */
export const findEntity = {
  /**
   * 根据ID查找员工
   */
  async employeeById(db: DbType, id: string) {
    const results = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, id))
      .execute()
    return results[0] || null
  },

  /**
   * 根据email查找员工
   */
  async employeeByEmail(db: DbType, email: string) {
    const results = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.email, email))
      .execute()
    return results[0] || null
  },

  /**
   * 根据ID查找账户
   */
  async accountById(db: DbType, id: string) {
    const results = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, id))
      .execute()
    return results[0] || null
  },

  /**
   * 查找账户的最新余额
   */
  async accountBalance(db: DbType, accountId: string): Promise<number> {
    const account = await findEntity.accountById(db, accountId)
    if (!account) return 0

    // 查询最后一条交易记录
    const transactions = await db
      .select()
      .from(schema.accountTransactions)
      .where(eq(schema.accountTransactions.accountId, accountId))
      .orderBy(desc(schema.accountTransactions.createdAt))
      .limit(1)
      .execute()

    if (transactions.length > 0) {
      return transactions[0].balanceAfterCents
    }

    return account.openingCents || 0
  },
}

/**
 * 计数辅助函数
 */
export const countRecords = {
  /**
   * 计数表中的记录数
   */
  async inTable<T extends keyof typeof schema>(
    db: DbType,
    tableName: T
  ): Promise<number> {
    const table = schema[tableName]
    const results = await db.select().from(table as any).execute()
    return results.length
  },

  /**
   * 计数员工数
   */
  async employees(db: DbType, filters?: { active?: number }): Promise<number> {
    let query: any = db.select().from(schema.employees)

    if (filters?.active !== undefined) {
      query = query.where(eq(schema.employees.active, filters.active))
    }

    const results = await query.execute()
    return results.length
  },

  /**
   * 计数账户的流水记录数
   */
  async cashFlowsForAccount(db: DbType, accountId: string): Promise<number> {
    const results = await db
      .select()
      .from(schema.cashFlows)
      .where(eq(schema.cashFlows.accountId, accountId))
      .execute()
    return results.length
  },
}

/**
 * 等待辅助函数（用于异步操作）
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return uuid()
}

/**
 * 生成测试email
 */
export function generateTestEmail(): string {
  return `test-${uuid()}@example.com`
}

/**
 * 获取当前日期字符串（YYYY-MM-DD）
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * 获取指定天数前的日期字符串
 */
export function getDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
