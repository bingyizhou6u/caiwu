/**
 * 数据库查询构建器
 */

import type { D1Database } from '@cloudflare/workers-types'

export class QueryBuilder {
  private table: string
  private alias?: string
  private selects: string[] = []
  private joins: string[] = []
  private conditions: string[] = []
  private binds: any[] = []
  private orderBy: string[] = []
  private groupBy: string[] = []
  private havingConditions: string[] = []
  private limitValue?: number
  private offsetValue?: number

  constructor(table: string, alias?: string) {
    this.table = table
    this.alias = alias
  }

  static from(table: string, alias?: string) {
    return new QueryBuilder(table, alias)
  }

  select(fields: string | string[]) {
    if (Array.isArray(fields)) {
      this.selects.push(...fields)
    } else {
      this.selects.push(fields)
    }
    return this
  }

  leftJoin(table: string, condition: string, alias?: string) {
    const joinAlias = alias || table
    this.joins.push(`left join ${table} ${joinAlias} on ${condition}`)
    return this
  }

  innerJoin(table: string, condition: string, alias?: string) {
    const joinAlias = alias || table
    this.joins.push(`inner join ${table} ${joinAlias} on ${condition}`)
    return this
  }

  where(field: string, value: any, operator: string = '=') {
    this.conditions.push(`${field} ${operator} ?`)
    this.binds.push(value)
    return this
  }

  whereIn(field: string, values: any[]) {
    if (values.length === 0) {
      this.conditions.push('1=0') // 空数组时返回空结果
      return this
    }
    const placeholders = values.map(() => '?').join(',')
    this.conditions.push(`${field} in (${placeholders})`)
    this.binds.push(...values)
    return this
  }

  whereNotIn(field: string, values: any[]) {
    if (values.length === 0) {
      return this
    }
    const placeholders = values.map(() => '?').join(',')
    this.conditions.push(`${field} not in (${placeholders})`)
    this.binds.push(...values)
    return this
  }

  whereNull(field: string) {
    this.conditions.push(`${field} is null`)
    return this
  }

  whereNotNull(field: string) {
    this.conditions.push(`${field} is not null`)
    return this
  }

  whereLike(field: string, pattern: string) {
    this.conditions.push(`${field} like ?`)
    this.binds.push(`%${pattern}%`)
    return this
  }

  orderByField(field: string, direction: 'ASC' | 'DESC' = 'ASC') {
    this.orderBy.push(`${field} ${direction}`)
    return this
  }

  groupByField(field: string | string[]) {
    if (Array.isArray(field)) {
      this.groupBy.push(...field)
    } else {
      this.groupBy.push(field)
    }
    return this
  }

  having(condition: string, value?: any) {
    this.havingConditions.push(condition)
    if (value !== undefined) {
      this.binds.push(value)
    }
    return this
  }

  limit(count: number) {
    this.limitValue = count
    return this
  }

  offset(count: number) {
    this.offsetValue = count
    return this
  }

  build(): { sql: string; binds: any[] } {
    const tableName = this.alias ? `${this.table} ${this.alias}` : this.table
    const selects = this.selects.length > 0 ? this.selects.join(', ') : '*'
    
    const parts: string[] = [
      `select ${selects}`,
      `from ${tableName}`,
      ...this.joins,
      this.conditions.length > 0 ? `where ${this.conditions.join(' and ')}` : '',
      this.groupBy.length > 0 ? `group by ${this.groupBy.join(', ')}` : '',
      this.havingConditions.length > 0 ? `having ${this.havingConditions.join(' and ')}` : '',
      this.orderBy.length > 0 ? `order by ${this.orderBy.join(', ')}` : '',
      this.limitValue ? `limit ${this.limitValue}` : '',
      this.offsetValue ? `offset ${this.offsetValue}` : '',
    ]
    
    const sql = parts.filter(Boolean).join(' ')
    return { sql, binds: this.binds }
  }

  /**
   * 执行查询并返回结果
   */
  async execute(db: D1Database): Promise<any[]> {
    const { sql, binds } = this.build()
    const result = await db.prepare(sql).bind(...binds).all()
    return result.results ?? []
  }

  /**
   * 执行查询并返回第一条记录
   */
  async first<T = any>(db: D1Database): Promise<T | null> {
    const { sql, binds } = this.build()
    const result = await db.prepare(sql).bind(...binds).first<T>()
    return result ?? null
  }

  /**
   * 执行查询并返回计数
   */
  async count(db: D1Database): Promise<number> {
    const countQuery = new QueryBuilder(this.table, this.alias)
    countQuery.conditions = [...this.conditions]
    countQuery.binds = [...this.binds]
    countQuery.joins = [...this.joins]
    
    const { sql, binds } = countQuery.select(['count(1) as cnt']).build()
    const result = await db.prepare(sql).bind(...binds).first<{ cnt: number }>()
    return result?.cnt ?? 0
  }
}

