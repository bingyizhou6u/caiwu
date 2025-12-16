/**
 * 分类管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { categories, cashFlows } from '../db/schema.js'
import { eq, and, ne } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'

export class CategoryService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getCategories() {
    return this.db.select().from(categories).orderBy(categories.kind, categories.name).all()
  }

  async createCategory(data: { name: string; kind: string; parentId?: string }) {
    const existing = await this.db.query.categories.findFirst({
      where: eq(categories.name, data.name),
    })
    if (existing) {throw Errors.DUPLICATE('类别名称')}

    const id = uuid()
    await this.db
      .insert(categories)
      .values({
        id,
        name: data.name,
        kind: data.kind as any,
        parentId: data.parentId,
        active: 1,
      })
      .execute()

    return { id, ...data }
  }

  async updateCategory(id: string, data: { name?: string; kind?: string }) {
    if (data.name) {
      const existing = await this.db.query.categories.findFirst({
        where: and(eq(categories.name, data.name), ne(categories.id, id)),
      })
      if (existing) {throw Errors.DUPLICATE('类别名称')}
    }

    const updates: any = {}
    if (data.name !== undefined) {updates.name = data.name}
    if (data.kind !== undefined) {updates.kind = data.kind}

    if (Object.keys(updates).length === 0) {return { ok: true }}

    await this.db.update(categories).set(updates).where(eq(categories.id, id)).execute()
    return { ok: true }
  }

  async deleteCategory(id: string) {
    const category = await this.db.query.categories.findFirst({ where: eq(categories.id, id) })
    if (!category) {throw Errors.NOT_FOUND('类别')}

    const flowCount = await this.db.$count(cashFlows, eq(cashFlows.categoryId, id))
    if (flowCount > 0) {throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')}

    await this.db.delete(categories).where(eq(categories.id, id)).execute()
    return { ok: true, name: category.name }
  }
}

