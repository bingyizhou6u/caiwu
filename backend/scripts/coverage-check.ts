#!/usr/bin/env tsx
/**
 * 覆盖率检查脚本
 * 
 * 用法:
 *   npm run test:coverage:check
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// 定义覆盖率阈值
const THRESHOLDS = {
  lines: 70,
  functions: 70,
  branches: 65,
  statements: 70,
}

interface CoverageSummary {
  total: {
    lines: { pct: number }
    statements: { pct: number }
    functions: { pct: number }
    branches: { pct: number }
  }
}

console.log('='.repeat(60))
console.log('覆盖率检查')
console.log('='.repeat(60))

async function checkCoverage() {
  const coverageFile = resolve(process.cwd(), 'coverage/coverage-summary.json')
  
  if (!existsSync(coverageFile)) {
    console.error('\n错误: 未找到覆盖率报告文件')
    console.log('请先运行: npm run test:coverage')
    process.exit(1)
  }
  
  const coverageData: CoverageSummary = JSON.parse(readFileSync(coverageFile, 'utf-8'))
  const { total } = coverageData
  
  console.log('\n当前覆盖率:')
  console.log(`  语句覆盖率: ${total.statements.pct.toFixed(2)}% (要求: ${THRESHOLDS.statements}%)`)
  console.log(`  分支覆盖率: ${total.branches.pct.toFixed(2)}% (要求: ${THRESHOLDS.branches}%)`)
  console.log(`  函数覆盖率: ${total.functions.pct.toFixed(2)}% (要求: ${THRESHOLDS.functions}%)`)
  console.log(`  行覆盖率  : ${total.lines.pct.toFixed(2)}% (要求: ${THRESHOLDS.lines}%)`)
  
  const failures: string[] = []
  
  if (total.statements.pct < THRESHOLDS.statements) {
    failures.push(`语句覆盖率 ${total.statements.pct.toFixed(2)}% < ${THRESHOLDS.statements}%`)
  }
  if (total.branches.pct < THRESHOLDS.branches) {
    failures.push(`分支覆盖率 ${total.branches.pct.toFixed(2)}% < ${THRESHOLDS.branches}%`)
  }
  if (total.functions.pct < THRESHOLDS.functions) {
    failures.push(`函数覆盖率 ${total.functions.pct.toFixed(2)}% < ${THRESHOLDS.functions}%`)
  }
  if (total.lines.pct < THRESHOLDS.lines) {
    failures.push(`行覆盖率 ${total.lines.pct.toFixed(2)}% < ${THRESHOLDS.lines}%`)
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (failures.length > 0) {
    console.log('✗ 覆盖率检查失败')
    console.log('\n未达标项:')
    failures.forEach(f => console.log(`  - ${f}`))
    console.log('\n请增加测试用例以提高覆盖率')
    process.exit(1)
  } else {
    console.log('✓ 覆盖率检查通过')
    console.log('所有指标均达到要求')
  }
  
  console.log('='.repeat(60))
}

checkCoverage().catch(error => {
  console.error('覆盖率检查失败:', error.message)
  process.exit(1)
})
