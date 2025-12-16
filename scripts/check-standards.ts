/**
 * 代码规范检查脚本
 * 用于检查代码是否符合开发规范
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

interface CheckResult {
  file: string
  issues: Issue[]
}

interface Issue {
  line: number
  type: 'missing_performance_tracking' | 'missing_batch_query' | 'other'
  message: string
  code: string
}

const SERVICES_DIR = join(process.cwd(), 'backend/src/services')

/**
 * 检查文件是否符合规范
 */
async function checkFile(filePath: string): Promise<Issue[]> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const issues: Issue[] = []

  // 检查是否有性能监控
  const hasPerformanceTracking = 
    content.includes('DBPerformanceTracker') ||
    content.includes('QueryHelpers') ||
    content.includes('query(') ||
    content.includes('getByIds(')

  // 检查是否有直接数据库查询
  const directQueries = lines
    .map((line, index) => ({
      line: index + 1,
      content: line,
    }))
    .filter(({ content }) => 
      content.includes('.select()') && 
      (content.includes('.from(') && (content.includes('.get()') || content.includes('.all()')))
    )

  // 如果没有性能监控工具，但有多处直接查询
  if (!hasPerformanceTracking && directQueries.length > 0) {
    directQueries.forEach(({ line, content }) => {
      issues.push({
        line,
        type: 'missing_performance_tracking',
        message: '数据库查询未使用性能监控',
        code: content.trim(),
      })
    })
  }

  // 检查批量查询
  const hasInArray = content.includes('inArray(')
  const hasBatchQuery = 
    content.includes('BatchQuery') ||
    content.includes('getByIds(')

  if (hasInArray && !hasBatchQuery) {
    const inArrayLines = lines
      .map((line, index) => ({
        line: index + 1,
        content: line,
      }))
      .filter(({ content }) => content.includes('inArray('))

    inArrayLines.forEach(({ line, content }) => {
      issues.push({
        line,
        type: 'missing_batch_query',
        message: '使用 inArray 但未使用批量查询工具',
        code: content.trim(),
      })
    })
  }

  return issues
}

/**
 * 检查所有服务文件
 */
async function checkAllServices(): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  
  async function checkDirectory(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await checkDirectory(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const issues = await checkFile(fullPath)
        if (issues.length > 0) {
          results.push({
            file: fullPath.replace(process.cwd(), ''),
            issues,
          })
        }
      }
    }
  }

  await checkDirectory(SERVICES_DIR)
  return results
}

/**
 * 生成报告
 */
function generateReport(results: CheckResult[]): string {
  let report = '# 代码规范检查报告\n\n'
  report += `**检查时间**: ${new Date().toISOString()}\n\n`
  
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0)
  const performanceIssues = results.reduce(
    (sum, r) => sum + r.issues.filter(i => i.type === 'missing_performance_tracking').length,
    0
  )
  const batchQueryIssues = results.reduce(
    (sum, r) => sum + r.issues.filter(i => i.type === 'missing_batch_query').length,
    0
  )

  report += `## 统计\n\n`
  report += `- **检查文件数**: ${results.length}\n`
  report += `- **总问题数**: ${totalIssues}\n`
  report += `- **性能监控缺失**: ${performanceIssues}\n`
  report += `- **批量查询未优化**: ${batchQueryIssues}\n\n`

  report += `## 问题详情\n\n`

  results.forEach(result => {
    report += `### ${result.file}\n\n`
    result.issues.forEach(issue => {
      report += `- **Line ${issue.line}**: ${issue.message}\n`
      report += `  \`\`\`typescript\n  ${issue.code}\n  \`\`\`\n\n`
    })
  })

  return report
}

/**
 * 主函数
 */
async function main() {
  console.log('开始检查代码规范...')
  const results = await checkAllServices()
  const report = generateReport(results)
  
  console.log(report)
  
  if (results.length > 0) {
    console.log(`\n发现 ${results.length} 个文件不符合规范`)
    process.exit(1)
  } else {
    console.log('\n所有文件符合规范！')
    process.exit(0)
  }
}

main().catch(console.error)
