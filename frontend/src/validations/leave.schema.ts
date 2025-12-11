import { z } from 'zod'
import dayjs from 'dayjs'

export const leaveSchema = z.object({
    employeeId: z.string().min(1, '请选择员工'),
    leaveType: z.enum(['sick', 'annual', 'personal', 'other']),
    startDate: z.any().refine((val) => val && (dayjs.isDayjs(val) || typeof val === 'string'), {
        message: '请选择开始日期',
    }),
    endDate: z.any().refine((val) => val && (dayjs.isDayjs(val) || typeof val === 'string'), {
        message: '请选择结束日期',
    }),
    days: z.number().min(0.5, '请假天数至少为0.5天'),
    reason: z.string().min(1, '请输入请假原因').max(500, '原因不能超过500字'),
    memo: z.string().max(500, '备注不能超过500字').optional(),
}).refine((data) => {
    if (data.startDate && data.endDate) {
        const start = dayjs(data.startDate)
        const end = dayjs(data.endDate)
        return !end.isBefore(start)
    }
    return true
}, {
    message: '结束日期不能早于开始日期',
    path: ['endDate'],
})

export const approveLeaveSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    memo: z.string().max(500, '备注不能超过500字').optional(),
})
