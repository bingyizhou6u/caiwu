/**
 * Page Object 模式 - 封装页面操作
 */

import { Page, Locator } from '@playwright/test'

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
    await this.goto('/login')
    await this.fillInput('email', email)
    await this.fillInput('password', password)
    await this.clickButton('登录')
  }

  async loginWithTotp(email: string, password: string, totp: string) {
    await this.login(email, password)
    await this.fillInput('totp', totp)
    await this.clickButton('验证')
  }

  async expectLoginSuccess() {
    await this.page.waitForURL(/.*\/dashboard/)
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
 * 创建Page Object工厂
 */
export function createPageObjects(page: Page) {
  return {
    login: new LoginPage(page),
    financeFlow: new FinanceFlowPage(page),
    employee: new EmployeePage(page),
  }
}
