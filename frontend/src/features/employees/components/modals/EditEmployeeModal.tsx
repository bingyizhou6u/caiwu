import { useEffect } from 'react'
import { Modal, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../../config/api'
import { handleConflictError } from '../../../../utils/api'
import { useApiMutation } from '../../../../utils/useApiQuery'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { updateEmployeeSchema } from '../../../../validations/employee.schema'
import { EmployeeForm } from '../forms/EmployeeForm'

interface EditEmployeeModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
    employee: any
}

export function EditEmployeeModal({ open, onCancel, onSuccess, employee }: EditEmployeeModalProps) {
    const { form, validateWithZod } = useZodForm(updateEmployeeSchema)
    const { mutateAsync: updateEmployee, isPending: isUpdating } = useApiMutation()

    useEffect(() => {
        if (open && employee) {
            // 确定项目ID
            const projectId = employee.departmentName === '总部' ? 'hq' : employee.departmentId

            // 解析电话号码
            let phoneCountryCode = '+971'
            let phoneNumber = ''
            if (employee.phone) {
                if (employee.phone.includes(' ')) {
                    const parts = employee.phone.split(' ')
                    phoneCountryCode = parts[0]
                    phoneNumber = parts[1]
                } else if (employee.phone.startsWith('+')) {
                    const match = employee.phone.match(/^(\+\d+)\s+(\d+)$/)
                    if (match) {
                        phoneCountryCode = match[1]
                        phoneNumber = match[2]
                    } else {
                        phoneNumber = employee.phone
                    }
                } else {
                    phoneNumber = employee.phone
                }
            }

            let emergencyPhoneCountryCode = '+971'
            let emergencyPhoneNumber = ''
            if (employee.emergencyPhone) {
                const match = employee.emergencyPhone.match(/^(\+\d+)\s+(\d+)$/)
                if (match) {
                    emergencyPhoneCountryCode = match[1]
                    emergencyPhoneNumber = match[2]
                } else {
                    emergencyPhoneNumber = employee.emergencyPhone
                }
            }

            // 解析上班时间（后端存字符串时需反序列化）
            let parsedWorkSchedule = employee.workSchedule
            if (typeof parsedWorkSchedule === 'string') {
                try {
                    parsedWorkSchedule = JSON.parse(parsedWorkSchedule)
                } catch {
                    parsedWorkSchedule = undefined
                }
            }

            form.setFieldsValue({
                name: employee.name,
                project_id: projectId,
                departmentId: projectId === 'hq' ? 'hq' : employee.departmentId,
                orgDepartmentId: employee.orgDepartmentId,
                positionId: employee.positionId,
                joinDate: employee.joinDate ? dayjs(employee.joinDate) : undefined,
                birthday: employee.birthday ? dayjs(employee.birthday) : undefined,
                workSchedule: parsedWorkSchedule,
                annualLeaveCycleMonths: employee.annualLeaveCycleMonths,
                annualLeaveDays: employee.annualLeaveDays,
                active: employee.active,
                email: employee.email,
                personalEmail: employee.personalEmail,
                phone_country_code: phoneCountryCode,
                phone_number: phoneNumber,
                address: employee.address,
                usdtAddress: employee.usdtAddress,
                emergencyContact: employee.emergencyContact,
                emergencyPhone_country_code: emergencyPhoneCountryCode,
                emergencyPhone_number: emergencyPhoneNumber,
                memo: employee.memo,
            })
        } else {
            form.resetFields()
        }
    }, [open, employee, form])

    const handleUpdate = async () => {
        try {
            const values = await validateWithZod()
            if (!employee) return

            // 转换表单值为后端格式
            const payload: any = {}

            // 基础字段 - 如存在则直接复制
            if (values.name) payload.name = values.name
            if (values.departmentId) payload.departmentId = values.departmentId
            if (values.orgDepartmentId) payload.orgDepartmentId = values.orgDepartmentId
            if (values.positionId) payload.positionId = values.positionId
            if (values.active !== undefined) payload.active = values.active ? 1 : 0

            // 日期字段 - 将dayjs转换为字符串
            if (values.joinDate) {
                payload.joinDate = typeof values.joinDate === 'string'
                    ? values.joinDate
                    : values.joinDate.format?.('YYYY-MM-DD') || values.joinDate
            }
            if (values.birthday) {
                payload.birthday = typeof values.birthday === 'string'
                    ? values.birthday
                    : values.birthday.format?.('YYYY-MM-DD') || values.birthday
            }

            // 合并电话字段
            if (values.phone_country_code && values.phone_number) {
                payload.phone = `${values.phone_country_code} ${values.phone_number}`
            }
            if (values.emergencyPhone_country_code && values.emergencyPhone_number) {
                payload.emergencyPhone = `${values.emergencyPhone_country_code} ${values.emergencyPhone_number}`
            }

            // 其他可选字段
            if (values.usdtAddress !== undefined) payload.usdtAddress = values.usdtAddress || null
            if (values.personalEmail !== undefined) payload.personalEmail = values.personalEmail || null
            if (values.address !== undefined) payload.address = values.address || null
            if (values.emergencyContact !== undefined) payload.emergencyContact = values.emergencyContact || null
            if (values.memo !== undefined) payload.memo = values.memo || null
            if (values.workSchedule !== undefined) payload.workSchedule = values.workSchedule
            if (values.annualLeaveCycleMonths !== undefined) payload.annualLeaveCycleMonths = values.annualLeaveCycleMonths
            if (values.annualLeaveDays !== undefined) payload.annualLeaveDays = values.annualLeaveDays

            await updateEmployee({
                url: api.employeesById(employee.id),
                method: 'PUT',
                body: payload
            })
            message.success('更新成功')
            onSuccess()
        } catch (error: any) {
            handleConflictError(error, '员工', 'name')
        }
    }

    return (
        <Modal
            title="编辑员工"
            open={open}
            onOk={handleUpdate}
            onCancel={() => {
                form.resetFields()
                onCancel()
            }}
            okText="保存"
            cancelText="取消"
            width={800}
            confirmLoading={isUpdating}
        >
            <EmployeeForm form={form} isEdit={true} />
        </Modal>
    )
}


