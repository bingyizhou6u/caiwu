/**
 * 测试数据 Fixtures - 主数据
 * 提供可预测的、可重复的主数据用于测试
 */

import { v4 as uuid } from 'uuid'

// 固定ID，便于测试断言
export const FIXTURE_IDS = {
  // 总部
  HQ_MAIN: 'hq-001',
  HQ_BRANCH: 'hq-002',
  
  // 部门/项目
  DEPT_HQ: 'dept-001',
  DEPT_PROJECT_A: 'dept-002',
  DEPT_PROJECT_B: 'dept-003',
  
  // 组织部门
  ORG_DEPT_ADMIN: 'org-dept-001',
  ORG_DEPT_FINANCE: 'org-dept-002',
  ORG_DEPT_HR: 'org-dept-003',
  ORG_DEPT_IT: 'org-dept-004',
  
  // 职位
  POS_CEO: 'pos-001',
  POS_CFO: 'pos-002',
  POS_HR_MANAGER: 'pos-003',
  POS_FINANCE_MANAGER: 'pos-004',
  POS_ACCOUNTANT: 'pos-005',
  POS_ENGINEER: 'pos-006',
  
  // 币种
  CURRENCY_CNY: 'CNY',
  CURRENCY_USD: 'USD',
  CURRENCY_USDT: 'USDT',
  
  // 账户
  ACCOUNT_BANK_CNY: 'acc-001',
  ACCOUNT_BANK_USD: 'acc-002',
  ACCOUNT_CASH_CNY: 'acc-003',
  ACCOUNT_USDT: 'acc-004',
  
  // 分类
  CAT_INCOME_SALES: 'cat-001',
  CAT_INCOME_SERVICE: 'cat-002',
  CAT_EXPENSE_SALARY: 'cat-003',
  CAT_EXPENSE_OFFICE: 'cat-004',
  CAT_EXPENSE_RENT: 'cat-005',
  
  // 供应商
  VENDOR_A: 'vendor-001',
  VENDOR_B: 'vendor-002',
  
  // 场地
  SITE_OFFICE_A: 'site-001',
  SITE_OFFICE_B: 'site-002',
}

/**
 * 总部数据
 */
export function getHeadquartersFixtures() {
  return [
    {
      id: FIXTURE_IDS.HQ_MAIN,
      name: '总部',
      active: 1,
    },
    {
      id: FIXTURE_IDS.HQ_BRANCH,
      name: '分部',
      active: 1,
    },
  ]
}

/**
 * 部门/项目数据
 */
