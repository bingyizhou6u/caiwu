/**
 * 断言测试辅助函数
 * 提供业务特定的断言方法
 */

import { expect } from 'vitest'

/**
 * 断言员工对象
 */
export const assertEmployee = {
  /**
   * 断言员工基本字段存在
   */
  hasRequiredFields(employee: any): void {
    expect(employee).toBeDefined()
    expect(employee.id).toBeDefined()
    expect(employee.email).toBeDefined()
    expect(employee.name).toBeDefined()
  },

  /**
   * 断言员工是激活状态
   */
  isActive(employee: any): void {
    expect(employee.active).toBe(1)
  },

  /**
   * 断言员工是停用状态
   */
  isInactive(employee: any): void {
    expect(employee.active).toBe(0)
  },

  /**
   * 断言员工有职位
   */
  hasPosition(employee: any): void {
    expect(employee.positionId).toBeDefined()
    expect(employee.positionId).not.toBeNull()
  },

  /**
   * 断言员工属于指定部门
   */
  belongsToDepartment(employee: any, departmentId: string): void {
    expect(employee.departmentId).toBe(departmentId)
  },
}

/**
 * 断言账户对象
 */
export const assertAccount = {
  /**
   * 断言账户基本字段存在
   */
  hasRequiredFields(account: any): void {
    expect(account).toBeDefined()
    expect(account.id).toBeDefined()
    expect(account.name).toBeDefined()
    expect(account.type).toBeDefined()
    expect(account.currency).toBeDefined()
  },

  /**
   * 断言账户余额
   */
  hasBalance(account: any, expectedCents: number): void {
    expect(account.openingCents).toBe(expectedCents)
  },

  /**
   * 断言账户余额大于
   */
  balanceGreaterThan(balance: number, expectedCents: number): void {
    expect(balance).toBeGreaterThan(expectedCents)
  },

  /**
   * 断言账户余额小于
   */
  balanceLessThan(balance: number, expectedCents: number): void {
    expect(balance).toBeLessThan(expectedCents)
  },

  /**
   * 断言账户是激活状态
   */
  isActive(account: any): void {
    expect(account.active).toBe(1)
  },
}

/**
 * 断言财务流水
 */
export const assertCashFlow = {
  /**
   * 断言流水基本字段存在
   */
  hasRequiredFields(flow: any): void {
    expect(flow).toBeDefined()
    expect(flow.id).toBeDefined()
    expect(flow.bizDate).toBeDefined()
    expect(flow.type).toBeDefined()
    expect(flow.accountId).toBeDefined()
    expect(flow.amountCents).toBeDefined()
  },

  /**
   * 断言流水类型
   */
  isType(flow: any, type: string): void {
    expect(flow.type).toBe(type)
  },

  /**
   * 断言流水是收入
   */
  isIncome(flow: any): void {
    assertCashFlow.isType(flow, 'income')
  },

  /**
   * 断言流水是支出
   */
  isExpense(flow: any): void {
    assertCashFlow.isType(flow, 'expense')
  },

  /**
   * 断言流水金额
   */
  hasAmount(flow: any, expectedCents: number): void {
    expect(flow.amountCents).toBe(expectedCents)
  },

  /**
   * 断言流水未被红冲
   */
  isNotReversed(flow: any): void {
    expect(flow.isReversed).toBe(0)
    expect(flow.reversedByFlowId).toBeNull()
  },

  /**
   * 断言流水已被红冲
   */
  isReversed(flow: any): void {
    expect(flow.isReversed).toBe(1)
    expect(flow.reversedByFlowId).toBeDefined()
    expect(flow.reversedByFlowId).not.toBeNull()
  },

  /**
   * 断言是红冲记录
   */
  isReversalRecord(flow: any): void {
    expect(flow.isReversal).toBe(1)
    expect(flow.reversalOfFlowId).toBeDefined()
    expect(flow.reversalOfFlowId).not.toBeNull()
  },
}

/**
 * 断言API响应
 */
export const assertResponse = {
  /**
   * 断言响应成功
   */
  async isSuccess(response: Response, expectedStatus: number = 200): Promise<any> {
    expect(response.status).toBe(expectedStatus)
    const data = await response.json()
    return data
  },

  /**
   * 断言响应失败
   */
  async isError(response: Response, expectedStatus: number = 400): Promise<any> {
    expect(response.status).toBe(expectedStatus)
    const data = (await response.json()) as any
    expect(data.error).toBeDefined()
    return data
  },

  /**
   * 断言响应包含分页信息
   */
  async hasPagination(response: Response): Promise<any> {
    const data = await assertResponse.isSuccess(response)
    expect(data.results).toBeDefined()
    expect(Array.isArray(data.results)).toBe(true)
    expect(data.total).toBeDefined()
    expect(typeof data.total).toBe('number')
    return data
  },

  /**
   * 断言响应包含数据
   */
  async hasData(response: Response, dataKey: string = 'data'): Promise<any> {
    const data = await assertResponse.isSuccess(response)
    expect(data[dataKey]).toBeDefined()
    return data
  },

  /**
   * 断言响应是401未授权
   */
  async isUnauthorized(response: Response): Promise<any> {
    return assertResponse.isError(response, 401)
  },

  /**
   * 断言响应是403禁止访问
   */
  async isForbidden(response: Response): Promise<any> {
    return assertResponse.isError(response, 403)
  },

  /**
   * 断言响应是404未找到
   */
  async isNotFound(response: Response): Promise<any> {
    return assertResponse.isError(response, 404)
  },
}

