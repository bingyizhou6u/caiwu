/**
 * 租赁管理相关类型定义
 */

export type PropertyType = 'office' | 'dormitory'
export type RentType = 'monthly' | 'yearly'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'check'
export type RentalStatus = 'active' | 'expired' | 'terminated'
export type BillStatus = 'unpaid' | 'paid' | 'cancelled'

export interface SelectOption {
  value: string | number
  label: string
  currency?: string
}

export interface RentalProperty {
  id: string
  propertyCode: string
  name: string
  propertyType: PropertyType
  address?: string
  areaSqm?: number
  rentType: RentType
  monthlyRentCents?: number
  yearlyRentCents?: number
  paymentPeriodMonths: number
  currency: string
  currencyName?: string
  landlordName?: string
  landlordContact?: string
  leaseStartDate?: string
  leaseEndDate?: string
  depositCents?: number
  paymentMethod?: PaymentMethod
  paymentDay?: number
  projectId?: string
  departmentName?: string
  paymentAccountId?: string
  paymentAccountName?: string
  status: RentalStatus
  memo?: string
  contractFileUrl?: string
  createdBy?: string
  createdByName?: string
  allocationsCount?: number
  createdAt: number
  updatedAt: number
  allocations?: DormitoryAllocation[]
  payments?: RentalPayment[]
  changes?: RentalPropertyChange[]
}

export interface DormitoryAllocation {
  id: string
  propertyId: string
  employeeId: string
  employeeName?: string
  employeeDepartmentName?: string
  roomNumber?: string
  bedNumber?: string
  allocationDate: string
  returnDate?: string
  monthlyRentCents?: number
  createdAt: number
}

export interface RentalPayment {
  id: string
  propertyId: string
  propertyName?: string
  paymentDate: string
  year: number
  month: number
  amountCents: number
  currency: string
  currencyName?: string
  accountId?: string
  accountName?: string
  categoryId?: string
  categoryName?: string
  paymentMethod?: PaymentMethod
  voucherUrl?: string
  memo?: string
  contractFileUrl?: string
  createdBy?: string
  createdByName?: string
  createdAt: number
}

export interface RentalPayableBill {
  id: string
  propertyId: string
  propertyName?: string
  billDate: string
  dueDate: string
  year: number
  month: number
  amountCents: number
  currency: string
  currencyName?: string
  paymentPeriodMonths?: number
  status: BillStatus
  paidDate?: string
  paidPaymentId?: string
  memo?: string
  contractFileUrl?: string
  createdBy?: string
  createdAt: number
  updatedAt: number
}

export interface RentalPropertyChange {
  id: string
  propertyId: string
  propertyName?: string
  fromName?: string
  toName?: string
  fromAddress?: string
  toAddress?: string
  fromAreaSqm?: number
  toAreaSqm?: number
  fromRentType?: RentType
  toRentType?: RentType
  fromMonthlyRentCents?: number
  toMonthlyRentCents?: number
  fromPaymentPeriodMonths?: number
  toPaymentPeriodMonths?: number
  fromCurrency?: string
  toCurrency?: string
  fromLeaseStart?: string
  toLeaseStart?: string
  fromLeaseEnd?: string
  toLeaseEnd?: string
  fromStatus?: RentalStatus
  toStatus?: RentalStatus
  memo?: string
  contractFileUrl?: string
  changedBy?: string
  changedByName?: string
  changedAt: number
}

