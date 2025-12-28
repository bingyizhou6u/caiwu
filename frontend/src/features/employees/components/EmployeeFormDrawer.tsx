/**
 * 员工表单抽屉组件
 * 使用 Drawer 提供更好的编辑体验
 * - 新建模式：分步表单引导
 * - 编辑模式：Tab 组织内容
 */

import { useEffect, useState, useCallback } from 'react'
import { Drawer, Steps, Button, Tabs, message, Spin } from 'antd'
import {
    UserOutlined,
    PhoneOutlined,
    DollarOutlined,
    SettingOutlined,
    ProjectOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined,
    CheckOutlined,
    SaveOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { handleConflictError } from '../../../utils/api'
import { useApiMutation } from '../../../utils/useApiQuery'
import { api } from '../../../config/api'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createEmployeeSchema, updateEmployeeSchema } from '../../../validations/employee.schema'
import {
    useEmployeeSalaries,
    useEmployeeAllowances,
    useUpdateEmployeeSalaries,
    useUpdateEmployeeAllowances,
    useCreateEmployee,
} from '../../../hooks/business/useEmployees'
import { withErrorHandler } from '../../../utils/errorHandler'

// 子表单组件
import { BasicInfoForm } from './forms/BasicInfoForm'
import { ContactInfoForm } from './forms/ContactInfoForm'
import { SalaryAllowanceForm } from './forms/SalaryAllowanceForm'
import { EmployeeStatusSection } from './forms/EmployeeStatusSection'
import { EmployeeProjectsSection } from './forms/EmployeeProjectsSection'

import '../../../styles/features/employees/employee-drawer.css'

interface EmployeeFormDrawerProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    employee?: any // 编辑模式下传入员工数据
}

const STEPS = [
    { title: '基本信息', icon: <UserOutlined /> },
    { title: '联系方式', icon: <PhoneOutlined /> },
    { title: '薪资配置', icon: <DollarOutlined /> },
]

