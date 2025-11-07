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
  property_code: string
  name: string
  property_type: PropertyType
  address?: string
  area_sqm?: number
  rent_type: RentType
  monthly_rent_cents?: number
  yearly_rent_cents?: number
  payment_period_months: number
  currency: string
  currency_name?: string
  landlord_name?: string
  landlord_contact?: string
  lease_start_date?: string
  lease_end_date?: string
  deposit_cents?: number
  payment_method?: PaymentMethod
  payment_day?: number
  department_id?: string
  department_name?: string
  payment_account_id?: string
  payment_account_name?: string
  status: RentalStatus
  memo?: string
  created_by?: string
  created_by_name?: string
  created_at: number
  updated_at: number
  allocations?: DormitoryAllocation[]
  payments?: RentalPayment[]
  changes?: RentalPropertyChange[]
}

export interface DormitoryAllocation {
  id: string
  property_id: string
  employee_id: string
  employee_name?: string
  employee_department_name?: string
  room_number?: string
  bed_number?: string
  allocation_date: string
  return_date?: string
  monthly_rent_cents?: number
  created_at: number
}

export interface RentalPayment {
  id: string
  property_id: string
  property_name?: string
  payment_date: string
  year: number
  month: number
  amount_cents: number
  currency: string
  currency_name?: string
  account_id?: string
  account_name?: string
  category_id?: string
  category_name?: string
  payment_method?: PaymentMethod
  voucher_url?: string
  memo?: string
  created_by?: string
  created_by_name?: string
  created_at: number
}

export interface RentalPayableBill {
  id: string
  property_id: string
  property_name?: string
  bill_date: string
  due_date: string
  year: number
  month: number
  amount_cents: number
  currency: string
  currency_name?: string
  payment_period_months?: number
  status: BillStatus
  paid_date?: string
  paid_payment_id?: string
  memo?: string
  created_by?: string
  created_at: number
  updated_at: number
}

export interface RentalPropertyChange {
  id: string
  property_id: string
  property_name?: string
  from_name?: string
  to_name?: string
  from_address?: string
  to_address?: string
  from_area_sqm?: number
  to_area_sqm?: number
  from_rent_type?: RentType
  to_rent_type?: RentType
  from_monthly_rent_cents?: number
  to_monthly_rent_cents?: number
  from_payment_period_months?: number
  to_payment_period_months?: number
  from_currency?: string
  to_currency?: string
  from_lease_start?: string
  to_lease_start?: string
  from_lease_end?: string
  to_lease_end?: string
  from_status?: RentalStatus
  to_status?: RentalStatus
  memo?: string
  changed_by?: string
  changed_by_name?: string
  changed_at: number
}

