/**
 * 固定资产变更记录服务
 * 处理资产的转移和变更记录
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { fixedAssets, fixedAssetChanges } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class FixedAssetChangeService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * 转移资产
   */
  async transfer(
    id: string,
    data: {
      transferDate: string
      toDepartmentId?: string
      toSiteId?: string
      toCustodian?: string
      memo?: string
      createdBy?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    if (!data.toDepartmentId && !data.toSiteId && !data.toCustodian) {
      throw Errors.VALIDATION_ERROR(
        'transfer_date and at least one of to_department_id, to_site_id, to_custodian参数必填'
      )
    }

    const asset = await query(
      this.db,
      'FixedAssetChangeService.transfer.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND('asset')
    }

    const changeId = uuid()
    const now = Date.now()

    await this.db.transaction(async tx => {
      await tx
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId: id,
          changeType: 'transfer',
          changeDate: data.transferDate,
          fromDeptId: asset.departmentId,
          toDeptId: data.toDepartmentId,
          fromSiteId: asset.siteId,
          toSiteId: data.toSiteId,
          fromCustodian: asset.custodian,
          toCustodian: data.toCustodian,
          memo: data.memo,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()

      const updates: any = { updatedAt: now }
      if (data.toDepartmentId !== undefined) {
        updates.departmentId = data.toDepartmentId
      }
      if (data.toSiteId !== undefined) {
        updates.siteId = data.toSiteId
      }
      if (data.toCustodian !== undefined) {
        updates.custodian = data.toCustodian
      }

      await tx.update(fixedAssets).set(updates).where(eq(fixedAssets.id, id)).run()
    })

    return { ok: true }
  }

  /**
   * 记录资产变更
   */
  async recordChange(
    assetId: string,
    data: {
      changeType: string
      changeDate: string
      fromDeptId?: string | null
      toDeptId?: string | null
      fromSiteId?: string | null
      toSiteId?: string | null
      fromCustodian?: string | null
      toCustodian?: string | null
      fromStatus?: string | null
      toStatus?: string | null
      memo?: string
      createdBy?: string
    }
  ) {
    const changeId = uuid()
    const now = Date.now()

    await this.db.insert(fixedAssetChanges).values({
      id: changeId,
      assetId,
      ...data,
      createdAt: now,
    })

    return { id: changeId }
  }
}

