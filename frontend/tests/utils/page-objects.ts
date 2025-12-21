/**
 * Page Object 模式 - 封装页面操作
 */

import { Page, Locator, expect } from '@playwright/test'

/**
 * 基础页面对象类
 */
export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string) {
    await this.page.goto(`http://localhost:5173${path}`)
  }

  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle')
  }

  async clickButton(text: string) {
    await this.page.click(`button:has-text("${text}")`)
  }

  async fillInput(label: string, value: string) {
    await this.page.fill(`input[id="${label}"]`, value)
  }

  async selectOption(label: string, value: string) {
    await this.page.selectOption(`select[id="${label}"]`, value)
  }

  async waitForMessage(type: 'success' | 'error', text?: string) {
    const selector = `.ant-message-${type}`
    if (text) {
      await this.page.waitForSelector(`${selector}:has-text("${text}")`)
    } else {
      await this.page.waitForSelector(selector)
    }
  }
}

/**
 * 登录页面
 */
export class LoginPage extends BasePage {
  async login(email: string, password: string) {
    await this.page.goto('http://localhost:5173/login')
    await this.page.fill('input[id="email"]', email)
    await this.page.fill('input[id="password"]', password)
    const submitButton = this.page.locator('button[type="submit"]')
    await expect(submitButton).toBeEnabled({ timeout: 10000 })
    await submitButton.click()
  }

  async loginWithTotp(email: string, password: string, totp: string) {
    await this.login(email, password)
    await this.page.fill('input[id="totp"]', totp)
    await this.page.click('button[type="submit"]')
  }

  async expectLoginSuccess() {
    await this.page.waitForURL(/.*(\/dashboard|\/my\/center)/)
    await expect(this.page.getByText('工作台')).toBeVisible({ timeout: 10000 })
  }

  async expectLoginError(message?: string) {
    await this.waitForMessage('error', message)
  }
}

/**
 * 财务流水页面
 */
export class FinanceFlowPage extends BasePage {
  async gotoList() {
    await this.goto('/finance/flows')
  }

  async createFlow(data: {
    type: string
    account: string
    amount: string
    date?: string
  }) {
    await this.clickButton('新增')
    await this.selectOption('type', data.type)
    await this.fillInput('accountId', data.account)
    await this.fillInput('amountCents', data.amount)
    if (data.date) {
      await this.fillInput('bizDate', data.date)
    }
    await this.clickButton('确定')
  }

  async expectFlowInList(flowId: string) {
    await this.page.waitForSelector(`tr[data-row-key="${flowId}"]`)
  }
}

/**
 * 员工管理页面
 */
export class EmployeePage extends BasePage {
  async gotoList() {
    await this.goto('/hr/employees')
  }

  async createEmployee(data: {
    name: string
    email: string
    position?: string
    department?: string
  }) {
    await this.clickButton('新增员工')
    await this.fillInput('name', data.name)
    await this.fillInput('email', data.email)
    if (data.position) {
      await this.selectOption('positionId', data.position)
    }
    if (data.department) {
      await this.selectOption('departmentId', data.department)
    }
    await this.clickButton('提交')
  }

  async searchEmployee(keyword: string) {
    await this.fillInput('search', keyword)
    await this.page.keyboard.press('Enter')
  }

  async expectEmployeeInList(email: string) {
    await this.page.waitForSelector(`text=${email}`)
  }
}

/**
 * 认证相关页面
 */
export class ActivateAccountPage extends BasePage {
  async gotoActivate(token: string) {
    await super.goto(`/auth/activate?token=${token}`)
    // 等待页面加载完成
    await this.page.waitForLoadState('networkidle')
  }

  async fillPassword(password: string) {
    await this.page.fill('input[id="newPassword"]', password)
  }

  async fillConfirmPassword(password: string) {
    await this.page.fill('input[id="confirmPassword"]', password)
  }

  async fillTotpCode(totpCode: string) {
    await this.page.fill('input[id="totpCode"]', totpCode)
  }

  async submit() {
    await this.page.click('button[type="submit"]')
  }

