/**
 * 测试数据工厂 - 用于生成测试数据
 */

export interface TestEmployee {
  id: string
  name: string
  email: string
  phone?: string
  positionId?: string
  departmentId?: string
  status?: string
}

export interface TestAccount {
  id: string
  name: string
  type: string
  currency: string
  openingCents?: number
}

export interface TestFlow {
  id: string
  type: 'income' | 'expense'
  accountId: string
  categoryId: string
  amountCents: number
  departmentId?: string
  memo?: string
}

export interface TestLeave {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  reason?: string
  status?: string
}

export interface TestReimbursement {
  id: string
  employeeId: string
  expenseType: string
  amountCents: number
  expenseDate: string
  description?: string
  status?: string
}

/**
 * 测试数据工厂类
 */
export class TestDataFactory {
  private static counter = 1

  /**
   * 生成唯一ID
   */
  static generateId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${this.counter++}`
  }

  /**
   * 生成测试员工数据
   */
  static createEmployee(overrides?: Partial<TestEmployee>): TestEmployee {
    const id = this.generateId('emp')
    return {
      id,
      name: `Test Employee ${this.counter}`,
      email: `test.employee${this.counter}@example.com`,
      phone: `1380000${String(this.counter).padStart(4, '0')}`,
      positionId: 'pos1',
      departmentId: 'dept1',
      status: 'active',
      ...overrides,
    }
  }

  /**
   * 生成测试账户数据
   */
  static createAccount(overrides?: Partial<TestAccount>): TestAccount {
    const id = this.generateId('acc')
    return {
      id,
      name: `Test Account ${this.counter}`,
      type: 'bank',
      currency: 'CNY',
      openingCents: 0,
      ...overrides,
    }
  }

  /**
   * 生成测试流水数据
   */
  static createFlow(overrides?: Partial<TestFlow>): TestFlow {
    const id = this.generateId('flow')
    return {
      id,
      type: 'income',
      accountId: 'acc1',
      categoryId: 'cat1',
      amountCents: 100000, // 1000.00
      departmentId: 'dept1',
      memo: `Test flow ${this.counter}`,
      ...overrides,
    }
  }

  /**
   * 生成测试请假数据
   */
  static createLeave(overrides?: Partial<TestLeave>): TestLeave {
    const id = this.generateId('leave')
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return {
      id,
      employeeId: 'emp1',
      leaveType: 'annual',
      startDate: today.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0],
      reason: `Test leave ${this.counter}`,
      status: 'pending',
      ...overrides,
    }
  }

  /**
   * 生成测试报销数据
   */
  static createReimbursement(overrides?: Partial<TestReimbursement>): TestReimbursement {
    const id = this.generateId('reimb')
    const today = new Date()

    return {
      id,
      employeeId: 'emp1',
      expenseType: 'travel',
      amountCents: 20000, // 200.00
      expenseDate: today.toISOString().split('T')[0],
      description: `Test reimbursement ${this.counter}`,
      status: 'pending',
      ...overrides,
    }
  }

  /**
   * 生成测试薪资数据
   */
  static createSalaryPayment(overrides?: any): any {
    const id = this.generateId('salary')
    const today = new Date()

    return {
      id,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      status: 'draft',
      ...overrides,
    }
  }

  /**
   * 生成测试补贴数据
   */
  static createAllowancePayment(overrides?: any): any {
    const id = this.generateId('allow')
    const today = new Date()

    return {
      id,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      paymentDate: today.toISOString().split('T')[0],
      ...overrides,
    }
  }

  /**
   * 生成测试转账数据
   */
  static createAccountTransfer(overrides?: any): any {
    const id = this.generateId('transfer')
    return {
      id,
      fromAccountId: 'acc1',
      toAccountId: 'acc2',
      amountCents: 100000, // 1000.00
      exchangeRate: 1,
      ...overrides,
    }
  }

  /**
   * 生成测试固定资产数据
   */
  static createFixedAsset(overrides?: any): any {
    const id = this.generateId('asset')
    return {
      id,
      assetCode: `FA-${Date.now()}`,
      name: `Test Asset ${this.counter}`,
      purchasePriceCents: 1500000, // 15000.00
      currency: 'CNY',
      status: 'in_use',
      ...overrides,
    }
  }

  /**
   * 生成测试租赁数据
   */
  static createRentalProperty(overrides?: any): any {
    const id = this.generateId('rental')
    return {
      id,
      propertyType: 'office',
      monthlyRentCents: 500000, // 5000.00
      currency: 'CNY',
      ...overrides,
    }
  }

  /**
   * 生成测试部门数据
   */
  static createDepartment(overrides?: any): any {
    const id = this.generateId('dept')
    return {
      id,
      name: `Test Department ${this.counter}`,
      hqId: 'hq1',
      active: 1,
      ...overrides,
    }
  }

  /**
   * 生成测试分类数据
   */
  static createCategory(overrides?: any): any {
    const id = this.generateId('cat')
    return {
      id,
      name: `Test Category ${this.counter}`,
      kind: 'income',
      active: 1,
      ...overrides,
    }
  }

  /**
   * 生成测试供应商数据
   */
  static createVendor(overrides?: any): any {
    const id = this.generateId('vendor')
    return {
      id,
      name: `Test Vendor ${this.counter}`,
      contact: `contact${this.counter}@example.com`,
      active: 1,
      ...overrides,
    }
  }

  /**
   * 生成测试站点数据
   */
  static createSite(overrides?: any): any {
    const id = this.generateId('site')
    return {
      id,
      name: `Test Site ${this.counter}`,
      departmentId: 'dept1',
      active: 1,
      ...overrides,
    }
  }

  /**
   * 生成测试站点账单数据
   */
  static createSiteBill(overrides?: any): any {
    const id = this.generateId('bill')
    const today = new Date()
    return {
      id,
      siteId: 'site1',
      accountId: 'acc1',
      categoryId: 'cat1',
      amountCents: 100000, // 1000.00
      billDate: today.toISOString().split('T')[0],
      ...overrides,
    }
  }

  /**
   * 重置计数器（用于测试清理）
   */
  static resetCounter(): void {
    this.counter = 1
  }
}

