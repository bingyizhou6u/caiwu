/**
 * 测试数据 Fixtures - 资产数据
 * 提供固定资产和租赁相关的测试数据
 */

import { v4 as uuid } from 'uuid'
import { FIXTURE_IDS } from './master-data'
import { EMPLOYEE_IDS } from './employees'

// 固定资产ID
export const ASSET_IDS = {
  LAPTOP_1: 'asset-001',
  LAPTOP_2: 'asset-002',
  DESK_1: 'asset-003',
  MONITOR_1: 'asset-004',
  SERVER_1: 'asset-005',
}

// 租赁物业ID
export const RENTAL_IDS = {
  OFFICE_PROPERTY: 'rental-001',
  DORMITORY_1: 'rental-002',
  WAREHOUSE: 'rental-003',
}

/**
 * 固定资产数据
 */
export function getFixedAssetsFixtures() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const lastYear = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
  const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: ASSET_IDS.LAPTOP_1,
      assetCode: 'IT-LAPTOP-001',
      name: 'ThinkPad X1 Carbon',
      category: 'computer',
      purchaseDate: lastYear,
      purchasePriceCents: 1200000, // 12,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      vendorId: FIXTURE_IDS.VENDOR_B,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      custodian: EMPLOYEE_IDS.ENGINEER_1,
      status: 'in_use',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 3,
      currentValueCents: 800000, // 8,000 CNY
      memo: '分配给工程师使用',
      saleDate: null,
      salePriceCents: null,
      saleBuyer: null,
      saleMemo: null,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
    {
      id: ASSET_IDS.LAPTOP_2,
      assetCode: 'IT-LAPTOP-002',
      name: 'MacBook Pro 16"',
      category: 'computer',
      purchaseDate: twoYearsAgo,
      purchasePriceCents: 250000, // 2,500 USD (以分为单位)
      currency: FIXTURE_IDS.CURRENCY_USD,
      vendorId: FIXTURE_IDS.VENDOR_B,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      siteId: null,
      custodian: EMPLOYEE_IDS.ENGINEER_2,
      status: 'in_use',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 3,
      currentValueCents: 83333, // ~833 USD
      memo: '开发用笔记本',
      saleDate: null,
      salePriceCents: null,
      saleBuyer: null,
      saleMemo: null,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 730 * 86400000,
      updatedAt: now - 730 * 86400000,
    },
    {
      id: ASSET_IDS.DESK_1,
      assetCode: 'FUR-DESK-001',
      name: '办公桌',
      category: 'furniture',
      purchaseDate: twoYearsAgo,
      purchasePriceCents: 200000, // 2,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      vendorId: FIXTURE_IDS.VENDOR_A,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      custodian: null,
      status: 'in_use',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 5,
      currentValueCents: 120000, // 1,200 CNY
      memo: '前台办公桌',
      saleDate: null,
      salePriceCents: null,
      saleBuyer: null,
      saleMemo: null,
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 730 * 86400000,
      updatedAt: now - 730 * 86400000,
    },
    {
      id: ASSET_IDS.MONITOR_1,
      assetCode: 'IT-MON-001',
      name: 'Dell 27" 4K显示器',
      category: 'computer',
      purchaseDate: lastYear,
      purchasePriceCents: 300000, // 3,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      vendorId: FIXTURE_IDS.VENDOR_B,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      siteId: FIXTURE_IDS.SITE_OFFICE_A,
      custodian: EMPLOYEE_IDS.FINANCE_MANAGER,
      status: 'in_use',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 3,
      currentValueCents: 200000, // 2,000 CNY
      memo: '财务部使用',
      saleDate: null,
      salePriceCents: null,
      saleBuyer: null,
      saleMemo: null,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
    {
      id: ASSET_IDS.SERVER_1,
      assetCode: 'IT-SRV-001',
      name: 'Dell PowerEdge服务器',
      category: 'server',
      purchaseDate: twoYearsAgo,
      purchasePriceCents: 5000000, // 50,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      vendorId: FIXTURE_IDS.VENDOR_B,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      siteId: FIXTURE_IDS.SITE_OFFICE_B,
      custodian: null,
      status: 'in_use',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 5,
      currentValueCents: 3000000, // 30,000 CNY
      memo: '生产服务器',
      saleDate: null,
      salePriceCents: null,
      saleBuyer: null,
      saleMemo: null,
      createdBy: EMPLOYEE_IDS.CEO,
      createdAt: now - 730 * 86400000,
      updatedAt: now - 730 * 86400000,
    },
  ]
}

/**
 * 固定资产折旧记录
 */
export function getFixedAssetDepreciationsFixtures() {
  const now = Date.now()
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      assetId: ASSET_IDS.LAPTOP_1,
      depreciationDate: lastMonth,
      depreciationAmountCents: 33333, // ~333 CNY/month
      accumulatedDepreciationCents: 400000, // 4,000 CNY
      remainingValueCents: 800000, // 8,000 CNY
      memo: '月度折旧',
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 30 * 86400000,
    },
    {
      id: uuid(),
      assetId: ASSET_IDS.SERVER_1,
      depreciationDate: lastMonth,
      depreciationAmountCents: 83333, // ~833 CNY/month
      accumulatedDepreciationCents: 2000000, // 20,000 CNY
      remainingValueCents: 3000000, // 30,000 CNY
      memo: '月度折旧',
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 30 * 86400000,
    },
  ]
}

