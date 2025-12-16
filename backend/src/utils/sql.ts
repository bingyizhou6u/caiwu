/**
 * SQL工具函数
 * 用于构建动态SQL更新语句
 */

import type { D1Database } from '@cloudflare/workers-types'

/**
 * 构建动态更新SQL语句
 * @param tableName 表名
 * @param id 记录ID
 * @param updates 更新字段数组，格式: ['name=?', 'active=?']
 * @param binds 绑定值数组
 * @returns 更新后的SQL语句和绑定值
 */
export function buildUpdateSql(
  tableName: string,
  id: string,
  updates: string[],
  binds: any[]
): { sql: string; binds: any[] } {
  if (updates.length === 0) {
    throw new Error('No updates provided')
  }

  const finalBinds = [...binds, id]
  const sql = `update ${tableName} set ${updates.join(',')} where id=?`

  return { sql, binds: finalBinds }
}

/**
 * 构建动态更新字段
 * @param fieldMap 字段映射对象，key为字段名，value为值（undefined表示不更新）
 * @returns { updates: string[], binds: any[] } 更新字段数组和绑定值数组
 */
export function buildUpdateFields(fieldMap: Record<string, any>): {
  updates: string[]
  binds: any[]
} {
  const updates: string[] = []
  const binds: any[] = []

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      updates.push(`${key}=?`)
      binds.push(value)
    }
  }

  return { updates, binds }
}

/**
 * 执行动态更新
 * @param db 数据库实例
 * @param tableName 表名
 * @param id 记录ID
 * @param fieldMap 字段映射对象
 * @returns 执行结果
 */
export async function executeUpdate(
  db: D1Database,
  tableName: string,
  id: string,
  fieldMap: Record<string, any>
): Promise<void> {
  const { updates, binds } = buildUpdateFields(fieldMap)

  if (updates.length === 0) {
    throw new Error('No updates provided')
  }

  const { sql, binds: finalBinds } = buildUpdateSql(tableName, id, updates, binds)
  await db
    .prepare(sql)
    .bind(...finalBinds)
    .run()
}
