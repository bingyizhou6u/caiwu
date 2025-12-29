#!/usr/bin/env tsx
/**
 * 测试数据清理脚本
 * 
 * 用法:
 *   npm run test:clean              # 清理所有测试数据
 *   npm run test:clean -- --module=finance  # 仅清理财务模块
 *   npm run test:clean -- --remote  # 清理远程数据库
 */

import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../src/db/schema.js'
import { truncateTable, truncateAllTables } from '../test/helpers/db-helper.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 解析命令行参数
const args = process.argv.slice(2)
const isRemote = args.includes('--remote') || args.includes('-r')
const moduleArg = args.find(arg => arg.startsWith('--module='))
const targetModule = moduleArg ? moduleArg.split('=')[1] : null
const isDryRun = args.includes('--dry-run') || args.includes('-d')

console.log('='.repeat(60))
console.log('测试数据清理脚本')
console.log('='.repeat(60))
console.log(`模式: ${isRemote ? '远程数据库' : '本地数据库'}`)
console.log(`范围: ${targetModule || '所有模块'}`)
console.log(`执行: ${isDryRun ? '试运行(不实际删除)' : '实际删除'}`)
console.log('='.repeat(60))

// 定义模块表映射
const MODULE_TABLES: Record<string, Array<keyof typeof schema>> = {
  finance: [
    'accountTransactions',
    'cashFlows',
    'arApDocs',
  ],
  hr: [
    'salaryPaymentAllocations',
    'salaryPayments',
    'allowancePayments',
    'employeeLeaves',
    'expenseReimbursements',
    'employeeAllowances',
    'employeeSalaries',
    'employees',
  ],
  asset: [
    'fixedAssetAllocations',
    'fixedAssetDepreciations',
    'fixedAssetChanges',
    'fixedAssets',
    'dormitoryAllocations',
    'rentalPayableBills',
    'rentalPayments',
    'rentalChanges',
    'rentalProperties',
  ],
  system: [
    'auditLogs',
    'businessOperationHistory',
    'sessions',
  ],
  master: [
    'sites',
    'accounts',
    'categories',
    'vendors',
    'orgDepartments',
    'positions',
    'projects',
    'headquarters',
    'currencies',
  ],
}

async function cleanLocalDatabase() {
  console.log('\n开始清理本地数据库...')

  const sqlite = new Database(':memory:')

  // 应用schema
  const schemaSql = readFileSync(resolve(process.cwd(), 'src/db/schema.sql'), 'utf-8')
  const statements = schemaSql.split(';').filter(s => s.trim().length > 0)

  for (const statement of statements) {
    try {
      sqlite.exec(statement)
    } catch (error) {
      // 忽略错误
    }
  }

  const db = drizzleSqlite(sqlite as any, { schema }) as any

  // 清理数据
  await cleanDatabase(db)

  console.log('✓ 本地数据库清理完成')
  sqlite.close()
}

async function cleanDatabase(db: any) {
  let cleanedCount = 0

  if (targetModule) {
    // 清理指定模块
    const tables = MODULE_TABLES[targetModule]
    if (!tables) {
      console.error(`未知的模块: ${targetModule}`)
      console.log(`可用模块: ${Object.keys(MODULE_TABLES).join(', ')}`)
      process.exit(1)
    }

    console.log(`\n清理模块: ${targetModule}`)

    for (const tableName of tables) {
      if (isDryRun) {
        console.log(`  [试运行] 清理表: ${tableName}`)
      } else {
        try {
          await truncateTable(db, tableName)
          console.log(`  ✓ ${tableName}`)
          cleanedCount++
        } catch (error: any) {
          console.error(`  ✗ ${tableName}: ${error.message}`)
        }
      }
    }
  } else {
    // 清理所有表
    console.log('\n清理所有表...')

    if (isDryRun) {
      console.log('  [试运行] 将清理所有业务表')
    } else {
      await truncateAllTables(db)
      console.log('  ✓ 所有表已清理')
    }
  }

  if (!isDryRun) {
    console.log(`\n已清理 ${cleanedCount > 0 ? cleanedCount : '所有'} 个表`)
  }
}

async function main() {
  try {
    if (isDryRun) {
      console.log('\n[试运行模式] 以下是将要执行的操作:')
    } else {
      console.log('\n警告: 这将永久删除测试数据!')
      console.log('请确认这是测试环境...')
    }

    if (isRemote) {
      console.warn('\n远程数据库清理暂未实现，请手动执行或使用本地模式')
    } else {
      await cleanLocalDatabase()
    }

    console.log('\n' + '='.repeat(60))
    console.log('数据清理完成!')
    console.log('='.repeat(60))
  } catch (error: any) {
    console.error('\n数据清理失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