/**
 * 固定资产变更历史
 */
export function getFixedAssetChangesFixtures() {
  const now = Date.now()
  const lastYear = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      assetId: ASSET_IDS.LAPTOP_1,
      changeType: 'purchase',
      changeDate: lastYear,
      fromDeptId: null,
      toDeptId: FIXTURE_IDS.DEPT_HQ,
      fromSiteId: null,
      toSiteId: FIXTURE_IDS.SITE_OFFICE_A,
      fromCustodian: null,
      toCustodian: null,
      fromStatus: null,
      toStatus: 'in_use',
      memo: '采购入库',
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 365 * 86400000,
    },
    {
      id: uuid(),
      assetId: ASSET_IDS.LAPTOP_1,
      changeType: 'allocation',
      changeDate: lastYear,
      fromDeptId: null,
      toDeptId: null,
      fromSiteId: null,
      toSiteId: null,
      fromCustodian: null,
      toCustodian: EMPLOYEE_IDS.ENGINEER_1,
      fromStatus: null,
      toStatus: null,
      memo: '分配给工程师1',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 364 * 86400000,
    },
  ]
}

/**
 * 固定资产分配记录
 */
export function getFixedAssetAllocationsFixtures() {
  const now = Date.now()
  const lastYear = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      assetId: ASSET_IDS.LAPTOP_1,
      employeeId: EMPLOYEE_IDS.ENGINEER_1,
      allocationDate: lastYear,
      allocationType: 'employee_onboarding',
      returnDate: null,
      returnType: null,
      memo: '入职分配',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
    {
      id: uuid(),
      assetId: ASSET_IDS.LAPTOP_2,
      employeeId: EMPLOYEE_IDS.ENGINEER_2,
      allocationDate: lastYear,
      allocationType: 'employee_onboarding',
      returnDate: null,
      returnType: null,
      memo: '入职分配',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
  ]
}

/**
 * 租赁物业数据
 */
export function getRentalPropertiesFixtures() {
  const now = Date.now()
  const leaseStart = '2024-01-01'
  const leaseEnd = '2024-12-31'
  
  return [
    {
      id: RENTAL_IDS.OFFICE_PROPERTY,
      propertyCode: 'RENT-OFFICE-001',
      name: 'A办公室租赁',
      propertyType: 'office',
      address: '北京市朝阳区XX路XX号',
      areaSqm: 200.0,
      rentType: 'monthly',
      monthlyRentCents: 2000000, // 20,000 CNY
      yearlyRentCents: 24000000, // 240,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      paymentPeriodMonths: 3, // 按季度付款
      landlordName: '房东张三',
      landlordContact: '13900000001',
      leaseStartDate: leaseStart,
      leaseEndDate: leaseEnd,
      depositCents: 6000000, // 60,000 CNY (3个月租金)
      paymentMethod: 'bank_transfer',
      paymentAccountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      paymentDay: 5,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      status: 'active',
      memo: '总部办公室',
      contractFileUrl: 'https://example.com/contract-office.pdf',
      createdBy: EMPLOYEE_IDS.CFO,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
    {
      id: RENTAL_IDS.DORMITORY_1,
      propertyCode: 'RENT-DORM-001',
      name: '员工宿舍1号楼',
      propertyType: 'dormitory',
      address: '北京市朝阳区XX路YY号',
      areaSqm: 500.0,
      rentType: 'monthly',
      monthlyRentCents: 5000000, // 50,000 CNY
      yearlyRentCents: 60000000, // 600,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      paymentPeriodMonths: 1,
      landlordName: '房东李四',
      landlordContact: '13900000002',
      leaseStartDate: leaseStart,
      leaseEndDate: leaseEnd,
      depositCents: 10000000, // 100,000 CNY
      paymentMethod: 'bank_transfer',
      paymentAccountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      paymentDay: 1,
      departmentId: FIXTURE_IDS.DEPT_HQ,
      status: 'active',
      memo: '员工宿舍，可住20人',
      contractFileUrl: 'https://example.com/contract-dorm.pdf',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
    {
      id: RENTAL_IDS.WAREHOUSE,
      propertyCode: 'RENT-WH-001',
      name: '仓库租赁',
      propertyType: 'warehouse',
      address: '上海市浦东新区XX路ZZ号',
      areaSqm: 1000.0,
      rentType: 'monthly',
      monthlyRentCents: 3000000, // 30,000 CNY
      yearlyRentCents: 36000000, // 360,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      paymentPeriodMonths: 6, // 按半年付款
      landlordName: '房东王五',
      landlordContact: '13900000003',
      leaseStartDate: leaseStart,
      leaseEndDate: leaseEnd,
      depositCents: 9000000, // 90,000 CNY
      paymentMethod: 'bank_transfer',
      paymentAccountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      paymentDay: 10,
      departmentId: FIXTURE_IDS.DEPT_PROJECT_A,
      status: 'active',
      memo: '项目仓库',
      contractFileUrl: 'https://example.com/contract-warehouse.pdf',
      createdBy: EMPLOYEE_IDS.CFO,
      createdAt: now - 365 * 86400000,
      updatedAt: now - 365 * 86400000,
    },
  ]
}

/**
 * 租金支付记录
 */
export function getRentalPaymentsFixtures() {
  const now = Date.now()
  const lastMonth = new Date(Date.now() - 30 * 86400000)
  const year = lastMonth.getFullYear()
  const month = lastMonth.getMonth() + 1
  const paymentDate = lastMonth.toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      propertyId: RENTAL_IDS.OFFICE_PROPERTY,
      paymentDate,
      year,
      month,
      amountCents: 6000000, // 60,000 CNY (季度付款，3个月)
      currency: FIXTURE_IDS.CURRENCY_CNY,
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      categoryId: FIXTURE_IDS.CAT_EXPENSE_RENT,
      paymentMethod: 'bank_transfer',
      voucherUrl: 'https://example.com/rent-voucher-1.jpg',
      memo: '办公室租金-Q1',
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 30 * 86400000,
      updatedAt: now - 30 * 86400000,
    },
    {
      id: uuid(),
      propertyId: RENTAL_IDS.DORMITORY_1,
      paymentDate,
      year,
      month,
      amountCents: 5000000, // 50,000 CNY (月付款)
      currency: FIXTURE_IDS.CURRENCY_CNY,
      accountId: FIXTURE_IDS.ACCOUNT_BANK_CNY,
      categoryId: FIXTURE_IDS.CAT_EXPENSE_RENT,
      paymentMethod: 'bank_transfer',
      voucherUrl: 'https://example.com/rent-voucher-2.jpg',
      memo: `宿舍租金-${year}年${month}月`,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now - 30 * 86400000,
      updatedAt: now - 30 * 86400000,
    },
  ]
}

