/**
 * 站点管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { sites, projects } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'

export class SiteService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async getSites() {
    const [sitesList, projectsList] = await Promise.all([
      this.db.select().from(sites).orderBy(sites.name).all(),
      this.db.select().from(projects).all(),
    ])

    const deptMap = new Map(projectsList.map(d => [d.id, d.name]))

    return sitesList.map(site => ({
      id: site.id,
      projectId: site.projectId,
      name: site.name,
      siteCode: site.siteCode,
      active: site.active,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      projectName: deptMap.get(site.projectId) || null,
    }))
  }

  async createSite(data: { name: string; projectId: string }) {
    const existing = await this.db.query.sites.findFirst({
      where: and(
        eq(sites.projectId, data.projectId),
        eq(sites.name, data.name),
        eq(sites.active, 1)
      ),
    })
    if (existing) {
      throw Errors.DUPLICATE('站点名称')
    }

    const id = uuid()
    await this.db
      .insert(sites)
      .values({
        id,
        projectId: data.projectId,
        name: data.name,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    return { id, ...data }
  }

  async updateSite(id: string, data: { name?: string; projectId?: string; active?: number }) {
    const site = await this.db.query.sites.findFirst({ where: eq(sites.id, id) })
    if (!site) {
      throw Errors.NOT_FOUND('站点')
    }

    const updates: any = { updatedAt: Date.now() }
    if (data.name !== undefined) { updates.name = data.name }
    if (data.projectId !== undefined) { updates.projectId = data.projectId }
    if (data.active !== undefined) { updates.active = data.active }

    await this.db.update(sites).set(updates).where(eq(sites.id, id)).execute()
    return { ok: true }
  }

  async deleteSite(id: string) {
    const site = await this.db.query.sites.findFirst({ where: eq(sites.id, id) })
    if (!site) {
      throw Errors.NOT_FOUND('站点')
    }

    // 检查是否有关联的流水记录
    const flowCount = await this.db.$count(schema.cashFlows, eq(schema.cashFlows.siteId, id))
    if (flowCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该站点还有流水记录')
    }

    await this.db.delete(sites).where(eq(sites.id, id)).execute()
    return { ok: true, name: site.name }
  }
}

