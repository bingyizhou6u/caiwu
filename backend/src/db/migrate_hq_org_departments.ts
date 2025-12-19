/**
 * 迁移脚本：将总部的组织部门从 projectId IS NULL 改为使用总部的 department ID
 * 
 * 执行方式：
 * npx tsx src/db/migrate_hq_org_departments.ts
 */

import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema.js'
import { orgDepartments } from './schema.js'
import { isNull } from 'drizzle-orm'
import { ProjectDepartmentService } from '../services/system/ProjectDepartmentService.js'

async function migrate() {
  // 注意：此脚本需要在 Cloudflare Workers 环境中运行，需要 D1 数据库实例
  // 实际使用时应该通过 wrangler 执行或集成到迁移系统中

  console.log('开始迁移：将总部的组织部门从 projectId IS NULL 改为使用总部的 department ID')

  // 这里需要实际的 D1 数据库实例
  // const db = drizzle(env.DB, { schema })
  // const projectDepartmentService = new ProjectDepartmentService(db)

  // const hqDeptId = await projectDepartmentService.getOrCreateHQDepartmentId()
  // console.log(`总部 department ID: ${hqDeptId}`)

  // const result = await db
  //   .update(orgDepartments)
  //   .set({ projectId: hqDeptId })
  //   .where(isNull(orgDepartments.projectId))
  //   .execute()

  // console.log(`已更新 ${result.changes} 条记录`)
  // console.log('迁移完成')

  console.log('请通过应用代码执行迁移，或使用 wrangler d1 execute 执行 SQL 文件')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(console.error)
}