  async waitForMessage(type: 'success' | 'error', text?: string) {
    const selector = `.ant-message-${type}`
    if (text) {
      await this.page.waitForSelector(`${selector}:has-text("${text}")`, { timeout: 10000 })
    } else {
      await this.page.waitForSelector(selector, { timeout: 10000 })
    }
  }
}

export class ResetPasswordPage extends BasePage {
  async gotoReset(token: string) {
    await this.goto(`/auth/reset-password?token=${token}`)
  }

  async fillNewPassword(password: string) {
    await this.fillInput('password', password)
  }

  async fillConfirmPassword(password: string) {
    await this.fillInput('confirmPassword', password)
  }

  async submit() {
    await this.clickButton('重置密码')
  }
}

export class ChangePasswordPage extends BasePage {
  async goto() {
    await super.goto('/change-password')
  }

  async fillOldPassword(password: string) {
    await this.fillInput('oldPassword', password)
  }

  async fillNewPassword(password: string) {
    await this.fillInput('newPassword', password)
  }

  async fillConfirmPassword(password: string) {
    await this.fillInput('confirmPassword', password)
  }

  async submit() {
    await this.clickButton('修改密码')
  }
}

/**
 * 财务相关页面
 */
export class AccountTransferPage extends BasePage {
  async goto() {
    await super.goto('/finance/transfer')
  }

  async createTransfer(data: {
    fromAccount: string
    toAccount: string
    amount: string
    exchangeRate?: string
  }) {
    await this.clickButton('新建转账')
    await this.selectAccount('fromAccountId', data.fromAccount)
    await this.selectAccount('toAccountId', data.toAccount)
    await this.fillInput('amountCents', data.amount)
    if (data.exchangeRate) {
      await this.fillInput('exchangeRate', data.exchangeRate)
    }
    await this.clickButton('保存')
  }

  private async selectAccount(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

export class ARPage extends BasePage {
  async goto() {
    await super.goto('/finance/ar')
  }

  async filterByDepartment(department: string) {
    await this.page.locator('#departmentId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: department }).click()
  }

  async filterByStatus(status: string) {
    await this.page.locator('#status').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: status }).click()
  }
}

export class APPage extends BasePage {
  async goto() {
    await super.goto('/finance/ap')
  }

  async filterByDepartment(department: string) {
    await this.page.locator('#departmentId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: department }).click()
  }

  async filterByStatus(status: string) {
    await this.page.locator('#status').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: status }).click()
  }
}

/**
 * HR相关页面
 */
export class AllowancePaymentPage extends BasePage {
  async goto() {
    await super.goto('/hr/allowance-payments')
  }

  async createPayment(data: {
    year: string
    month: string
    employees: string[]
  }) {
    await this.clickButton('新建补贴发放')
    await this.selectYear(data.year)
    await this.selectMonth(data.month)
    // 选择员工逻辑
    await this.clickButton('保存')
  }

  private async selectYear(year: string) {
    await this.page.locator('#year').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: year }).click()
  }

  private async selectMonth(month: string) {
    await this.page.locator('#month').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: month }).click()
  }
}

export class LeaveManagementPage extends BasePage {
  async goto() {
    await super.goto('/hr/leaves')
  }

  async createLeave(data: {
    employee: string
    leaveType: string
    startDate: string
    endDate: string
    reason?: string
  }) {
    await this.clickButton('新建请假')
    await this.selectEmployee('employeeId', data.employee)
    await this.selectLeaveType('leaveType', data.leaveType)
    await this.fillInput('startDate', data.startDate)
    await this.fillInput('endDate', data.endDate)
    if (data.reason) {
      await this.fillInput('reason', data.reason)
    }
    await this.clickButton('保存')
  }

  private async selectEmployee(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }

