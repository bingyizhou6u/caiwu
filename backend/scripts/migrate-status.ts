/**
 * 数据库迁移状态查看工具
 * 
 * 显示详细的迁移执行历史
 * 
 * 使用方法：
 *   npm run migrate:status          # 本地数据库
 *   npm run migrate:status:remote   # 远程数据库
 */

import { execSync } from 'child_process'

/**
 * 获取迁移执行历史
 */
async function getMigrationHistory(remote: boolean = false): Promise<void> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  
  try {
    const query = `SELECT version, name, executed_at, checksum FROM schema_migrations ORDER BY executed_at DESC`
    const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
    
    console.log(`迁移执行历史 (${remote ? '远程' : '本地'}数据库):\n`)
    console.log('─'.repeat(100))
    console.log(`${'版本'.padEnd(50)} ${'执行时间'.padEnd(25)} ${'校验和'.substring(0, 16)}...`)
    console.log('─'.repeat(100))
    
    execSync(command, { 
      encoding: 'utf-8',
      stdio: 'inherit'
    })
    
    console.log('─'.repeat(100))
  } catch (error) {
    console.error('获取迁移历史失败:', error)
    console.log('\n提示: 如果这是首次运行，请先执行 npm run migrate:up')
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const remote = args.includes('--remote') || args.includes('-r')
  
  await getMigrationHistory(remote)
}

main().catch(error => {
  console.error('操作失败:', error)
  process.exit(1)
})