export function getDepartmentsFixtures() {
  const now = Date.now()
  return [
    {
      id: FIXTURE_IDS.DEPT_HQ,
      hqId: FIXTURE_IDS.HQ_MAIN,
      name: 'HQ总部',
      code: 'HQ',
      active: 1,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.DEPT_PROJECT_A,
      hqId: FIXTURE_IDS.HQ_MAIN,
      name: 'A项目',
      code: 'PRJ-A',
      active: 1,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.DEPT_PROJECT_B,
      hqId: FIXTURE_IDS.HQ_BRANCH,
      name: 'B项目',
      code: 'PRJ-B',
      active: 1,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 组织部门数据
 */
export function getOrgDepartmentsFixtures() {
  const now = Date.now()
  return [
    {
      id: FIXTURE_IDS.ORG_DEPT_ADMIN,
      projectId: FIXTURE_IDS.DEPT_HQ,
      parentId: null,
      name: '行政部',
      code: 'ADMIN',
      description: '行政管理部门',
      allowedModules: JSON.stringify(['hr', 'finance']),
      allowedPositions: JSON.stringify([FIXTURE_IDS.POS_CEO, FIXTURE_IDS.POS_HR_MANAGER]),
      defaultPositionId: FIXTURE_IDS.POS_HR_MANAGER,
      active: 1,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.ORG_DEPT_FINANCE,
      projectId: FIXTURE_IDS.DEPT_HQ,
      parentId: null,
      name: '财务部',
      code: 'FIN',
      description: '财务管理部门',
      allowedModules: JSON.stringify(['finance']),
      allowedPositions: JSON.stringify([FIXTURE_IDS.POS_CFO, FIXTURE_IDS.POS_FINANCE_MANAGER, FIXTURE_IDS.POS_ACCOUNTANT]),
      defaultPositionId: FIXTURE_IDS.POS_ACCOUNTANT,
      active: 1,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.ORG_DEPT_HR,
      projectId: FIXTURE_IDS.DEPT_HQ,
      parentId: FIXTURE_IDS.ORG_DEPT_ADMIN,
      name: '人事部',
      code: 'HR',
      description: '人力资源部门',
      allowedModules: JSON.stringify(['hr']),
      allowedPositions: JSON.stringify([FIXTURE_IDS.POS_HR_MANAGER]),
      defaultPositionId: FIXTURE_IDS.POS_HR_MANAGER,
      active: 1,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.ORG_DEPT_IT,
      projectId: FIXTURE_IDS.DEPT_PROJECT_A,
      parentId: null,
      name: '技术部',
      code: 'IT',
      description: '技术开发部门',
      allowedModules: JSON.stringify(['project']),
      allowedPositions: JSON.stringify([FIXTURE_IDS.POS_ENGINEER]),
      defaultPositionId: FIXTURE_IDS.POS_ENGINEER,
      active: 1,
      sortOrder: 4,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 职位数据
 */
export function getPositionsFixtures() {
  const now = Date.now()
  return [
    {
      id: FIXTURE_IDS.POS_CEO,
      code: 'ceo',
      name: '总经理',
      level: 1,
      canManageSubordinates: 1,
      description: '公司最高管理者',
      permissions: JSON.stringify({
        hr: { employee: ['view', 'create', 'update', 'delete'], position: ['view', 'create', 'update', 'delete'] },
        finance: { flow: ['view', 'create', 'update', 'delete'], account: ['view', 'create', 'update', 'delete'] },
      }),
      sortOrder: 1,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.POS_CFO,
      code: 'cfo',
      name: '财务总监',
      level: 2,
      canManageSubordinates: 1,
      description: '财务负责人',
      permissions: JSON.stringify({
        finance: { flow: ['view', 'create', 'update', 'delete'], account: ['view', 'create', 'update'], ar: ['view', 'create'], ap: ['view', 'create'] },
      }),
      sortOrder: 2,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.POS_HR_MANAGER,
      code: 'hr_manager',
      name: '人事经理',
      level: 3,
      canManageSubordinates: 1,
      description: '人力资源管理',
      permissions: JSON.stringify({
        hr: { employee: ['view', 'create', 'update'], leave: ['view', 'approve'], allowance: ['view', 'create'] },
      }),
      sortOrder: 3,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.POS_FINANCE_MANAGER,
      code: 'finance_manager',
      name: '财务经理',
      level: 3,
      canManageSubordinates: 1,
      description: '财务管理',
      permissions: JSON.stringify({
        finance: { flow: ['view', 'create', 'update'], account: ['view'], ar: ['view', 'create'], ap: ['view', 'create'] },
      }),
      sortOrder: 4,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.POS_ACCOUNTANT,
      code: 'accountant',
      name: '会计',
      level: 4,
      canManageSubordinates: 0,
      description: '财务会计',
      permissions: JSON.stringify({
        finance: { flow: ['view', 'create'], account: ['view'] },
      }),
      sortOrder: 5,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.POS_ENGINEER,
      code: 'engineer',
      name: '工程师',
      level: 4,
      canManageSubordinates: 0,
      description: '技术开发',
      permissions: JSON.stringify({
        project: { task: ['view', 'create', 'update'] },
      }),
      sortOrder: 6,
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 币种数据
 */
export function getCurrenciesFixtures() {
  return [
    {
      code: FIXTURE_IDS.CURRENCY_CNY,
      name: '人民币',
      symbol: '¥',
      active: 1,
    },
    {
      code: FIXTURE_IDS.CURRENCY_USD,
      name: '美元',
      symbol: '$',
      active: 1,
    },
    {
      code: FIXTURE_IDS.CURRENCY_USDT,
      name: 'USDT',
      symbol: 'USDT',
      active: 1,
    },
  ]
}

/**
 * 账户数据
 */
export function getAccountsFixtures() {
  return [
    {
      id: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      name: '工商银行-人民币',
      type: 'bank',
      currency: FIXTURE_IDS.CURRENCY_CNY,
      alias: 'ICBC-CNY',
      accountNumber: '6222021234567890',
      openingCents: 10000000, // 100,000 CNY
      active: 1,
      version: 1,
    },
    {
      id: FIXTURE_IDS.ACCOUNT_BANK_USD,
      name: '美国银行-美元',
      type: 'bank',
      currency: FIXTURE_IDS.CURRENCY_USD,
      alias: 'BOA-USD',
      accountNumber: '4111111111111111',
      openingCents: 5000000, // 50,000 USD
      active: 1,
      version: 1,
    },
    {
      id: FIXTURE_IDS.ACCOUNT_CASH_CNY,
      name: '库存现金-人民币',
      type: 'cash',
      currency: FIXTURE_IDS.CURRENCY_CNY,
      alias: 'Cash-CNY',
      accountNumber: null,
      openingCents: 1000000, // 10,000 CNY
      active: 1,
      version: 1,
    },
    {
      id: FIXTURE_IDS.ACCOUNT_USDT,
      name: 'USDT钱包',
      type: 'cryptocurrency',
      currency: FIXTURE_IDS.CURRENCY_USDT,
      alias: 'USDT-Wallet',
      accountNumber: 'TXXXxxxxxxxxxxxxxxxxxxxx',
      openingCents: 2000000, // 20,000 USDT
      active: 1,
      version: 1,
    },
  ]
}

/**
 * 分类数据
 */
export function getCategoriesFixtures() {
  return [
    {
      id: FIXTURE_IDS.CAT_INCOME_SALES,
      name: '销售收入',
      kind: 'income',
      parentId: null,
      sortOrder: 1,
      active: 1,
    },
    {
      id: FIXTURE_IDS.CAT_INCOME_SERVICE,
      name: '服务收入',
      kind: 'income',
      parentId: null,
      sortOrder: 2,
      active: 1,
    },
    {
      id: FIXTURE_IDS.CAT_EXPENSE_SALARY,
      name: '工资支出',
      kind: 'expense',
      parentId: null,
      sortOrder: 3,
      active: 1,
    },
    {
      id: FIXTURE_IDS.CAT_EXPENSE_OFFICE,
      name: '办公费用',
      kind: 'expense',
      parentId: null,
      sortOrder: 4,
      active: 1,
    },
    {
      id: FIXTURE_IDS.CAT_EXPENSE_RENT,
      name: '租金支出',
      kind: 'expense',
      parentId: null,
      sortOrder: 5,
      active: 1,
    },
  ]
}

/**
 * 供应商数据
 */
export function getVendorsFixtures() {
  const now = Date.now()
  return [
    {
      id: FIXTURE_IDS.VENDOR_A,
      name: 'ABC供应商',
      contact: '张三',
      phone: '13800138000',
      email: 'vendor-a@example.com',
      address: '北京市朝阳区XX路XX号',
      memo: '主要供应办公用品',
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.VENDOR_B,
      name: 'XYZ科技公司',
      contact: '李四',
      phone: '13900139000',
      email: 'vendor-b@example.com',
      address: '上海市浦东新区XX路XX号',
      memo: 'IT设备供应商',
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 场地数据
 */
export function getSitesFixtures() {
  const now = Date.now()
  return [
    {
      id: FIXTURE_IDS.SITE_OFFICE_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      name: 'A办公室',
      siteCode: 'OFFICE-A',
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIXTURE_IDS.SITE_OFFICE_B,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      name: 'B办公室',
      siteCode: 'OFFICE-B',
      active: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 加载所有主数据fixtures
 */
export function getAllMasterDataFixtures() {
  return {
    headquarters: getHeadquartersFixtures(),
    departments: getDepartmentsFixtures(),
    orgDepartments: getOrgDepartmentsFixtures(),
    positions: getPositionsFixtures(),
    currencies: getCurrenciesFixtures(),
    accounts: getAccountsFixtures(),
    categories: getCategoriesFixtures(),
    vendors: getVendorsFixtures(),
    sites: getSitesFixtures(),
  }
}
