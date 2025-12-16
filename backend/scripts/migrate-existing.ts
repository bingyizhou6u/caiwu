/**
 * 迁移现有迁移记录到 schema_migrations 表
 * 
 * 此脚本用于一次性将现有的迁移文件记录到 schema_migrations 表中
 * 假设这些迁移已经在数据库中执行过，只是没有记录
 * 
 * 使用方法：
 *   npm run migrate:existing          # 本地数据库
 *   npm run migrate:existing:remote    # 远程数据库
 */

import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'
import { execSync } from 'child_process'

/**
 * 计算文件的 SHA-256 校验和
 */
function calculateChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * 获取所有迁移文件
 */
function getMigrationFiles(): Array<{ filename: string; path: string; checksum: string }> {
  const dbDir = resolve(process.cwd(), 'src/db')
  const files = readdirSync(dbDir)
    .filter(f => f.startsWith('migration_') && f.endsWith('.sql'))
    .sort()

  return files.map(filename => {
    const path = join(dbDir, filename)
    const content = readFileSync(path, 'utf-8')
    const checksum = calculateChecksum(content)
    return { filename, path, checksum }
  })
}

/**
 * 检查迁移是否已记录
 */
async function isMigrationRecorded(version: string, remote: boolean = false): Promise<boolean> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  
  try {
    const query = `SELECT version FROM schema_migrations WHERE version = '${version}'`
    const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    return output.includes(version)
  } catch {
    return false
  }
}

/**
 * 记录迁移（假设已执行）
 */
async function recordMigration(
  version: string,
  checksum: string,
  remote: boolean = false
): Promise<void> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  
  // 使用当前时间作为执行时间（因为不知道实际执行时间）
  const executedAt = Date.now()
  
  const query = `INSERT INTO schema_migrations (version, name, executed_at, checksum) VALUES ('${version}', '${version}', ${executedAt}, '${checksum}')`
  const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
  
  try {
    execSync(command, { encoding: 'utf-8' })
    console.log(`✓ 已记录: ${version}`)
  } catch (error) {
    console.error(`✗ 记录失败: ${version}`, error)
    throw error
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const remote = args.includes('--remote') || args.includes('-r')
  
  console.log(`迁移现有迁移记录到 schema_migrations 表 (${remote ? '远程' : '本地'}数据库)...\n`)
  console.log('警告: 此操作假设所有迁移文件都已在数据库中执行过')
  console.log('如果某些迁移未执行，请先执行 npm run migrate:up\n')
  
  // 确保迁移追踪表存在
  const migrationTableFile = resolve(process.cwd(), 'src/db/migration_add_schema_migrations_table.sql')
  try {
    const dbName = 'caiwu-db'
    const remoteFlag = remote ? '--remote' : ''
    execSync(`wrangler d1 execute ${dbName} ${remoteFlag} --file="${migrationTableFile}"`, {
      encoding: 'utf-8',
      stdio: 'inherit'
    })
    console.log('✓ 迁移追踪表已创建或已存在\n')
  } catch (error) {
    console.warn('警告: 创建迁移追踪表时出错，可能已存在:', error)
  }
  
  // 获取所有迁移文件
  const migrations = getMigrationFiles()
  console.log(`找到 ${migrations.length} 个迁移文件\n`)
  
  // 记录未记录的迁移
  let recordedCount = 0
  let skippedCount = 0
  
  for (const migration of migrations) {
    const recorded = await isMigrationRecorded(migration.filename, remote)
    
    if (recorded) {
      console.log(`- 跳过已记录的迁移: ${migration.filename}`)
      skippedCount++
    } else {
      await recordMigration(migration.filename, migration.checksum, remote)
      recordedCount++
    }
  }
  
  console.log(`\n完成: 记录了 ${recordedCount} 个迁移，跳过了 ${skippedCount} 个已记录的迁移`)
  console.log('\n提示: 之后请使用 npm run migrate:up 来执行新的迁移')
}

main().catch(error => {
  console.error('操作失败:', error)
  process.exit(1)
})

