/**
 * 供应商管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { vendors } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'

export class VendorService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getVendors() {
    return this.db.select().from(vendors).where(eq(vendors.active, 1)).orderBy(vendors.name).all()
  }

  async getVendor(id: string) {
    const vendor = await this.db.query.vendors.findFirst({ where: eq(vendors.id, id) })
    if (!vendor) {
      throw Errors.NOT_FOUND('供应商不存在')
    }
    return vendor
  }

  async createVendor(data: {
    name: string
    contact?: string
    phone?: string
    email?: string
    address?: string
    memo?: string
  }) {
    const id = uuid()
    const now = Date.now()
    const vendor = {
      id,
      name: data.name,
      contact: data.contact,
      phone: data.phone,
      email: data.email,
      address: data.address,
      memo: data.memo,
      active: 1,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.insert(vendors).values(vendor).execute()
    return vendor
  }

  async updateVendor(
    id: string,
    data: {
      name?: string
      contact?: string
      phone?: string
      email?: string
      address?: string
      memo?: string
      active?: number
    }
  ) {
    const updates: any = { updatedAt: Date.now() }
    if (data.name !== undefined) {updates.name = data.name}
    if (data.contact !== undefined) {updates.contact = data.contact}
    if (data.phone !== undefined) {updates.phone = data.phone}
    if (data.email !== undefined) {updates.email = data.email}
    if (data.address !== undefined) {updates.address = data.address}
    if (data.memo !== undefined) {updates.memo = data.memo}
    if (data.active !== undefined) {updates.active = data.active}

    if (Object.keys(updates).length === 1) {return { ok: true }} // 仅更新了 updatedAt

    await this.db.update(vendors).set(updates).where(eq(vendors.id, id)).execute()
    return { ok: true }
  }

  async deleteVendor(id: string) {
    const vendor = await this.db.query.vendors.findFirst({ where: eq(vendors.id, id) })
    await this.db
      .update(vendors)
      .set({
        active: 0,
        updatedAt: Date.now(),
      })
      .where(eq(vendors.id, id))
      .execute()
    return { ok: true, name: vendor?.name }
  }
}

