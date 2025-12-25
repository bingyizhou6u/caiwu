/**
 * 固定资产分配管理服务
 * 处理资产的分配和归还
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  fixedAssets,
  fixedAssetAllocations,
  fixedAssetChanges,
  departments,
  employees,
} from '../../db/schema.js'
import { eq, and, desc, sql, inArray, isNull, isNotNull } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { QueryBuilder } from '../../utils/query-builder.js'
import { query, getByIds } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class FixedAssetAllocationService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  /**
   * 列出资产分配记录
   */
  async listAllocations(query: { assetId?: string; employeeId?: string; returned?: boolean }) {
    const conditions = []
    if (query.assetId) {
      conditions.push(eq(fixedAssetAllocations.assetId, query.assetId))
    }
    if (query.employeeId) {
      conditions.push(eq(fixedAssetAllocations.employeeId, query.employeeId))
    }
    if (query.returned === true) {
      conditions.push(isNotNull(fixedAssetAllocations.returnDate))
    }
    if (query.returned === false) {
      conditions.push(isNull(fixedAssetAllocations.returnDate))
    }

    const allocations = await this.db
      .select()
      .from(fixedAssetAllocations)
      .where(and(...conditions))
      .orderBy(desc(fixedAssetAllocations.allocationDate), desc(fixedAssetAllocations.createdAt))
      .execute()

    // 提取关联ID
    const assetIds = new Set(allocations.map(a => a.assetId))
    const employeeIds = new Set<string>()
    allocations.forEach(a => {
      employeeIds.add(a.employeeId)
      if (a.createdBy) employeeIds.add(a.createdBy)
    })

    // 批量获取关联数据 - 使用批量查询优化
    const [assetsList, relatedData] = await Promise.all([
      assetIds.size > 0
        ? getByIds<typeof fixedAssets.$inferSelect>(
          this.db,
          fixedAssets,
          Array.from(assetIds),
          'FixedAssetAllocationService.list.getAssets',
          { batchSize: 100, parallel: true },
          undefined
        )
        : [],
      QueryBuilder.fetchRelatedData(this.db, {
        employeeIds: Array.from(employeeIds),
      }),
    ])

    const assetMap = QueryBuilder.createMaps(assetsList)
    const empMap = QueryBuilder.createMaps(relatedData.employees)
    const userMap = QueryBuilder.createMaps(relatedData.employees) // createdBy 也是员工

    // 获取员工的部门 - 使用批量查询优化
    const deptIds = new Set(
      relatedData.employees.map(e => e.departmentId).filter(Boolean) as string[]
    )
    const depts =
      deptIds.size > 0
        ? await getByIds<typeof departments.$inferSelect>(
          this.db,
          departments,
          Array.from(deptIds),
          'FixedAssetAllocationService.list.getDepartments',
          { batchSize: 100, parallel: true },
          undefined
        )
        : []
    const deptMap = QueryBuilder.createMaps(depts)

    return allocations.map(allocation => {
      const asset = assetMap.get(allocation.assetId)
      const employee = empMap.get(allocation.employeeId)
      const dept = employee?.departmentId ? deptMap.get(employee.departmentId) : null
      return {
        allocation,
        assetCode: asset?.assetCode || null,
        assetName: asset?.name || null,
        employeeName: employee?.name || null,
        employeeDepartmentId: employee?.departmentId || null,
        employeeDepartmentName: dept?.name || null,
        createdByName: allocation.createdBy
          ? userMap.get(allocation.createdBy)?.email || null
          : null,
      }
    })
  }

  /**
   * 分配资产给员工
   */
  async allocate(
    id: string,
    data: {
      employeeId: string
      allocationDate: string
      allocationType?: string
      expectedReturnDate?: string
      memo?: string
      createdBy?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    const asset = await query(
      this.db,
      'FixedAssetAllocationService.allocate.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND('asset')
    }

    if (asset.status !== 'in_use' && asset.status !== 'idle') {
      throw Errors.BUSINESS_ERROR('只能分配使用中或闲置的资产')
    }

    const employee = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, data.employeeId))
      .get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }
    if (employee.active === 0) {
      throw Errors.BUSINESS_ERROR('员工已停用')
    }

    const existingAllocation = await this.db
      .select()
      .from(fixedAssetAllocations)
      .where(
        and(eq(fixedAssetAllocations.assetId, id), isNull(fixedAssetAllocations.returnDate))
      )
      .get()

    if (existingAllocation) {
      throw Errors.BUSINESS_ERROR('资产已分配且未归还')
    }

    const allocationId = uuid()
    const changeId = uuid()
    const now = Date.now()
    const memo = data.memo
      ? data.memo + (data.expectedReturnDate ? ` (预计归还：${data.expectedReturnDate})` : '')
      : data.expectedReturnDate
        ? `预计归还：${data.expectedReturnDate}`
        : undefined

    await this.db.transaction(async tx => {
      await tx
        .insert(fixedAssetAllocations)
        .values({
          id: allocationId,
          assetId: id,
          employeeId: data.employeeId,
          allocationDate: data.allocationDate,
          allocationType: data.allocationType || 'employee_onboarding',
          memo: memo,
          createdBy: data.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      await tx
        .update(fixedAssets)
        .set({
          status: 'in_use',
          custodian: employee.name,
          departmentId: employee.departmentId || asset.departmentId,
          updatedAt: now,
        })
        .where(eq(fixedAssets.id, id))
        .run()

      await tx
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId: id,
          changeType: 'allocation',
          changeDate: data.allocationDate,
          fromCustodian: asset.custodian,
          toCustodian: employee.name,
          fromStatus: asset.status,
          toStatus: 'in_use',
          memo: `分配给员工：${employee.name}（${data.allocationType === 'employee_onboarding' ? '员工入职' : data.allocationType === 'transfer' ? '调拨' : '临时借用'}）`,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()
    })

    return { id: allocationId }
  }

  /**
   * 归还资产
   */
  async return(
    id: string,
    data: {
      returnDate: string
      returnType?: string
      memo?: string
      createdBy?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    const asset = await query(
      this.db,
      'FixedAssetAllocationService.return.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND('asset')
    }

    const allocation = await this.db
      .select()
      .from(fixedAssetAllocations)
      .where(
        and(eq(fixedAssetAllocations.assetId, id), isNull(fixedAssetAllocations.returnDate))
      )
      .get()

    if (!allocation) {
      throw Errors.BUSINESS_ERROR('资产未分配或已归还')
    }

    const changeId = uuid()
    const now = Date.now()

    await this.db.transaction(async tx => {
      await tx
        .update(fixedAssetAllocations)
        .set({
          returnDate: data.returnDate,
          returnType: data.returnType || 'employee_resignation',
          memo: data.memo
            ? allocation.memo
              ? allocation.memo + '; ' + data.memo
              : data.memo
            : allocation.memo,
          updatedAt: now,
        })
        .where(eq(fixedAssetAllocations.id, allocation.id))
        .run()

      await tx
        .update(fixedAssets)
        .set({
          status: 'idle',
          custodian: null,
          updatedAt: now,
        })
        .where(eq(fixedAssets.id, id))
        .run()

      await tx
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId: id,
          changeType: 'return',
          changeDate: data.returnDate,
          fromCustodian: asset.custodian,
          toCustodian: null,
          fromStatus: asset.status,
          toStatus: 'idle',
          memo: `员工归还（${data.returnType === 'employee_resignation' ? '员工离职' : '其他'}）`,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()
    })

    return { ok: true }
  }
}