/**
 * 断言数据库状态
 */
export const assertDatabase = {
  /**
   * 断言表中记录数量
   */
  async recordCount(
    actualCount: number,
    expectedCount: number,
    message?: string
  ): Promise<void> {
    expect(actualCount, message).toBe(expectedCount)
  },

  /**
   * 断言表中至少有N条记录
   */
  async hasAtLeast(
    actualCount: number,
    minCount: number,
    message?: string
  ): Promise<void> {
    expect(actualCount, message).toBeGreaterThanOrEqual(minCount)
  },

  /**
   * 断言表为空
   */
  async isEmpty(actualCount: number, message?: string): Promise<void> {
    expect(actualCount, message).toBe(0)
  },

  /**
   * 断言表不为空
   */
  async isNotEmpty(actualCount: number, message?: string): Promise<void> {
    expect(actualCount, message).toBeGreaterThan(0)
  },
}

/**
 * 断言错误对象
 */
export const assertError = {
  /**
   * 断言抛出错误
   */
  async throws(fn: () => Promise<any>, expectedMessage?: string): Promise<void> {
    await expect(fn()).rejects.toThrow(expectedMessage)
  },

  /**
   * 断言抛出特定类型的错误
   */
  async throwsError(
    fn: () => Promise<any>,
    ErrorClass: any,
    expectedMessage?: string
  ): Promise<void> {
    await expect(fn()).rejects.toThrow(ErrorClass)
    if (expectedMessage) {
      await expect(fn()).rejects.toThrow(expectedMessage)
    }
  },

  /**
   * 断言不抛出错误
   */
  async doesNotThrow(fn: () => Promise<any>): Promise<void> {
    await expect(fn()).resolves.not.toThrow()
  },

  /**
   * 断言错误包含特定字段
   */
  hasField(error: any, field: string): void {
    expect(error).toBeDefined()
    expect(error[field]).toBeDefined()
  },

  /**
   * 断言错误消息包含文本
   */
  messageContains(error: Error, text: string): void {
    expect(error.message).toContain(text)
  },
}

/**
 * 断言日期和时间
 */
export const assertDateTime = {
  /**
   * 断言日期字符串格式正确 (YYYY-MM-DD)
   */
  isValidDateString(dateStr: string): void {
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  },

  /**
   * 断言时间戳在合理范围内
   */
  isValidTimestamp(timestamp: number): void {
    expect(timestamp).toBeGreaterThan(0)
    expect(timestamp).toBeLessThan(Date.now() + 86400000) // 不超过明天
  },

  /**
   * 断言日期在指定范围内
   */
  isBetween(dateStr: string, startDate: string, endDate: string): void {
    expect(dateStr >= startDate).toBe(true)
    expect(dateStr <= endDate).toBe(true)
  },

  /**
   * 断言是今天
   */
  isToday(dateStr: string): void {
    const today = new Date().toISOString().split('T')[0]
    expect(dateStr).toBe(today)
  },
}

/**
 * 断言金额（以分为单位）
 */
export const assertAmount = {
  /**
   * 断言金额相等
   */
  equals(actualCents: number, expectedCents: number): void {
    expect(actualCents).toBe(expectedCents)
  },

  /**
   * 断言金额大于
   */
  greaterThan(actualCents: number, expectedCents: number): void {
    expect(actualCents).toBeGreaterThan(expectedCents)
  },

  /**
   * 断言金额大于等于
   */
  greaterThanOrEqual(actualCents: number, expectedCents: number): void {
    expect(actualCents).toBeGreaterThanOrEqual(expectedCents)
  },

  /**
   * 断言金额小于
   */
  lessThan(actualCents: number, expectedCents: number): void {
    expect(actualCents).toBeLessThan(expectedCents)
  },

  /**
   * 断言金额为正
   */
  isPositive(amountCents: number): void {
    expect(amountCents).toBeGreaterThan(0)
  },

  /**
   * 断言金额为负
   */
  isNegative(amountCents: number): void {
    expect(amountCents).toBeLessThan(0)
  },

  /**
   * 断言金额为零
   */
  isZero(amountCents: number): void {
    expect(amountCents).toBe(0)
  },
}

/**
 * 断言数组
 */
export const assertArray = {
  /**
   * 断言数组长度
   */
  hasLength(array: any[], expectedLength: number): void {
    expect(array).toHaveLength(expectedLength)
  },

  /**
   * 断言数组不为空
   */
  isNotEmpty(array: any[]): void {
    expect(array.length).toBeGreaterThan(0)
  },

  /**
   * 断言数组为空
   */
  isEmpty(array: any[]): void {
    expect(array).toHaveLength(0)
  },

  /**
   * 断言数组包含元素
   */
  contains(array: any[], element: any): void {
    expect(array).toContain(element)
  },

  /**
   * 断言数组所有元素满足条件
   */
  allMatch(array: any[], predicate: (item: any) => boolean): void {
    expect(array.every(predicate)).toBe(true)
  },

  /**
   * 断言数组至少有一个元素满足条件
   */
  someMatch(array: any[], predicate: (item: any) => boolean): void {
    expect(array.some(predicate)).toBe(true)
  },
}
