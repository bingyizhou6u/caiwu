/**
 * 租赁服务（门面模式）
 * 委托给具体的租赁服务类
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { RentalPropertyService } from './RentalPropertyService.js'
import { RentalPaymentService } from './RentalPaymentService.js'
import { DormitoryAllocationService } from './DormitoryAllocationService.js'

export class RentalService {
  private propertyService: RentalPropertyService
  private paymentService: RentalPaymentService
  private allocationService: DormitoryAllocationService

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.propertyService = new RentalPropertyService(db)
    this.paymentService = new RentalPaymentService(db)
    this.allocationService = new DormitoryAllocationService(db)
  }

  // --- 物业管理 ---

  async listProperties(query: { propertyType?: string; status?: string; departmentId?: string }) {
    return this.propertyService.listProperties(query)
  }

  async getProperty(id: string) {
    const property = await this.propertyService.getProperty(id)
    
    // 获取支付记录和分配记录（如果是宿舍）
    const propertyType = (property as any).propertyType || (property as any).property?.propertyType
    const [payments, allocations] = await Promise.all([
      this.paymentService.listPayments({ propertyId: id }),
      propertyType === 'dormitory'
        ? this.allocationService.listAllocationsSimple({ propertyId: id })
        : Promise.resolve([]),
    ])

    return {
      ...property,
      payments: payments.map((p: any) => p.payment),
      allocations: allocations.map((a: any) => ({
        ...a.allocation,
        employeeName: a.employeeName,
        departmentName: a.employeeDepartmentName,
      })),
    }
  }

  async createProperty(data: {
    propertyCode: string
    name: string
    propertyType: string
    address?: string
    areaSqm?: number
    rentType?: string
    monthlyRentCents?: number
    yearlyRentCents?: number
    currency: string
    paymentPeriodMonths?: number
    landlordName?: string
    landlordContact?: string
    leaseStartDate?: string
    leaseEndDate?: string
    depositCents?: number
    paymentMethod?: string
    paymentAccountId?: string
    paymentDay?: number
    departmentId?: string
    status?: string
    memo?: string
    contractFileUrl?: string
    createdBy?: string
  }) {
    return this.propertyService.createProperty(data)
  }

  async updateProperty(
    id: string,
    data: Partial<typeof schema.rentalProperties.$inferInsert> & { createdBy?: string }
  ) {
    return this.propertyService.updateProperty(id, data)
  }

  async deleteProperty(id: string) {
    return this.propertyService.deleteProperty(id)
  }

  // --- 租金支付 ---

  async listPayments(query: { propertyId?: string; year?: number; month?: number }) {
    return this.paymentService.listPayments(query)
  }

  async createPayment(data: {
    propertyId: string
    paymentDate: string
    year: number
    month: number
    amountCents: number
    currency: string
    accountId: string
    categoryId?: string
    paymentMethod?: string
    voucherUrl?: string
    memo?: string
    createdBy?: string
  }) {
    return this.paymentService.createPayment(data)
  }

  async updatePayment(id: string, data: Partial<typeof schema.rentalPayments.$inferInsert>) {
    return this.paymentService.updatePayment(id, data)
  }

  async deletePayment(id: string) {
    return this.paymentService.deletePayment(id)
  }

  async generatePayableBills(userId?: string) {
    return this.paymentService.generatePayableBills(userId)
  }

  async listPayableBills(query: {
    propertyId?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    return this.paymentService.listPayableBills(query)
  }

  async markBillPaid(id: string) {
    return this.paymentService.markBillPaid(id)
  }

  // --- 宿舍分配 ---

  async listAllocations(query: { propertyId?: string; employeeId?: string; returned?: boolean }) {
    return this.allocationService.listAllocations(query)
  }

  async allocateDormitory(data: {
    propertyId: string
    employeeId: string
    roomNumber?: string
    bedNumber?: string
    allocationDate: string
    monthlyRentCents?: number
    memo?: string
    createdBy?: string
  }) {
    return this.allocationService.allocateDormitory(data)
  }

  async returnDormitory(id: string, data: { returnDate: string; memo?: string }) {
    return this.allocationService.returnDormitory(id, data)
  }
}