export function EmployeeFormDrawer({ open, onClose, onSuccess, employee }: EmployeeFormDrawerProps) {
    const isEdit = !!employee
    const [currentStep, setCurrentStep] = useState(0)
    const [activeTab, setActiveTab] = useState('basic')

    const { form, validateWithZod } = useZodForm(isEdit ? updateEmployeeSchema : createEmployeeSchema)
    const { mutateAsync: updateEmployee, isPending: isUpdatingEmployee } = useApiMutation()
    const { mutateAsync: createEmployeeMutation, isPending: isCreating } = useCreateEmployee()

    // 薪资和补贴查询（仅编辑模式）
    const { data: probationSalaries, isLoading: loadingProbation } = useEmployeeSalaries({
        employeeId: isEdit && employee?.id ? employee.id : '',
        salaryType: 'probation',
    })
    const { data: regularSalaries, isLoading: loadingRegular } = useEmployeeSalaries({
        employeeId: isEdit && employee?.id ? employee.id : '',
        salaryType: 'regular',
    })

    const { data: livingAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'living',
    })
    const { data: housingAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'housing',
    })
    const { data: transportationAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'transportation',
    })
    const { data: mealAllowances } = useEmployeeAllowances({
        employeeId: isEdit && employee?.id ? employee.id : '',
        allowanceType: 'meal',
    })

    // 更新 Mutations
    const { mutateAsync: updateSalaries, isPending: isUpdatingSalaries } = useUpdateEmployeeSalaries()
    const { mutateAsync: updateAllowances, isPending: isUpdatingAllowances } = useUpdateEmployeeAllowances()

    const isSubmitting = isCreating || isUpdatingEmployee || isUpdatingSalaries || isUpdatingAllowances
    const isLoadingSalaryData = loadingProbation || loadingRegular

    // 初始化表单数据（编辑模式）
    useEffect(() => {
        if (open && employee) {
            const projectId = employee.projectId

            // 解析电话号码
            let phoneCountryCode = '+971'
            let phoneNumber = ''
            if (employee.phone) {
                const match = employee.phone.match(/^(\+\d+)\s*(.*)$/)
                if (match) {
                    phoneCountryCode = match[1]
                    phoneNumber = match[2]
                } else {
                    phoneNumber = employee.phone
                }
            }

            let emergencyPhoneCountryCode = '+971'
            let emergencyPhoneNumber = ''
            if (employee.emergencyPhone) {
                const match = employee.emergencyPhone.match(/^(\+\d+)\s*(.*)$/)
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
                projectId: employee.projectId,
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
            form.resetFields()
            setCurrentStep(0)
            setActiveTab('basic')
        }
    }, [open, employee, form])

    // 当薪资/补贴数据加载后，更新表单（仅编辑模式）
    useEffect(() => {
        if (!open || !isEdit) return

        const formatMoneyData = (list: any[]) => {
            if (!list || !Array.isArray(list)) return []
            return list.map((item) => ({
                currencyId: item.currencyId,
                amountCents: item.amountCents,
            }))
        }

        if (probationSalaries) form.setFieldValue('probation_salaries', formatMoneyData(probationSalaries))
        if (regularSalaries) form.setFieldValue('regular_salaries', formatMoneyData(regularSalaries))
        if (livingAllowances) form.setFieldValue('living_allowances', formatMoneyData(livingAllowances))
        if (housingAllowances) form.setFieldValue('housing_allowances', formatMoneyData(housingAllowances))
        if (transportationAllowances) form.setFieldValue('transportation_allowances', formatMoneyData(transportationAllowances))
        if (mealAllowances) form.setFieldValue('meal_allowances', formatMoneyData(mealAllowances))
    }, [open, isEdit, probationSalaries, regularSalaries, livingAllowances, housingAllowances, transportationAllowances, mealAllowances, form])

    // 新建员工
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
                projectId: project_id,
                probationSalaries: probation_salaries as any,
                regularSalaries: regular_salaries as any,
                phone: phone_country_code && phone_number ? `${phone_country_code}${phone_number}` : undefined,
                emergencyPhone:
                    emergencyPhone_country_code && emergencyPhone_number
                        ? `${emergencyPhone_country_code}${emergencyPhone_number}`
                        : undefined,
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
                    allowancePromises.push(
                        updateAllowances({
                            employeeId: data.id,
                            allowanceType: type,
                            allowances: allowances as any,
                        })
                    )
                }
            }

            if (allowancePromises.length > 0) {
                await Promise.all(allowancePromises)
            }

            message.success('员工创建成功')
            onSuccess()
            handleClose()
        },
        {
            onError: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : ''
                if (errorMessage === '表单验证失败') {
                    message.error('请检查表单填写是否完整')
                } else {
                    handleConflictError(error, '员工', 'name')
                }
            },
        }
    )

    // 更新员工
    const handleUpdate = async () => {
        try {
            const values = await validateWithZod()
            if (!employee) return

            const payload: any = {}

            // 基础字段
            if (values.name) payload.name = values.name
            if (values.projectId) payload.projectId = values.projectId
            if (values.orgDepartmentId) payload.orgDepartmentId = values.orgDepartmentId
            if (values.positionId) payload.positionId = values.positionId
            if (isEdit && 'active' in values && values.active !== undefined) {
                payload.active = values.active ? 1 : 0
            }

            // 日期字段
            if (values.joinDate) {
                payload.joinDate =
                    typeof values.joinDate === 'string' ? values.joinDate : values.joinDate.format?.('YYYY-MM-DD') || values.joinDate
            }
            if (values.regularDate) {
                payload.regularDate =
                    typeof values.regularDate === 'string'
                        ? values.regularDate
                        : values.regularDate.format?.('YYYY-MM-DD') || values.regularDate
            }
            if (values.birthday) {
                payload.birthday =
                    typeof values.birthday === 'string' ? values.birthday : values.birthday.format?.('YYYY-MM-DD') || values.birthday
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
                    body: payload,
                }),
            ]

            // 更新薪资
            if (values.probation_salaries) {
                promises.push(
                    updateSalaries({
                        employeeId: employee.id,
                        salaryType: 'probation',
                        salaries: values.probation_salaries,
                    })
                )
            }
            if (values.regular_salaries) {
                promises.push(
                    updateSalaries({
                        employeeId: employee.id,
                        salaryType: 'regular',
                        salaries: values.regular_salaries,
                    })
                )
            }

            // 更新补贴
            const allowanceTypes = ['living', 'housing', 'transportation', 'meal'] as const
            const formValues = values as any
            allowanceTypes.forEach((type) => {
                const allowances = formValues[`${type}_allowances`]
                if (allowances) {
                    promises.push(
                        updateAllowances({
                            employeeId: employee.id,
                            allowanceType: type,
                            allowances: allowances,
                        })
                    )
                }
            })

            await Promise.all(promises)

            message.success('更新成功')
            onSuccess()
            handleClose()
        } catch (error: any) {
            handleConflictError(error, '员工', 'name')
        }
    }

    const handleClose = useCallback(() => {
        form.resetFields()
        setCurrentStep(0)
        setActiveTab('basic')
        onClose()
    }, [form, onClose])

    // 下一步（新建模式）
    const handleNext = async () => {
        // 验证当前步骤的字段
        const fieldsToValidate = getStepFields(currentStep)
        try {
            await form.validateFields(fieldsToValidate)
            setCurrentStep(currentStep + 1)
        } catch {
            message.warning('请完善当前步骤的必填信息')
        }
    }

    // 上一步（新建模式）
    const handlePrev = () => {
        setCurrentStep(currentStep - 1)
    }

    // 获取每个步骤需要验证的字段
    const getStepFields = (step: number): string[] => {
        switch (step) {
            case 0:
                return ['name', 'project_id', 'orgDepartmentId', 'positionId', 'joinDate', 'regularDate', 'birthday', 'personalEmail']
            case 1:
                return [] // 联系方式都是可选的
            case 2:
                return ['probation_salaries', 'regular_salaries']
            default:
                return []
        }
    }

    // 渲染步骤内容（新建模式）
    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return <BasicInfoForm form={form} isEdit={false} />
            case 1:
                return <ContactInfoForm form={form} />
            case 2:
                return <SalaryAllowanceForm form={form} />
            default:
                return null
        }
    }

    // 渲染 Tab 内容（编辑模式）
    const renderEditContent = () => {
        if (isLoadingSalaryData) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                    <Spin size="large" tip="加载中..." />
                </div>
            )
        }

        const tabItems = [
            {
                key: 'basic',
                label: (
                    <span>
                        <UserOutlined /> 基本信息
                    </span>
                ),
                children: <BasicInfoForm form={form} isEdit={true} employee={employee} />,
            },
            {
                key: 'contact',
                label: (
                    <span>
                        <PhoneOutlined /> 联系方式
                    </span>
                ),
                children: <ContactInfoForm form={form} />,
            },
            {
                key: 'salary',
                label: (
                    <span>
                        <DollarOutlined /> 薪资补贴
                    </span>
                ),
                children: <SalaryAllowanceForm form={form} />,
            },
            {
                key: 'status',
                label: (
                    <span>
                        <SettingOutlined /> 状态管理
                    </span>
                ),
                children: <EmployeeStatusSection employee={employee} onSuccess={onSuccess} />,
            },
            {
                key: 'projects',
                label: (
                    <span>
                        <ProjectOutlined /> 项目关联
                    </span>
                ),
                children: <EmployeeProjectsSection employeeId={employee?.id} />,
            },
        ]

        return (
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className="employee-edit-tabs"
                items={tabItems}
            />
        )
    }

    // 渲染底部按钮
    const renderFooter = () => {
        if (isEdit) {
            // 编辑模式
            return (
                <div className="drawer-footer-buttons">
                    <div className="drawer-footer-left">
                        <Button onClick={handleClose}>取消</Button>
                    </div>
                    <div className="drawer-footer-right">
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleUpdate}
                            loading={isSubmitting}
                            className="step-btn step-btn-primary"
                        >
                            保存更改
                        </Button>
                    </div>
                </div>
            )
        }

        // 新建模式 - 分步按钮
        return (
            <div className="drawer-footer-buttons">
                <div className="drawer-footer-left">
                    <Button onClick={handleClose}>取消</Button>
                </div>
                <div className="drawer-footer-right">
                    {currentStep > 0 && (
                        <Button icon={<ArrowLeftOutlined />} onClick={handlePrev} className="step-btn">
                            上一步
                        </Button>
                    )}
                    {currentStep < STEPS.length - 1 ? (
                        <Button type="primary" onClick={handleNext} className="step-btn step-btn-primary">
                            下一步 <ArrowRightOutlined />
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleCreate}
                            loading={isSubmitting}
                            className="step-btn step-btn-primary"
                        >
                            完成创建
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <Drawer
            title={isEdit ? `编辑员工：${employee?.name || ''}` : '新建员工'}
            placement="right"
            width={720}
            open={open}
            onClose={handleClose}
            className="employee-drawer"
            footer={renderFooter()}
            destroyOnClose
        >
            {!isEdit && (
                <div className="employee-steps-header">
                    <Steps current={currentStep} items={STEPS} size="small" />
                </div>
            )}

            <div className="employee-form-content">
                {isEdit ? renderEditContent() : renderStepContent()}
            </div>
        </Drawer>
    )
}