/**
 * 宿舍分配记录
 */
export function getDormitoryAllocationsFixtures() {
  const now = Date.now()
  const allocationDate = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      propertyId: RENTAL_IDS.DORMITORY_1,
      employeeId: EMPLOYEE_IDS.ENGINEER_1,
      roomNumber: '201',
      bedNumber: 'A',
      allocationDate,
      monthlyRentCents: 100000, // 1,000 CNY (员工分摊)
      returnDate: null,
      memo: '员工宿舍分配',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 180 * 86400000,
      updatedAt: now - 180 * 86400000,
    },
    {
      id: uuid(),
      propertyId: RENTAL_IDS.DORMITORY_1,
      employeeId: EMPLOYEE_IDS.ENGINEER_2,
      roomNumber: '201',
      bedNumber: 'B',
      allocationDate,
      monthlyRentCents: 100000, // 1,000 CNY
      returnDate: null,
      memo: '员工宿舍分配',
      createdBy: EMPLOYEE_IDS.HR_MANAGER,
      createdAt: now - 180 * 86400000,
      updatedAt: now - 180 * 86400000,
    },
  ]
}

/**
 * 租金应付账单
 */
export function getRentalPayableBillsFixtures() {
  const now = Date.now()
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const billDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
  const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 5).toISOString().split('T')[0]
  
  return [
    {
      id: uuid(),
      propertyId: RENTAL_IDS.OFFICE_PROPERTY,
      billDate,
      dueDate,
      year,
      month,
      amountCents: 6000000, // 60,000 CNY (季度)
      currency: FIXTURE_IDS.CURRENCY_CNY,
      paymentPeriodMonths: 3,
      status: 'unpaid',
      paidDate: null,
      paidPaymentId: null,
      memo: `办公室租金账单-${year}年${month}月`,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      propertyId: RENTAL_IDS.DORMITORY_1,
      billDate,
      dueDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0],
      year,
      month,
      amountCents: 5000000, // 50,000 CNY
      currency: FIXTURE_IDS.CURRENCY_CNY,
      paymentPeriodMonths: 1,
      status: 'unpaid',
      paidDate: null,
      paidPaymentId: null,
      memo: `宿舍租金账单-${year}年${month}月`,
      createdBy: EMPLOYEE_IDS.FINANCE_MANAGER,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 加载所有资产相关fixtures
 */
export function getAllAssetFixtures() {
  return {
    fixedAssets: getFixedAssetsFixtures(),
    fixedAssetDepreciations: getFixedAssetDepreciationsFixtures(),
    fixedAssetChanges: getFixedAssetChangesFixtures(),
    fixedAssetAllocations: getFixedAssetAllocationsFixtures(),
    rentalProperties: getRentalPropertiesFixtures(),
    rentalPayments: getRentalPaymentsFixtures(),
    dormitoryAllocations: getDormitoryAllocationsFixtures(),
    rentalPayableBills: getRentalPayableBillsFixtures(),
  }
}