  private async selectLeaveType(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

export class ExpenseReimbursementPage extends BasePage {
  async goto() {
    await super.goto('/hr/reimbursements')
  }

  async createReimbursement(data: {
    employee: string
    expenseType: string
    amount: string
    expenseDate: string
    description?: string
  }) {
    await this.clickButton('新建报销')
    await this.selectEmployee('employeeId', data.employee)
    await this.selectExpenseType('expenseType', data.expenseType)
    await this.fillInput('amountCents', data.amount)
    await this.fillInput('expenseDate', data.expenseDate)
    if (data.description) {
      await this.fillInput('description', data.description)
    }
    await this.clickButton('保存')
  }

  private async selectEmployee(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }

  private async selectExpenseType(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

/**
 * 个人中心页面
 */
export class MyCenterPage extends BasePage {
  async goto() {
    await super.goto('/my/center')
  }

  async expectPersonalInfo() {
    await this.page.waitForSelector('.personal-info')
  }

  async expectTimeline() {
    await this.page.waitForSelector('.timeline')
  }
}

export class MyLeavesPage extends BasePage {
  async goto() {
    await super.goto('/my/leaves')
  }

  async createLeave(data: {
    leaveType: string
    startDate: string
    endDate: string
    reason?: string
  }) {
    await this.clickButton('申请请假')
    await this.selectLeaveType('leaveType', data.leaveType)
    await this.fillInput('startDate', data.startDate)
    await this.fillInput('endDate', data.endDate)
    if (data.reason) {
      await this.fillInput('reason', data.reason)
    }
    await this.clickButton('提交')
  }

  private async selectLeaveType(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

export class MyReimbursementsPage extends BasePage {
  async goto() {
    await super.goto('/my/reimbursements')
  }

  async createReimbursement(data: {
    expenseType: string
    amount: string
    expenseDate: string
    description?: string
  }) {
    await this.clickButton('申请报销')
    await this.selectExpenseType('expenseType', data.expenseType)
    await this.fillInput('amountCents', data.amount)
    await this.fillInput('expenseDate', data.expenseDate)
    if (data.description) {
      await this.fillInput('description', data.description)
    }
    await this.clickButton('提交')
  }

  private async selectExpenseType(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

export class MyAssetsPage extends BasePage {
  async goto() {
    await super.goto('/my/assets')
  }

  async expectAssetList() {
    await this.page.waitForSelector('.asset-list')
  }
}

/**
 * 系统管理页面
 */
export class DepartmentManagementPage extends BasePage {
  async goto() {
    await super.goto('/system/departments')
  }

  async createDepartment(data: {
    name: string
    hqId?: string
  }) {
    await this.clickButton('新建部门')
    await this.fillInput('name', data.name)
    if (data.hqId) {
      await this.selectOption('hqId', data.hqId)
    }
    await this.clickButton('保存')
  }
}

export class CategoryManagementPage extends BasePage {
  async goto() {
    await super.goto('/system/categories')
  }

  async createCategory(data: {
    name: string
    kind: string
  }) {
    await this.clickButton('新建分类')
    await this.fillInput('name', data.name)
    await this.selectOption('kind', data.kind)
    await this.clickButton('保存')
  }
}

export class AccountManagementPage extends BasePage {
  async goto() {
    await super.goto('/system/accounts')
  }

  async createAccount(data: {
    name: string
    type: string
    currency: string
  }) {
    await this.clickButton('新建账户')
    await this.fillInput('name', data.name)
    await this.selectOption('type', data.type)
    await this.selectOption('currency', data.currency)
    await this.clickButton('保存')
  }
}

export class CurrencyManagementPage extends BasePage {
  async goto() {
    await super.goto('/system/currencies')
  }

  async editRate(currencyCode: string, rate: string) {
    const row = this.page.locator(`tr:has-text("${currencyCode}")`)
    await row.locator('button').filter({ hasText: '编辑' }).click()
    await this.fillInput('rate', rate)
    await this.clickButton('保存')
  }
}

export class VendorManagementPage extends BasePage {
  async goto() {
    await super.goto('/system/vendors')
  }

  async createVendor(data: {
    name: string
    contact?: string
  }) {
    await this.clickButton('新建供应商')
    await this.fillInput('name', data.name)
    if (data.contact) {
      await this.fillInput('contact', data.contact)
    }
    await this.clickButton('保存')
  }
}

export class AuditLogsPage extends BasePage {
  async goto() {
    await super.goto('/system/audit')
  }

  async filterByAction(action: string) {
    await this.page.locator('#action').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: action }).click()
  }

  async filterByDateRange(startDate: string, endDate: string) {
    await this.fillInput('startDate', startDate)
    await this.fillInput('endDate', endDate)
    await this.clickButton('查询')
  }
}

/**
 * 报表页面
 */
export class ReportARSummaryPage extends BasePage {
  async goto() {
    await super.goto('/reports/ar-summary')
  }

  async filterByDateRange(startDate: string, endDate: string) {
    await this.fillInput('startDate', startDate)
    await this.fillInput('endDate', endDate)
    await this.clickButton('查询')
  }

  async export() {
    await this.clickButton('导出')
  }
}

export class ReportAPSummaryPage extends BasePage {
  async goto() {
    await super.goto('/reports/ap-summary')
  }

  async filterByDateRange(startDate: string, endDate: string) {
    await this.fillInput('startDate', startDate)
    await this.fillInput('endDate', endDate)
    await this.clickButton('查询')
  }

  async export() {
    await this.clickButton('导出')
  }
}

export class ReportDepartmentCashPage extends BasePage {
  async goto() {
    await super.goto('/reports/dept-cash')
  }

  async filterByDepartment(department: string) {
    await this.page.locator('#departmentId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: department }).click()
  }
}

export class ReportAccountBalancePage extends BasePage {
  async goto() {
    await super.goto('/reports/account-balance')
  }

  async filterByAccount(account: string) {
    await this.page.locator('#accountId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: account }).click()
  }
}

/**
 * 资产管理页面
 */
export class FixedAssetsManagementPage extends BasePage {
  async goto() {
    await super.goto('/assets/list')
  }

  async allocateAsset(assetId: string, employeeId: string) {
    const row = this.page.locator(`tr[data-row-key="${assetId}"]`)
    await row.locator('button').filter({ hasText: '分配' }).click()
    await this.selectEmployee('employeeId', employeeId)
    await this.clickButton('保存')
  }

  private async selectEmployee(selector: string, value: string) {
    await this.page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click()
    await this.page.locator('.ant-select-item-option').filter({ hasText: value }).click()
  }
}

export class RentalManagementPage extends BasePage {
  async goto() {
    await super.goto('/assets/rental')
  }

  async createRental(data: {
    propertyType: string
    monthlyRent: string
  }) {
    await this.clickButton('新建租赁')
    await this.selectOption('propertyType', data.propertyType)
    await this.fillInput('monthlyRentCents', data.monthlyRent)
    await this.clickButton('保存')
  }
}

/**
 * 创建Page Object工厂
 */
export function createPageObjects(page: Page) {
  return {
    login: new LoginPage(page),
    activateAccount: new ActivateAccountPage(page),
    resetPassword: new ResetPasswordPage(page),
    changePassword: new ChangePasswordPage(page),
    financeFlow: new FinanceFlowPage(page),
    accountTransfer: new AccountTransferPage(page),
    ar: new ARPage(page),
    ap: new APPage(page),
    employee: new EmployeePage(page),
    allowancePayment: new AllowancePaymentPage(page),
    leaveManagement: new LeaveManagementPage(page),
    expenseReimbursement: new ExpenseReimbursementPage(page),
    myCenter: new MyCenterPage(page),
    myLeaves: new MyLeavesPage(page),
    myReimbursements: new MyReimbursementsPage(page),
    myAssets: new MyAssetsPage(page),
    departmentManagement: new DepartmentManagementPage(page),
    categoryManagement: new CategoryManagementPage(page),
    accountManagement: new AccountManagementPage(page),
    currencyManagement: new CurrencyManagementPage(page),
    vendorManagement: new VendorManagementPage(page),
    auditLogs: new AuditLogsPage(page),
    reportARSummary: new ReportARSummaryPage(page),
    reportAPSummary: new ReportAPSummaryPage(page),
    reportDepartmentCash: new ReportDepartmentCashPage(page),
    reportAccountBalance: new ReportAccountBalancePage(page),
    fixedAssetsManagement: new FixedAssetsManagementPage(page),
    rentalManagement: new RentalManagementPage(page),
  }
}
