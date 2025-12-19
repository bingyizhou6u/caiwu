/**
 * 固定资产折旧服务
 * 处理资产的折旧计算和记录
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { fixedAssets, fixedAssetDepreciations } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types.js'

export class FixedAssetDepreciationService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * 创建折旧记录
   */
  async createDepreciation(
    id: string,
    data: {
      amountCents: number
      depreciationDate: string
      memo?: string
      createdBy?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    const asset = await query(
      this.db,
      'FixedAssetDepreciationService.createDepreciation.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND('asset')
    }

    const existingDep = await this.db
      .select({
        total: sql<number>`coalesce(sum(${fixedAssetDepreciations.depreciationAmountCents}), 0)`,
      })
      .from(fixedAssetDepreciations)
      .where(eq(fixedAssetDepreciations.assetId, id))
      .get()

    const accumulatedDepreciation = (existingDep?.total || 0) + data.amountCents
    const remainingValue = Number(asset.purchasePriceCents) - accumulatedDepreciation

    if (remainingValue < 0) {
      throw Errors.BUSINESS_ERROR('折旧金额超过购买价格')
    }

    const depId = uuid()
    const now = Date.now()

    await this.db.transaction(async tx => {
      await tx
        .insert(fixedAssetDepreciations)
        .values({
          id: depId,
          assetId: id,
          depreciationDate: data.depreciationDate,
          depreciationAmountCents: data.amountCents,
          accumulatedDepreciationCents: accumulatedDepreciation,
          remainingValueCents: remainingValue,
          memo: data.memo,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()

      await tx
        .update(fixedAssets)
        .set({ currentValueCents: remainingValue, updatedAt: now })
        .where(eq(fixedAssets.id, id))
        .run()
    })

    return { id: depId }
  }
}

