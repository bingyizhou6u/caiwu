import { z } from 'zod'
import dayjs from 'dayjs'

export const createRentalPropertySchema = z.object({
    propertyCode: z.string().min(1, '房屋编号不能为空'),
    name: z.string().min(1, '房屋名称不能为空'),
    propertyType: z.enum(['office', 'dormitory']),
    address: z.string().optional(),
    areaSqm: z.number().min(0).optional(),
    rentType: z.enum(['monthly', 'yearly']),
    monthlyRentCents: z.number().min(0).optional(),
    yearlyRentCents: z.number().min(0).optional(),
    paymentPeriodMonths: z.number().int().min(1).max(12).optional(),
    currency: z.string().min(1, '请选择币种'),
    landlordName: z.string().optional(),
    landlordContact: z.string().optional(),
    leaseStartDate: z.any().refine((val) => !val || dayjs(val).isValid(), '请选择有效的租赁开始日期').optional(),
    leaseEndDate: z.any().refine((val) => !val || dayjs(val).isValid(), '请选择有效的租赁结束日期').optional(),
    depositCents: z.number().min(0).optional(),
    paymentMethod: z.enum(['bank_transfer', 'cash', 'check']).optional(),
    paymentDay: z.number().int().min(1).max(31).optional(),
    departmentId: z.string().optional(),
    status: z.enum(['active', 'expired', 'terminated']).optional(),
    memo: z.string().optional(),
    contractFileUrl: z.string().optional(),
    initialEmployees: z.array(z.string()).optional(),
}).refine(
    (data) => {
        if (data.rentType === 'yearly') {
            return data.yearlyRentCents !== undefined && data.yearlyRentCents > 0
        } else {
            return data.monthlyRentCents !== undefined && data.monthlyRentCents > 0
        }
    },
    {
        message: '年租模式需要年租金，月租模式需要月租金',
        path: ['rentType'],
    }
).refine(
    (data) => {
        if (data.leaseStartDate && data.leaseEndDate) {
            return dayjs(data.leaseStartDate).isBefore(dayjs(data.leaseEndDate)) || dayjs(data.leaseStartDate).isSame(dayjs(data.leaseEndDate))
        }
        return true
    },
    {
        message: '租赁开始日期不能晚于结束日期',
        path: ['leaseEndDate'],
    }
)

export const updateRentalPropertySchema = createRentalPropertySchema.partial().extend({
    propertyCode: z.string().min(1, '房屋编号不能为空').optional(),
    name: z.string().min(1, '房屋名称不能为空').optional(),
})

export const createRentalPaymentSchema = z.object({
    propertyId: z.string().min(1, '请选择租赁物业'),
    paymentDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的付款日期'),
    amountCents: z.number().min(0.01, '付款金额必须大于0'),
    currency: z.string().min(1, '请选择币种'),
    accountId: z.string().min(1, '请选择付款账户'),
    categoryId: z.string().optional(),
    paymentMethod: z.enum(['bank_transfer', 'cash', 'check']).optional(),
    voucherUrl: z.string().optional(),
    memo: z.string().optional(),
})

export const allocateDormitorySchema = z.object({
    employeeId: z.string().min(1, '请选择员工'),
    roomNumber: z.string().optional(),
    bedNumber: z.string().optional(),
    allocationDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的分配日期'),
    monthlyRentCents: z.number().min(0).optional(),
    memo: z.string().optional(),
})

export type CreateRentalPropertyFormData = z.infer<typeof createRentalPropertySchema>
export type UpdateRentalPropertyFormData = z.infer<typeof updateRentalPropertySchema>
export type CreateRentalPaymentFormData = z.infer<typeof createRentalPaymentSchema>
export type AllocateDormitoryFormData = z.infer<typeof allocateDormitorySchema>

