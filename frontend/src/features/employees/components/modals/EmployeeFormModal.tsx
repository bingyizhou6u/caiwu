import { useEffect, useState } from 'react'
import { Modal, message, Tabs } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../../config/api'
import { handleConflictError } from '../../../../utils/api'
import { useApiMutation } from '../../../../utils/useApiQuery'
import { useZodForm } from '../../../../hooks/forms/useZodForm'
import { createEmployeeSchema, updateEmployeeSchema } from '../../../../validations/employee.schema'
import { EmployeeForm } from '../forms/EmployeeForm'
import { EmployeeSalaryForm } from '../forms/EmployeeSalaryForm'
import { EmployeeStatusForm } from '../forms/EmployeeStatusForm'
import {
    useEmployeeSalaries,
    useEmployeeAllowances,
    useUpdateEmployeeSalaries,
    useUpdateEmployeeAllowances,
    useCreateEmployee
} from '../../../../hooks/business/useEmployees'
import { withErrorHandler } from '../../../../utils/errorHandler'

interface EmployeeFormModalProps {
    open: boolean
    onCancel: () => void
    onSuccess: () => void
    employee?: any // 如果提供则是编辑模式，否则是新建模式
}

const { TabPane } = Tabs

export function EmployeeFormModal({ open, onCancel, onSuccess, employee }: EmployeeFormModalProps) {
    const isEdit = !!employee
    const { form, validateWithZod } = useZodForm(isEdit ? updateEmployeeSchema : createEmployeeSchema)
    const { mutateAsync: updateEmployee, isPending: isUpdatingEmployee } = useApiMutation()
    const { mutateAsync: createEmployeeMutation, isPending: isCreating } = useCreateEmployee()
    const [success, setSuccess] = useState(false)
    const [createdData, setCreatedData] = useState<any>(null)

    // 薪资和补贴查询（仅编辑模式）
    const { data: probationSalaries } = useEmployeeSalaries({
        employeeId: isEdit && employee?.id ? employee.id : '',
        salaryType: 'probation'
    })
    const { data: regularSalaries } = useEmployeeSalaries({
        employeeId: isEdit && employee?.id ? employee.id : '',
        salaryType: 'regular'
    })

    const { data: livingAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'living'
    })
    const { data: housingAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'housing'
    })
    const { data: transportationAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'transportation'
    })
    const { data: mealAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'meal'
    })

    // 更新 Mutations
    const { mutateAsync: updateSalaries, isPending: isUpdatingSalaries } = useUpdateEmployeeSalaries()
    const { mutateAsync: updateAllowances, isPending: isUpdatingAllowances } = useUpdateEmployeeAllowances()

    const isSubmitting = isCreating || isUpdatingEmployee || isUpdatingSalaries || isUpdatingAllowances

    // 初始化表单数据（编辑模式）
    useEffect(() => {
        if (open && employee) {
            const projectId = employee.departmentId

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

            // 解析上班时间
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
                departmentId: employee.departmentId,
                orgDepartmentId: employee.orgDepartmentId,
                positionId: employee.positionId,
                joinDate: employee.joinDate ? dayjs(employee.joinDate) : undefined,
                regularDate: employee.regularDate ? dayjs(employee.regularDate) : undefined,
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
        } else if (open && !employee) {
            // 新建模式：重置表单
            form.resetFields()
        }
    }, [open, employee, form])

    // 当薪资/补贴数据加载后，更新表单（仅编辑模式）
    useEffect(() => {
        if (!open || !isEdit) return

        const formatMoneyData = (list: any[]) => {
            if (!list || !Array.isArray(list)) return []
            return list.map(item => ({
                currencyId: item.currencyId,
                amountCents: item.amountCents
            }))
        }

        if (probationSalaries) form.setFieldValue('probation_salaries', formatMoneyData(probationSalaries))
        if (regularSalaries) form.setFieldValue('regular_salaries', formatMoneyData(regularSalaries))
        if (livingAllowances) form.setFieldValue('living_allowances', formatMoneyData(livingAllowances))
        if (housingAllowances) form.setFieldValue('housing_allowances', formatMoneyData(housingAllowances))
        if (transportationAllowances) form.setFieldValue('transportation_allowances', formatMoneyData(transportationAllowances))
        if (mealAllowances) form.setFieldValue('meal_allowances', formatMoneyData(mealAllowances))
    }, [
        open,
        isEdit,
        probationSalaries,
        regularSalaries,
        livingAllowances,
        housingAllowances,
        transportationAllowances,
        mealAllowances,
        form
    ])

    const handleCreate = withErrorHandler(
        async () => {
            const values = await validateWithZod()

            const {
                living_allowances,
                housing_allowances,
                transportation_allowances,
                meal_allowances,
                orgDepartmentId,
                project_id,
                probation_salaries,
                regular_salaries,
                phone_country_code,
                phone_number,
                emergencyPhone_country_code,
                emergencyPhone_number,
                joinDate,
                regularDate,
                birthday,
                ...restData
            } = values

            const employeeData = {
                ...restData,
                orgDepartmentId,
                departmentId: project_id,
                probationSalaries: probation_salaries as any,
                regularSalaries: regular_salaries as any,
                phone: phone_country_code && phone_number ? `${phone_country_code}${phone_number}` : undefined,
                emergencyPhone: emergencyPhone_country_code && emergencyPhone_number ? `${emergencyPhone_country_code}${emergencyPhone_number}` : undefined,
                joinDate: joinDate ? joinDate.format('YYYY-MM-DD') : undefined,
                regularDate: regularDate ? regularDate.format('YYYY-MM-DD') : undefined,
                birthday: birthday ? birthday.format('YYYY-MM-DD') : undefined,
            }

            const data = await createEmployeeMutation(employeeData)

            // 创建补贴（批量）
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal'] as const
            const allowancePromises: Promise<any>[] = []

            const allowancesMap = {
                living: living_allowances,
                housing: housing_allowances,
                transportation: transportation_allowances,
                meal: meal_allowances,
            }

            for (const type of allowanceTypes) {
                const allowances = allowancesMap[type] || []
                if (allowances.length > 0) {
                    allowancePromises.push(updateAllowances({
                        employeeId: data.id,
                        allowanceType: type,
                        allowances: allowances as any,
                    }))
                }
            }

            if (allowancePromises.length > 0) {
                await Promise.all(allowancePromises)
            }

            message.success('员工创建成功')
            onSuccess()
            onCancel()
        },
        {
            onError: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : ''
                if (errorMessage === '表单验证失败') {
                    message.error('请检查表单填写是否完整')
                } else {
                    handleConflictError(error, '员工', 'name')
                }
            }
        }
    )

    const handleUpdate = async () => {
        try {
            const values = await validateWithZod()
            if (!employee) return

            const payload: any = {}

            // 基础字段
            if (values.name) payload.name = values.name
            if (values.departmentId) payload.departmentId = values.departmentId
            if (values.orgDepartmentId) payload.orgDepartmentId = values.orgDepartmentId
            if (values.positionId) payload.positionId = values.positionId
            if (isEdit && 'active' in values && values.active !== undefined) {
                payload.active = values.active ? 1 : 0
            }

            // 日期字段
            if (values.joinDate) {
                payload.joinDate = typeof values.joinDate === 'string'
                    ? values.joinDate
                    : values.joinDate.format?.('YYYY-MM-DD') || values.joinDate
            }
            if (values.regularDate) {
                payload.regularDate = typeof values.regularDate === 'string'
                    ? values.regularDate
                    : values.regularDate.format?.('YYYY-MM-DD') || values.regularDate
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

            // 其他字段
            if (values.usdtAddress !== undefined) payload.usdtAddress = values.usdtAddress || null
            if (values.personalEmail !== undefined) payload.personalEmail = values.personalEmail || null
            if (values.address !== undefined) payload.address = values.address || null
            if (values.emergencyContact !== undefined) payload.emergencyContact = values.emergencyContact || null
            if (values.memo !== undefined) payload.memo = values.memo || null
            if (values.workSchedule !== undefined) payload.workSchedule = values.workSchedule
            if (values.annualLeaveCycleMonths !== undefined) payload.annualLeaveCycleMonths = values.annualLeaveCycleMonths
            if (values.annualLeaveDays !== undefined) payload.annualLeaveDays = values.annualLeaveDays

            // 并行执行所有更新
            const promises = [
                updateEmployee({
                    url: api.employeesById(employee.id),
                    method: 'PUT',
                    body: payload
                })
            ]

            // 更新薪资
            if (values.probation_salaries) {
                promises.push(updateSalaries({
                    employeeId: employee.id,
                    salaryType: 'probation',
                    salaries: values.probation_salaries
                }))
            }
            if (values.regular_salaries) {
                promises.push(updateSalaries({
                    employeeId: employee.id,
                    salaryType: 'regular',
                    salaries: values.regular_salaries
                }))
            }

            // 更新补贴
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal'] as const
            const formValues = values as any
            allowanceTypes.forEach(type => {
                const allowances = formValues[`${type}_allowances`]
                if (allowances) {
                    promises.push(updateAllowances({
                        employeeId: employee.id,
                        allowanceType: type,
                        allowances: allowances
                    }))
                }
            })

            await Promise.all(promises)

            message.success('更新成功')
            onSuccess()
            onCancel()
        } catch (error: any) {
            handleConflictError(error, '员工', 'name')
        }
    }

    const handleSubmit = isEdit ? handleUpdate : handleCreate

    return (
        <Modal
            title={isEdit ? '编辑员工' : '新建员工'}
            open={open}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields()
                setSuccess(false)
                setCreatedData(null)
                onCancel()
            }}
            okText={isEdit ? '保存' : '创建'}
            cancelText="取消"
            width={800}
            confirmLoading={isSubmitting}
        >
            <EmployeeForm form={form} isEdit={isEdit} employee={employee}>
                <TabPane tab="薪资与补贴" key="salary">
                    <EmployeeSalaryForm form={form} />
                </TabPane>
                {isEdit && (
                    <TabPane tab="状态管理" key="status">
                        <EmployeeStatusForm form={form} employee={employee} onSuccess={onSuccess} />
                    </TabPane>
                )}
            </EmployeeForm>
        </Modal>
    )
}
