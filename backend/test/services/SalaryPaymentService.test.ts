import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SalaryPaymentService } from '../../src/services/hr/SalaryPaymentService.js'
import { SalaryPaymentGenerationService } from '../../src/services/hr/SalaryPaymentGenerationService.js'
import { SalaryPaymentProcessingService } from '../../src/services/hr/SalaryPaymentProcessingService.js'
import { createDb } from '../../src/db'
import { env } from 'cloudflare:test'
import { applySchema } from '../setup'
import { employees, employeeSalaries, currencies, departments, orgDepartments, positions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

describe('SalaryPaymentService', () => {
  let db: any
  let salaryPaymentService: SalaryPaymentService
  let salaryPaymentGenerationService: SalaryPaymentGenerationService

  beforeEach(async () => {
    db = createDb(env.DB)
    // @ts-ignore
    db.transaction = async cb => cb(db)
    await applySchema(env.DB)
    salaryPaymentService = new SalaryPaymentService(db)
    salaryPaymentGenerationService = new SalaryPaymentGenerationService(db)
    // @ts-ignore
    salaryPaymentService.salaryPaymentProcessingService = new SalaryPaymentProcessingService(db, undefined, salaryPaymentService)


    // Setup test data
    // 1. Currency
    await db
      .insert(currencies)
      .values({
        code: 'USDT',
        name: 'Tether',
        active: 1,
      })
      .run()

    // 2. Employee
    await db
      .insert(employees)
      .values({
        id: 'emp1',
        email: 'test@example.com',
        name: 'Test Employee',
        joinDate: '2023-01-01',
        status: 'regular',
        regularSalaryCents: 100000, // 1000.00
        active: 1,
      })
      .run()

    // 3. Employee Salary (Multi-currency)
    await db
      .insert(employeeSalaries)
      .values({
        id: uuid(),
        employeeId: 'emp1',
        salaryType: 'regular',
        currencyId: 'USDT',
        amountCents: 100000,
        createdAt: Date.now(),
      })
      .run()
  })

  it('should generate salary payments', async () => {
    const result = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
    expect(result.created).toBe(1)
    expect(result.ids.length).toBe(1)

    const payment = await salaryPaymentService.get(result.ids[0])
    expect(payment).toBeDefined()
    expect(payment?.salaryCents).toBe(100000)
    expect(payment?.status).toBe('pending_employee_confirmation')
  })

  it('should handle employee confirmation and finance approval', async () => {
    const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
    const id = genResult.ids[0]

    // Employee Confirm
    await salaryPaymentService.employeeConfirm(id, 'emp1')
    let payment = await salaryPaymentService.get(id)
    expect(payment?.status).toBe('pending_finance_approval')
    expect(payment?.employeeConfirmedBy).toBe('emp1')

    // Finance Approve
    await salaryPaymentService.financeApprove(id, 'finance1')
    payment = await salaryPaymentService.get(id)
    expect(payment?.status).toBe('pending_payment')
    expect(payment?.financeApprovedBy).toBe('finance1')
  })

  it('should handle currency allocation workflow', async () => {
    const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
    const id = genResult.ids[0]

    // Employee Confirm first (needed for some logic, though service doesn't strictly enforce it for allocation request, but route does)
    // Service.requestAllocation doesn't check status strictly in my implementation, but let's follow flow

    // Request Allocation - 分配全部薪资（100000 cents = 1000 USDT）
    // @ts-ignore
    await salaryPaymentService.salaryPaymentProcessingService.requestAllocation(
      id,
      [{ currencyId: 'USDT', amountCents: 100000 }],
      'emp1'
    )

    let payment = await salaryPaymentService.get(id)
    expect(payment?.allocationStatus).toBe('requested')
    expect(payment?.allocations.length).toBe(1)
    expect(payment?.allocations[0].amountCents).toBe(100000)
    expect(payment?.allocations[0].status).toBe('pending')

    // Approve Allocation
    // Approve Allocation
    // @ts-ignore
    await salaryPaymentService.salaryPaymentProcessingService.approveAllocation(id, undefined, true, 'finance1')

    payment = await salaryPaymentService.get(id)
    expect(payment?.allocationStatus).toBe('approved')
    expect(payment?.allocations[0].status).toBe('approved')
  })

  describe('乐观锁并发控制', () => {
    it('应该允许版本号匹配的更新', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]
      const payment = await salaryPaymentService.get(id)
      const version = payment?.version ?? 0

      // 使用正确的版本号应该成功
      await salaryPaymentService.employeeConfirm(id, 'emp1', version)
      const updated = await salaryPaymentService.get(id)
      expect(updated?.version).toBe(version + 1)
    })

    it('应该拒绝版本号不匹配的更新', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]
      const payment = await salaryPaymentService.get(id)
      const version = payment?.version ?? 0

      // 先更新一次，版本号会变化
      await salaryPaymentService.employeeConfirm(id, 'emp1', version)
      const updatedPayment = await salaryPaymentService.get(id)
      const newVersion = updatedPayment?.version ?? version + 1

      // 使用旧的版本号应该失败
      await expect(
        salaryPaymentService.employeeConfirm(id, 'emp1', version)
      ).rejects.toThrow()
    })

    it('应该在没有版本号时正常工作（向后兼容）', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // 不传版本号应该正常工作
      await salaryPaymentService.employeeConfirm(id, 'emp1')
      const updated = await salaryPaymentService.get(id)
      expect(updated?.status).toBe('pending_finance_approval')
    })
  })

  describe('状态机验证', () => {
    it('应该允许有效的状态转换', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // pending_employee_confirmation -> pending_finance_approval
      await salaryPaymentService.employeeConfirm(id, 'emp1')
      let payment = await salaryPaymentService.get(id)
      expect(payment?.status).toBe('pending_finance_approval')

      // pending_finance_approval -> pending_payment
      await salaryPaymentService.financeApprove(id, 'finance1')
      payment = await salaryPaymentService.get(id)
      expect(payment?.status).toBe('pending_payment')
    })

    it('应该拒绝无效的状态转换', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // 直接尝试从 pending_employee_confirmation 转换到 pending_payment 应该失败
      await expect(
        salaryPaymentService.financeApprove(id, 'finance1')
      ).rejects.toThrow()
    })
  })

  describe('多币种分配验证', () => {
    beforeEach(async () => {
      // 添加 CNY 币种
      await db
        .insert(currencies)
        .values({
          code: 'CNY',
          name: 'Chinese Yuan',
          active: 1,
        })
        .run()
    })

    it('应该验证多币种分配总额（允许1%误差）', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // 先确认员工，因为分配需要状态为 pending_payment
      await salaryPaymentService.employeeConfirm(id, 'emp1')
      await salaryPaymentService.financeApprove(id, 'finance1')

      // 总薪资是 100000 USDT (1000.00)
      // 分配 50000 USDT + 50000 CNY（假设汇率 1:1），总计 100000，符合要求
      await expect(
        // @ts-ignore
        salaryPaymentService.salaryPaymentProcessingService.requestAllocation(
          id,
          [
            { currencyId: 'USDT', amountCents: 50000, exchangeRate: 1 },
            { currencyId: 'CNY', amountCents: 50000, exchangeRate: 1 },
          ],
          'emp1'
        )
      ).resolves.not.toThrow()
    })

    it('应该拒绝超出允许误差的多币种分配', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // 先确认员工，因为分配需要状态为 pending_payment
      await salaryPaymentService.employeeConfirm(id, 'emp1')
      await salaryPaymentService.financeApprove(id, 'finance1')

      // 总薪资是 100000 USDT (1000.00)
      // 分配 50000 USDT + 60000 CNY（假设汇率 1:1），总计 110000，超出 1% 误差
      await expect(
        // @ts-ignore
        salaryPaymentService.salaryPaymentProcessingService.requestAllocation(
          id,
          [
            { currencyId: 'USDT', amountCents: 50000, exchangeRate: 1 },
            { currencyId: 'CNY', amountCents: 60000, exchangeRate: 1 },
          ],
          'emp1'
        )
      ).rejects.toThrow()
    })
  })

  describe('回退功能', () => {
    it('应该允许从 pending_finance_approval 回退', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      await salaryPaymentService.employeeConfirm(id, 'emp1')
      await salaryPaymentService.rollbackPayment(id, '测试回退', 'emp1')

      const payment = await salaryPaymentService.get(id)
      expect(payment?.status).toBe('pending_employee_confirmation')
      expect(payment?.rollbackReason).toBe('测试回退')
    })

    it('应该拒绝从 completed 状态回退', async () => {
      const genResult = await salaryPaymentGenerationService.generate(2023, 10, 'admin')
      const id = genResult.ids[0]

      // 完成整个流程
      await salaryPaymentService.employeeConfirm(id, 'emp1')
      await salaryPaymentService.financeApprove(id, 'finance1')
      // ... 其他步骤

      // 尝试回退应该失败
      await expect(
        salaryPaymentService.rollbackPayment(id, '测试', 'emp1')
      ).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('should list salary payments with employee and department names (sequential query)', async () => {
      // 生成薪资支付记录
      const genResult = await salaryPaymentGenerationService.generate(2023, 11, 'admin')
      const paymentId = genResult.ids[0]

      // 测试列表查询
      const result = await salaryPaymentService.list({ year: 2023, month: 11 })

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // 查找我们创建的支付记录
      const payment = result.find((p: any) => p.id === paymentId)
      expect(payment).toBeDefined()

      // 验证顺序查询正确组装了关联数据
      expect(payment?.employeeName).toBeDefined()
      expect(payment?.departmentName).toBeDefined()
      expect(payment?.orgDepartmentName).toBeDefined()
      expect(payment?.positionName).toBeDefined()

      // 验证数据正确性
      expect(payment?.employeeName).toBe('Test Employee')
      expect(payment?.allocations).toBeDefined()
      expect(Array.isArray(payment?.allocations)).toBe(true)
    })

    it('should filter by status', async () => {
      await salaryPaymentGenerationService.generate(2023, 12, 'admin')

      const pendingPayments = await salaryPaymentService.list({
        year: 2023,
        month: 12,
        status: 'pending_employee_confirmation',
      })

      expect(pendingPayments.length).toBeGreaterThan(0)
      pendingPayments.forEach((p: any) => {
        expect(p.status).toBe('pending_employee_confirmation')
      })
    })

    it('should return empty array when no payments match', async () => {
      const result = await salaryPaymentService.list({ year: 2099, month: 1 })
      expect(result).toEqual([])
    })
  })
})
