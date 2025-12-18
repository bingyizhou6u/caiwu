/**
 * 迁移脚本：将总部的组织部门从 projectId IS NULL 改为使用总部的 department ID
 * 
 * 执行方式：
 * npx tsx scripts/migrate-hq-org-departments.ts
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const isRemote = process.argv.includes('--remote')

async function migrate() {
  console.log('开始迁移：将总部的组织部门从 projectId IS NULL 改为使用总部的 department ID')
  console.log(`环境: ${isRemote ? '生产环境 (remote)' : '本地环境 (local)'}`)
  
  try {
    // 1. 检查是否有 project_id IS NULL 的记录
    console.log('\n1. 检查需要迁移的记录...')
    const checkCmd = `npx wrangler d1 execute caiwu-db ${isRemote ? '--remote' : '--local'} --command "SELECT COUNT(*) as count FROM org_departments WHERE project_id IS NULL"`
    const checkResult = execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' })
    const checkMatch = checkResult.match(/"count":\s*(\d+)/)
    const count = checkMatch ? parseInt(checkMatch[1]) : 0
    
    if (count === 0) {
      console.log('✓ 没有需要迁移的记录，迁移已完成')
      return
    }
    
    console.log(`发现 ${count} 条需要迁移的记录`)
    
    // 2. 检查是否存在总部部门
    console.log('\n2. 检查总部部门...')
    const hqCheckCmd = `npx wrangler d1 execute caiwu-db ${isRemote ? '--remote' : '--local'} --command "SELECT id, name FROM departments WHERE name = '总部' LIMIT 1"`
    const hqCheckResult = execSync(hqCheckCmd, { encoding: 'utf-8', stdio: 'pipe' })
    const hqMatch = hqCheckResult.match(/"id":\s*"([^"]+)"/)
    
    if (!hqMatch) {
      console.log('⚠ 警告: 未找到总部部门，迁移脚本将无法执行')
      console.log('请先确保总部部门存在，或通过应用代码自动创建')
      return
    }
    
    const hqDeptId = hqMatch[1]
    console.log(`✓ 找到总部部门 ID: ${hqDeptId}`)
    
    // 3. 执行迁移 SQL
    console.log('\n3. 执行迁移...')
    const migrationFile = join(process.cwd(), 'src/db/migration_update_hq_org_departments.sql')
    const migrationSQL = readFileSync(migrationFile, 'utf-8')
    
    // 执行迁移
    const migrateCmd = `npx wrangler d1 execute caiwu-db ${isRemote ? '--remote' : '--local'} --file ${migrationFile}`
    execSync(migrateCmd, { encoding: 'utf-8', stdio: 'inherit' })
    
    // 4. 验证迁移结果
    console.log('\n4. 验证迁移结果...')
    const verifyCmd = `npx wrangler d1 execute caiwu-db ${isRemote ? '--remote' : '--local'} --command "SELECT COUNT(*) as count FROM org_departments WHERE project_id IS NULL"`
    const verifyResult = execSync(verifyCmd, { encoding: 'utf-8', stdio: 'pipe' })
    const verifyMatch = verifyResult.match(/"count":\s*(\d+)/)
    const remainingCount = verifyMatch ? parseInt(verifyMatch[1]) : 0
    
    if (remainingCount === 0) {
      console.log('✓ 迁移成功！所有记录已更新')
    } else {
      console.log(`⚠ 警告: 仍有 ${remainingCount} 条记录未迁移`)
    }
    
    console.log('\n迁移完成！')
  } catch (error: any) {
    console.error('迁移失败:', error.message)
    process.exit(1)
  }
}

migrate().catch(console.error)
