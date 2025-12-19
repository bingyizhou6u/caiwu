/**
 * 测试数据 Fixtures - 统一导出
 */

export * from './master-data'
export * from './employees'
export * from './finance'
export * from './assets'

import { getAllMasterDataFixtures } from './master-data'
import { getAllEmployeeFixtures } from './employees'
import { getAllFinanceFixtures } from './finance'
import { getAllAssetFixtures } from './assets'

/**
 * 获取所有测试fixtures
 */
export function getAllFixtures() {
  return {
    ...getAllMasterDataFixtures(),
    ...getAllEmployeeFixtures(),
    ...getAllFinanceFixtures(),
    ...getAllAssetFixtures(),
  }
}

/**
 * 获取最小可用fixtures（仅包含必需的主数据）
 */
export function getMinimalFixtures() {
  return {
    headquarters: getAllMasterDataFixtures().headquarters,
    departments: getAllMasterDataFixtures().departments,
    orgDepartments: getAllMasterDataFixtures().orgDepartments,
    positions: getAllMasterDataFixtures().positions,
    currencies: getAllMasterDataFixtures().currencies,
  }
}
