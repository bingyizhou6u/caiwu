#!/usr/bin/env tsx
/**
 * 测试数据种子生成脚本
 * 
 * 用法:
 *   npm run test:seed                # 生成所有测试数据
 *   npm run test:seed -- --minimal   # 仅生成最小数据集
 *   npm run test:seed -- --remote    # 生成到远程数据库
 */

import { drizzle } from 'drizzle-orm/d1'
import Database from 'better-sqlite3'
import * as schema from '../../src/db/schema'
import { getAllFixtures, getMinimalFixtures } from '../../test/fixtures'
import { bulkInsert } from '../../test/helpers/db-helper'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

// 解析命令行参数
const args = process.argv.slice(2)
const isRemote = args.includes('--remote') || args.includes('-r')
const isMinimal = args.includes('--minimal') || args.includes('-m')
const isDryRun = args.includes('--dry-run') || args.includes('-d')

console.log('='.repeat(60))
console.log('测试数据种子生成脚本')
console.log('='.repeat(60))
console.log(`模式: ${isRemote ? '远程数据库' : '本地数据库'}`)
console.log(`数据集: ${isMinimal ? '最小数据集' : '完整数据集'}`)
console.log(`执行: ${isDryRun ? '试运行(不实际写入)' : '实际写入'}`)
console.log('='.repeat(60))

async function seedLocalDatabase() {
  console.log('\n开始生成本地数据库种子数据...')
  
  // 使用better-sqlite3创建本地数据库
  const sqlite = new Database(':memory:')
  
  // 应用schema
  console.log('应用数据库schema...')
  const schemaSql = readFileSync(resolve(process.cwd(), 'src/db/schema.sql'), 'utf-8')
  const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
  
  for (const statement of statements) {
    try {
      sqlite.exec(statement)
    } catch (error) {
      console.warn('Schema应用警告:', error)
    }
  }
  
  const db = drizzle(sqlite, { schema }) as any
  
  // 生成种子数据
  await seedDatabase(db)
  
  console.log('✓ 本地数据库种子数据生成完成')
  sqlite.close()
}

async function seedRemoteDatabase() {
  console.log('\n开始生成远程数据库种子数据...')
  console.log('注意: 远程数据库种子生成需要wrangler配置')
  
  // 这里需要通过wrangler访问远程D1数据库
  // 实际实现需要根据wrangler的API来操作
  console.warn('远程数据库种子生成暂未实现，请手动执行或使用本地模式')
}

async function seedDatabase(db: any) {
  const fixtures = isMinimal ? getMinimalFixtures() : getAllFixtures()
  
  console.log('\n开始插入种子数据...')
  let insertedCount = 0
  
  // 按依赖顺序插入数据
  const insertionOrder: Array<{ name: string; table: keyof typeof schema; data: any[] }> = [
    { name: '币种', table: 'currencies', data: fixtures.currencies || [] },
    { name: '总部', table: 'headquarters', data: fixtures.headquarters || [] },
    { name: '部门/项目', table: 'departments', data: fixtures.departments || [] },
    { name: '组织部门', table: 'orgDepartments', data: fixtures.orgDepartments || [] },
    { name: '职位', table: 'positions', data: fixtures.positions || [] },
    { name: '账户', table: 'accounts', data: fixtures.accounts || [] },
    { name: '分类', table: 'categories', data: fixtures.categories || [] },
    { name: '供应商', table: 'vendors', data: fixtures.vendors || [] },
    { name: '场地', table: 'sites', data: fixtures.sites || [] },
    { name: '员工', table: 'employees', data: fixtures.employees || [] },
    { name: '员工薪资', table: 'employeeSalaries', data: fixtures.employeeSalaries || [] },
    { name: '员工津贴', table: 'employeeAllowances', data: fixtures.employeeAllowances || [] },
    { name: '借款人', table: 'borrowers', data: fixtures.borrowers || [] },
    { name: '现金流水', table: 'cashFlows', data: fixtures.cashFlows || [] },
    { name: '账户交易', table: 'accountTransactions', data: fixtures.accountTransactions || [] },
    { name: '应收应付', table: 'arApDocs', data: fixtures.arDocs?.concat(fixtures.apDocs || []) || [] },
    { name: '借款', table: 'borrowings', data: fixtures.borrowings || [] },
    { name: '固定资产', table: 'fixedAssets', data: fixtures.fixedAssets || [] },
    { name: '资产折旧', table: 'fixedAssetDepreciations', data: fixtures.fixedAssetDepreciations || [] },
    { name: '资产变更', table: 'fixedAssetChanges', data: fixtures.fixedAssetChanges || [] },
    { name: '资产分配', table: 'fixedAssetAllocations', data: fixtures.fixedAssetAllocations || [] },
    { name: '租赁物业', table: 'rentalProperties', data: fixtures.rentalProperties || [] },
    { name: '租金支付', table: 'rentalPayments', data: fixtures.rentalPayments || [] },
    { name: '宿舍分配', table: 'dormitoryAllocations', data: fixtures.dormitoryAllocations || [] },
    { name: '租金账单', table: 'rentalPayableBills', data: fixtures.rentalPayableBills || [] },
  ]
  
  for (const { name, table, data } of insertionOrder) {
    if (data && data.length > 0) {
      if (isDryRun) {
        console.log(`  [试运行] ${name}: ${data.length} 条记录`)
        insertedCount += data.length
      } else {
        try {
          const tableSchema = schema[table]
          await db.insert(tableSchema).values(data).execute()
          console.log(`  ✓ ${name}: ${data.length} 条记录`)
          insertedCount += data.length
        } catch (error: any) {
          console.error(`  ✗ ${name}: 插入失败 -`, error.message)
        }
      }
    }
  }
  
  console.log(`\n总计插入: ${insertedCount} 条记录`)
}

async function main() {
  try {
    if (isDryRun) {
      console.log('\n[试运行模式] 以下是将要执行的操作:')
    }
    
    if (isRemote) {
      await seedRemoteDatabase()
    } else {
      await seedLocalDatabase()
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('种子数据生成完成!')
    console.log('='.repeat(60))
    
    if (!isDryRun) {
      console.log('\n提示: 你可以使用以下命令运行测试:')
      console.log('  npm test')
    }
  } catch (error: any) {
    console.error('\n种子数据生成失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
