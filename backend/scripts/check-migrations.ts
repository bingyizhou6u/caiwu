/**
 * 数据库迁移检查工具
 * 
 * 检查迁移状态，显示已执行和未执行的迁移
 * 
 * 使用方法：
 *   npm run migrate:check          # 本地数据库
 *   npm run migrate:check:remote   # 远程数据库
 */

import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'
import { execSync } from 'child_process'

interface MigrationStatus {
  filename: string
  executed: boolean
  executedAt?: number
  checksum?: string
  fileChecksum: string
  status: 'pending' | 'executed' | 'modified'
}

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
 * 获取已执行的迁移记录
 */
async function getExecutedMigrations(remote: boolean = false): Promise<Map<string, { executedAt: number; checksum: string }>> {
  const dbName = 'caiwu-db'
  const remoteFlag = remote ? '--remote' : ''
  
  try {
    const query = `SELECT version, executed_at, checksum FROM schema_migrations`
    const command = `wrangler d1 execute ${dbName} ${remoteFlag} --command "${query}"`
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    const migrations = new Map<string, { executedAt: number; checksum: string }>()
    
    // 解析输出（wrangler 输出格式可能不同，这里简化处理）
    // 实际使用时可能需要更复杂的解析逻辑
    const lines = output.split('\n').filter(line => line.trim())
    
    // 如果输出包含 JSON，尝试解析
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (Array.isArray(data)) {
          data.forEach((row: any) => {
            if (row.version) {
              migrations.set(row.version, {
                executedAt: row.executed_at || 0,
                checksum: row.checksum || ''
              })
            }
          })
        }
      }
    } catch {
      // 如果不是 JSON，尝试其他解析方式
      // 这里简化处理，实际可能需要根据 wrangler 的实际输出格式调整
    }
    
    return migrations
  } catch (error) {
    // 如果表不存在，返回空 Map
    return new Map()
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const remote = args.includes('--remote') || args.includes('-r')
  
  console.log(`检查迁移状态 (${remote ? '远程' : '本地'}数据库)...\n`)
  
  // 获取所有迁移文件
  const files = getMigrationFiles()
  
  // 获取已执行的迁移
  const executedMigrations = await getExecutedMigrations(remote)
  
  // 检查每个迁移的状态
  const statuses: MigrationStatus[] = files.map(file => {
    const executed = executedMigrations.has(file.filename)
    const executedRecord = executedMigrations.get(file.filename)
    
    let status: 'pending' | 'executed' | 'modified' = 'pending'
    if (executed) {
      if (executedRecord?.checksum === file.checksum) {
        status = 'executed'
      } else {
        status = 'modified'
      }
    }
    
    return {
      filename: file.filename,
      executed,
      executedAt: executedRecord?.executedAt,
      checksum: executedRecord?.checksum,
      fileChecksum: file.checksum,
      status
    }
  })
  
  // 显示结果
  console.log('迁移状态:')
  console.log('─'.repeat(80))
  
  const pending = statuses.filter(s => s.status === 'pending')
  const executed = statuses.filter(s => s.status === 'executed')
  const modified = statuses.filter(s => s.status === 'modified')
  
  if (executed.length > 0) {
    console.log(`\n✓ 已执行 (${executed.length}):`)
    executed.forEach(s => {
      const date = s.executedAt ? new Date(s.executedAt).toISOString() : 'unknown'
      console.log(`  ${s.filename} (${date})`)
    })
  }
  
  if (pending.length > 0) {
    console.log(`\n○ 待执行 (${pending.length}):`)
    pending.forEach(s => {
      console.log(`  ${s.filename}`)
    })
  }
  
  if (modified.length > 0) {
    console.log(`\n⚠ 已修改 (${modified.length}):`)
    modified.forEach(s => {
      console.log(`  ${s.filename} (文件内容已更改，可能需要重新执行)`)
    })
  }
  
  console.log('\n' + '─'.repeat(80))
  console.log(`总计: ${statuses.length} 个迁移文件`)
  console.log(`  已执行: ${executed.length}`)
  console.log(`  待执行: ${pending.length}`)
  if (modified.length > 0) {
    console.log(`  已修改: ${modified.length}`)
  }
}

main().catch(error => {
  console.error('检查失败:', error)
  process.exit(1)
})

