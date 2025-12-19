/**
 * 总部管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { headquarters } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { Errors } from '../../utils/errors.js'

export class HeadquartersService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getHeadquarters() {
    return this.db.select().from(headquarters).all()
  }

  async updateHeadquarters(id: string, data: { name?: string; active?: number }) {
    const hq = await this.db.query.headquarters.findFirst({ where: eq(headquarters.id, id) })
    if (!hq) {
      throw Errors.NOT_FOUND('总部')
    }

    const updates: any = {}
    if (data.name !== undefined) {updates.name = data.name}
    if (data.active !== undefined) {updates.active = data.active}

    if (Object.keys(updates).length === 0) {return { ok: true }}

    await this.db.update(headquarters).set(updates).where(eq(headquarters.id, id)).execute()
    return { ok: true }
  }

  async deleteHeadquarters(id: string) {
    const hq = await this.db.query.headquarters.findFirst({ where: eq(headquarters.id, id) })
    if (!hq) {
      throw Errors.NOT_FOUND('总部')
    }

    await this.db.update(headquarters).set({ active: 0 }).where(eq(headquarters.id, id)).execute()
    return { ok: true, name: hq.name }
  }
}

