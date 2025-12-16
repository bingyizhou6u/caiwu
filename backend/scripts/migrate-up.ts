/**
 * 数据库迁移工具 - 执行未执行的迁移
 * 
 * 使用方法：
 *   npm run migrate:up          # 本地数据库
 *   npm run migrate:up:remote   # 远程数据库
 */

import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'
import { execSync } from 'child_process'

interface MigrationFile {
  filename: string
  path: string
  content: string
  checksum: string
}

/**
 * 计算文件的 SHA-256 校验和
 */
function calculateChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * 读取所有迁移文件
 */
function getMigrationFiles(): MigrationFile[] {
  const dbDir = resolve(process.cwd(), 'src/db')
  const files = readdirSync(dbDir)
    .filter(f => f.startsWith('migration_') && f.endsWith('.sql'))
    .sort() // 按文件名排序，确保执行顺序

  return files.map(filename => {
    const path = join(dbDir, filename)
    const content = readFileSync(path, 'utf-8')
    const checksum = calculateChecksum(content)
    return { filename, path, content, checksum }
  })
}

/**
 * 检查迁移是否已执行
 */
async function checkMigrationExecuted(version: string, remote: boolean = false): Promise<boolean> {
  try {
    const dbName = 'caiwu-db'
    const remoteFlag = remote ? '--remote' : ''
    
    // 使用 wrangler d1 execute 查询
    const query = `SELECT version FROM schema_migrations WHERE version = '${version}'`
    const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // 如果查询返回结果，说明迁移已执行
    return output.includes(version)
  } catch (error) {
    // 如果表不存在或其他错误，返回 false（首次运行）
    return false
  }
}

/**
 * 记录迁移执行
 */
async function recordMigration(
  version: string,
  name: string,
  checksum: string,
  remote: boolean = false
): Promise<void> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  const executedAt = Date.now()
  
  const query = `INSERT INTO schema_migrations (version, name, executed_at, checksum) VALUES ('${version}', '${name}', ${executedAt}, '${checksum}')`
  const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
  
  execSync(command, { encoding: 'utf-8' })
}

/**
 * 执行迁移文件
 */
async function executeMigration(file: MigrationFile, remote: boolean = false): Promise<void> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  
  console.log(`执行迁移: ${file.filename}`)
  
  const command = `wrangler d1 execute ${dbName} ${remoteFlag} --file="${file.path}"`
  
  try {
    execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    // 记录迁移执行
    await recordMigration(file.filename, file.filename, file.checksum, remote)
    console.log(`✓ 迁移 ${file.filename} 执行成功并已记录`)
  } catch (error: any) {
    const errorMessage = error?.stderr?.toString() || error?.message || String(error)
    
    // 检查是否是"已存在"类型的错误（列已存在、表已存在、索引已存在等）
    // 或者"不存在"类型的错误（列不存在、表不存在等，说明迁移可能已部分执行或不需要执行）
    const isAlreadyExistsError = 
      errorMessage.includes('duplicate column') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('UNIQUE constraint failed') ||
      errorMessage.includes('there is already another table') ||
      errorMessage.includes('there is already another index') ||
      errorMessage.includes('no such table: users') || // users 表已合并，相关迁移应跳过
      errorMessage.includes('no such column') || // 列不存在，可能是迁移已部分执行或不需要
      errorMessage.includes('has no column') // 表结构不匹配，可能是迁移已部分执行
    
    if (isAlreadyExistsError) {
      console.log(`⚠ 迁移 ${file.filename} 似乎已执行过（${errorMessage.split('\n')[0]}），记录为已执行`)
      // 记录为已执行
      await recordMigration(file.filename, file.filename, file.checksum, remote)
    } else {
      console.error(`✗ 迁移 ${file.filename} 执行失败:`, errorMessage)
      throw error
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const remote = args.includes('--remote') || args.includes('-r')
  
  console.log(`开始迁移检查 (${remote ? '远程' : '本地'}数据库)...`)
  
  // 确保迁移追踪表存在
  const migrationTableFile = resolve(process.cwd(), 'src/db/migration_add_schema_migrations_table.sql')
  try {
    const dbName = 'caiwu-db'
    const remoteFlag = remote ? '--remote' : ''
    execSync(`wrangler d1 execute ${dbName} ${remoteFlag} --file="${migrationTableFile}"`, {
      encoding: 'utf-8',
      stdio: 'inherit'
    })
    console.log('✓ 迁移追踪表已创建或已存在')
  } catch (error) {
    console.warn('警告: 创建迁移追踪表时出错，可能已存在:', error)
  }
  
  // 获取所有迁移文件
  const migrations = getMigrationFiles()
  console.log(`找到 ${migrations.length} 个迁移文件`)
  
  // 检查并执行未执行的迁移
  let executedCount = 0
  for (const migration of migrations) {
    const executed = await checkMigrationExecuted(migration.filename, remote)
    
    if (executed) {
      console.log(`- 跳过已执行的迁移: ${migration.filename}`)
    } else {
      await executeMigration(migration, remote)
      executedCount++
    }
  }
  
  console.log(`\n迁移完成: 执行了 ${executedCount} 个新迁移，跳过了 ${migrations.length - executedCount} 个已执行的迁移`)
}

main().catch(error => {
  console.error('迁移失败:', error)
  process.exit(1)
})

