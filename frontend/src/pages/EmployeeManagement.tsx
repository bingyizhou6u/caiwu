import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, InputNumber, DatePicker, Switch, Tabs, Descriptions, Dropdown } from 'antd'
import { PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { loadCurrencies, loadDepartments } from '../utils/loaders'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../utils/api'

const { Option } = Select
const { TabPane } = Tabs
const { TextArea } = Input

const ROLE_LABELS: Record<string, string> = {
  manager: '管理员',
  finance: '财务',
  hr: '人事',
  auditor: '审计',
  employee: '员工',
  read: '只读',
}

// 国家区号列表
const COUNTRY_CODES = [
  { code: '+971', name: '阿联酋', flag: '🇦🇪' },
  { code: '+94', name: '斯里兰卡', flag: '🇱🇰' },
  { code: '+374', name: '亚美尼亚', flag: '🇦🇲' },
  { code: '+81', name: '日本', flag: '🇯🇵' },
  { code: '+84', name: '越南', flag: '🇻🇳' },
  { code: '+60', name: '马来西亚', flag: '🇲🇾' },
  { code: '+856', name: '老挝', flag: '🇱🇦' },
  { code: '+66', name: '泰国', flag: '🇹🇭' },
  { code: '+1', name: '美国/加拿大', flag: '🇺🇸' },
  { code: '+855', name: '柬埔寨', flag: '🇰🇭' },
  { code: '+852', name: '香港', flag: '🇭🇰' },
]

// 解析手机号码：从完整号码中提取区号和号码
const parsePhone = (phone: string | undefined): { countryCode: string, phoneNumber: string } => {
  if (!phone) return { countryCode: '+971', phoneNumber: '' }
  
  // 如果包含+号，尝试解析
  const match = phone.match(/^(\+\d{1,4})(.*)$/)
  if (match) {
    return { countryCode: match[1], phoneNumber: match[2].replace(/[^\d]/g, '') }
  }
  
  // 如果没有+号，默认阿联酋区号
  return { countryCode: '+971', phoneNumber: phone.replace(/[^\d]/g, '') }
}

// 组合手机号码：将区号和号码组合
const combinePhone = (countryCode: string, phoneNumber: string): string => {
  if (!phoneNumber) return ''
  return `${countryCode}${phoneNumber}`
}

type Employee = {
  id: string
  name: string
  department_id: string
  department_name?: string
  org_department_id?: string
  org_department_name?: string
  org_department_code?: string
  join_date: string
  probation_salary_cents: number
  regular_salary_cents: number
  status: 'probation' | 'regular' | 'resigned'
  regular_date?: string
  leave_date?: string
  leave_reason?: string
  leave_type?: 'resigned' | 'terminated' | 'expired' | 'retired' | 'other'
  leave_memo?: string
  active: number
  phone?: string
  email?: string
  usdt_address?: string
  emergency_contact?: string
  emergency_phone?: string
  address?: string
  memo?: string
  living_allowance_cents?: number
  housing_allowance_cents?: number
  transportation_allowance_cents?: number
  meal_allowance_cents?: number
  birthday?: string  // 生日 YYYY-MM-DD
  user_id?: string  // 用户账号ID
  user_role?: string  // 用户角色
  user_active?: number  // 用户账号状态
  user_last_login_at?: number  // 用户最近登录时间
}

export function EmployeeManagement({ userRole }: { userRole?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [orgDepartments, setOrgDepartments] = useState<any[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [currencies, setCurrencies] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [regularizeOpen, setRegularizeOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [rejoinOpen, setRejoinOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [salaryConfigOpen, setSalaryConfigOpen] = useState(false)
  const [salaryConfigType, setSalaryConfigType] = useState<'probation' | 'regular'>('probation')
  const [employeeSalaries, setEmployeeSalaries] = useState<any[]>([])
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [regularizeForm] = Form.useForm()
  const [leaveForm] = Form.useForm()
  const [rejoinForm] = Form.useForm()
  const [salaryConfigForm] = Form.useForm()
  const [allowanceConfigOpen, setAllowanceConfigOpen] = useState(false)
  const [allowanceConfigType, setAllowanceConfigType] = useState<'living' | 'housing' | 'transportation' | 'meal' | 'birthday'>('living')
  const [employeeAllowances, setEmployeeAllowances] = useState<any[]>([])
  const [allowanceConfigForm] = Form.useForm()
  const [dormitoryAllocations, setDormitoryAllocations] = useState<any[]>([])
  const [dormitoryAllocateOpen, setDormitoryAllocateOpen] = useState(false)
  const [dormitoryAllocateForm] = Form.useForm()
  const [rentalProperties, setRentalProperties] = useState<any[]>([])
  // 用户账号管理相关状态
  const [resetUserOpen, setResetUserOpen] = useState(false)
  const [resetUserForm] = Form.useForm()
  const [resetUser, setResetUser] = useState<Employee | null>(null)
  const isManager = userRole === 'manager'
  const canEdit = userRole === 'manager' || userRole === 'finance' || userRole === 'hr'
  const isHR = userRole === 'hr' || canEdit

  const loadEmployees = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        params.append('active_only', 'true')
      } else {
        params.append('status', statusFilter)
      }
    }
    try {
      const results = await apiGet(`${api.employees}?${params.toString()}`)
      setEmployees(results)
    } catch (error: any) {
      message.error(error.message || '加载员工列表失败')
    }
  }, [statusFilter])


  const loadMasterData = useCallback(async () => {
    try {
      const [departmentsData, currenciesData] = await Promise.all([
        loadDepartments(),
        loadCurrencies(),
      ])
      // 添加总部选项到项目列表
      const departmentsList = departmentsData.map(d => ({ id: d.value as string, name: d.label }))
      // 无论数据库中是否存在"总部"项目，都添加 id 为 'hq' 的选项（用于区分）
      // 检查是否已经有 id 为 'hq' 的选项
      const hqIdExists = departmentsList.find(d => d.id === 'hq')
      if (!hqIdExists) {
        // 检查是否已存在名为"总部"的项目
        const hqNameExists = departmentsList.find(d => d.name === '总部')
        if (!hqNameExists) {
          // 如果既没有 id 为 'hq' 的，也没有名为"总部"的，添加一个
          departmentsList.unshift({ id: 'hq', name: '总部' })
        } else {
          // 如果存在名为"总部"但 id 不是 'hq' 的项目，也添加一个 id 为 'hq' 的选项
          departmentsList.unshift({ id: 'hq', name: '总部' })
        }
      }
      setDepartments(departmentsList)
      setCurrencies(currenciesData.map(c => ({ 
        code: c.value as string, 
        name: c.label.split(' - ')[1] || c.label,
        active: 1
      })))
      // 不再在初始化时加载所有部门的部门，只在用户选择项目时按需加载
      // 初始化时不加载职位，等用户选择项目/总部后再加载
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }, [])

  // 从权限管理获取职位，根据项目/总部过滤（遵循层级划分原则）
  const loadAvailablePositions = useCallback(async (projectId?: string) => {
    try {
      // 从权限管理接口获取所有活跃职位
      const results = await apiGet(api.positionPermissions)
      
      // 根据项目/总部过滤职位
      let filteredPositions: any[] = []
      
      if (!projectId) {
        // 如果还没有选择项目，显示所有职位
        filteredPositions = Array.isArray(results) 
          ? results.filter((p: any) => p.active === 1)
          : []
      } else if (projectId === 'hq') {
        // 总部：只显示 hq 级别的职位
        filteredPositions = Array.isArray(results)
          ? results.filter((p: any) => p.active === 1 && p.level === 'hq')
          : []
      } else {
        // 项目：显示 project/department/group/employee 级别的职位（不包括 hq）
        filteredPositions = Array.isArray(results)
          ? results.filter((p: any) => p.active === 1 && p.level !== 'hq')
          : []
      }
      
      setPositions(filteredPositions)
      
      if (filteredPositions.length === 0 && projectId) {
        const projectType = projectId === 'hq' ? '总部' : '项目'
        message.warning({
          content: (
            <div>
              <p>该{projectType}暂无可用职位。</p>
              <p style={{ marginTop: 8 }}>
                请前往 <strong style={{ color: '#1890ff' }}>权限管理</strong> 页面创建{projectType}职位并配置权限。
              </p>
            </div>
          ),
          duration: 8,
        })
      }
    } catch (error: any) {
      console.error('Failed to load positions:', error)
      message.error(`加载职位列表失败: ${error.message || '网络错误'}`)
      setPositions([])
    }
  }, [])

  const loadOrgDepartments = useCallback(async (projectId: string) => {
    if (!projectId) {
      setOrgDepartments([])
      return
    }
    try {
      // 如果选择的是总部，使用 'hq' 作为参数
      const queryParam = projectId === 'hq' ? 'hq' : projectId
      const data = await apiGet(`${api.orgDepartments}?project_id=${queryParam}`)
      setOrgDepartments(data ?? [])
    } catch (error: any) {
      message.error(`加载部门列表失败: ${error.message || '网络错误'}`)
      setOrgDepartments([])
    }
  }, [])

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const loadDormitoryAllocations = async (employeeId: string) => {
    try {
      const allocations = await apiGet(`${api.rentalPropertiesAllocations}?employee_id=${employeeId}`)
      setDormitoryAllocations(Array.isArray(allocations) ? allocations : [])
    } catch (error: any) {
      // 404错误可能是员工还没有宿舍分配记录，这是正常情况，静默处理
      if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('404')) {
        setDormitoryAllocations([])
      } else {
        console.error('Failed to load dormitory allocations:', error)
        setDormitoryAllocations([])
      }
    }
  }

  const loadRentalProperties = async () => {
    try {
      const properties = await apiGet(`${api.rentalProperties}?property_type=dormitory&status=active`)
      setRentalProperties(properties)
    } catch (error: any) {
      message.error(error.message || '加载宿舍列表失败')
    }
  }

  // 使用 useMemo 优化过滤后的员工列表
  const filteredEmployees = useMemo(() => {
    if (!selectedDepartmentId && statusFilter === 'all') {
      return employees
    }
    return employees.filter(emp => {
      if (selectedDepartmentId && emp.department_id !== selectedDepartmentId) {
        return false
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          return emp.active === 1 && emp.status !== 'resigned'
        }
        return emp.status === statusFilter
      }
      return true
    })
  }, [employees, selectedDepartmentId, statusFilter])

  // 使用 useCallback 优化事件处理函数
  const handleCreate = useCallback(async () => {
    const v = await createForm.validateFields()
    
    // 处理多币种底薪数据（必填）
    const probationSalaries = v.probation_salaries
      .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
      .map((s: any) => ({
        currency_id: s.currency_id,
        amount_cents: Math.round(s.amount_cents * 100),
      }))
    
    const regularSalaries = v.regular_salaries
      .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
      .map((s: any) => ({
        currency_id: s.currency_id,
        amount_cents: Math.round(s.amount_cents * 100),
      }))
    
    // 计算默认币种底薪（用于兼容，使用第一个币种或USDT）
    const usdtProbation = probationSalaries.find((s: any) => s.currency_id === 'USDT')
    const defaultProbationCents = usdtProbation ? usdtProbation.amount_cents : probationSalaries[0]?.amount_cents || 0
    
    const usdtRegular = regularSalaries.find((s: any) => s.currency_id === 'USDT')
    const defaultRegularCents = usdtRegular ? usdtRegular.amount_cents : regularSalaries[0]?.amount_cents || 0
    
    try {
      const data = await apiPost(api.employees, {
        name: v.name,
        department_id: v.department_id,
        org_department_id: v.org_department_id,
        position_id: v.position_id,
        join_date: v.join_date.format('YYYY-MM-DD'),
        probation_salary_cents: defaultProbationCents,
        regular_salary_cents: defaultRegularCents,
        probation_salaries: probationSalaries,
        regular_salaries: regularSalaries,
        phone: combinePhone(v.phone_country_code || '+971', v.phone_number || ''),
        email: v.email,
        usdt_address: v.usdt_address,
        emergency_contact: v.emergency_contact,
        emergency_phone: combinePhone(v.emergency_phone_country_code || '+971', v.emergency_phone_number || ''),
        address: v.address,
        memo: v.memo,
        birthday: v.birthday.format('YYYY-MM-DD'),
      })
      
      // 处理多币种补贴数据
      const livingAllowances = v.living_allowances
        ?.filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
        .map((s: any) => ({
          currency_id: s.currency_id,
          amount_cents: Math.round(s.amount_cents * 100),
        })) || []
      
      const housingAllowances = v.housing_allowances
        ?.filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
        .map((s: any) => ({
          currency_id: s.currency_id,
          amount_cents: Math.round(s.amount_cents * 100),
        })) || []
      
      const transportationAllowances = v.transportation_allowances
        ?.filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
        .map((s: any) => ({
          currency_id: s.currency_id,
          amount_cents: Math.round(s.amount_cents * 100),
        })) || []
      
      const mealAllowances = v.meal_allowances
        ?.filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
        .map((s: any) => ({
          currency_id: s.currency_id,
          amount_cents: Math.round(s.amount_cents * 100),
        })) || []
      
      // 保存多币种补贴配置
      const allowancePromises = []
      if (livingAllowances.length > 0) {
        allowancePromises.push(apiPut(api.employeeAllowancesBatch, {
          employee_id: data.id,
          allowance_type: 'living',
          allowances: livingAllowances,
        }))
      }
      
      if (housingAllowances.length > 0) {
        allowancePromises.push(apiPut(api.employeeAllowancesBatch, {
          employee_id: data.id,
          allowance_type: 'housing',
          allowances: housingAllowances,
        }))
      }
      
      if (transportationAllowances.length > 0) {
        allowancePromises.push(apiPut(api.employeeAllowancesBatch, {
          employee_id: data.id,
          allowance_type: 'transportation',
          allowances: transportationAllowances,
        }))
      }
      
      if (mealAllowances.length > 0) {
        allowancePromises.push(apiPut(api.employeeAllowancesBatch, {
          employee_id: data.id,
          allowance_type: 'meal',
          allowances: mealAllowances,
        }))
      }
      
      if (allowancePromises.length > 0) {
        await Promise.all(allowancePromises)
      }
      
      // 显示账号创建成功的信息
      if (data.user_account_created) {
        Modal.success({
          title: '创建成功',
          width: 500,
          content: (
            <div style={{ marginTop: 16 }}>
              <p>员工信息已创建成功！</p>
              <p style={{ marginTop: 8, fontWeight: 'bold', color: '#1890ff' }}>
                系统已自动为该员工创建登录账号
              </p>
              <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <p style={{ margin: '4px 0' }}><strong>员工邮箱：</strong>{data.email || v.email}</p>
                <p style={{ margin: '4px 0' }}><strong>用户角色：</strong>{ROLE_LABELS[data.user_role || v.user_role || 'employee'] || data.user_role || v.user_role || 'employee'}</p>
                {data.email_sent ? (
                  <>
                    <p style={{ margin: '8px 0', color: '#52c41a', fontWeight: 'bold' }}>
                      ✓ 登录信息已发送至邮箱
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#999' }}>
                      系统已自动发送包含登录地址和随机密码的邮件到员工邮箱，请提醒员工查收
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#ff4d4f' }}>
                    ⚠️ 邮件发送失败，请联系系统管理员
                  </p>
                )}
              </div>
              <div style={{ marginTop: 12, padding: 10, background: '#fff3cd', borderRadius: 4, fontSize: '12px', color: '#856404' }}>
                <strong>提示：</strong>首次登录时系统会要求修改密码，请提醒员工妥善保管登录信息
              </div>
            </div>
          ),
          okText: '我知道了',
        })
      } else {
        message.success('创建成功')
      }
      setCreateOpen(false)
      createForm.resetFields()
      setOrgDepartments([])
      createForm.setFieldsValue({
        probation_salaries: [{ currency_id: undefined, amount_cents: undefined }],
        regular_salaries: [{ currency_id: undefined, amount_cents: undefined }],
        living_allowances: [],
        housing_allowances: [],
        transportation_allowances: [],
        meal_allowances: [],
      })
      loadEmployees()
    } catch (error: any) {
      handleConflictError(error, '员工', 'name')
    }
  }, [createForm, loadEmployees])

  const handleEdit = useCallback((employee: Employee) => {
    setCurrentEmployee(employee)
    const phoneParsed = parsePhone(employee.phone)
    const emergencyPhoneParsed = parsePhone(employee.emergency_phone)
    // 确定项目ID：如果是总部，使用'hq'；否则使用department_id
    const projectId = employee.department_name === '总部' ? 'hq' : employee.department_id
    editForm.setFieldsValue({
      name: employee.name,
      project_id: projectId,
      department_id: projectId === 'hq' ? 'hq' : employee.department_id,
      org_department_id: employee.org_department_id,
      position_id: (employee as any).position_id,
      join_date: dayjs(employee.join_date),
      probation_salary_cents: employee.probation_salary_cents / 100,
      regular_salary_cents: employee.regular_salary_cents / 100,
      active: employee.active,
      phone_country_code: phoneParsed.countryCode,
      phone_number: phoneParsed.phoneNumber,
      email: employee.email,
      living_allowance_cents: employee.living_allowance_cents ? employee.living_allowance_cents / 100 : undefined,
      housing_allowance_cents: employee.housing_allowance_cents ? employee.housing_allowance_cents / 100 : undefined,
      transportation_allowance_cents: employee.transportation_allowance_cents ? employee.transportation_allowance_cents / 100 : undefined,
      meal_allowance_cents: employee.meal_allowance_cents ? employee.meal_allowance_cents / 100 : undefined,
      usdt_address: employee.usdt_address,
      emergency_contact: employee.emergency_contact,
      emergency_phone_country_code: emergencyPhoneParsed.countryCode,
      emergency_phone_number: emergencyPhoneParsed.phoneNumber,
      address: employee.address,
      memo: employee.memo,
      birthday: employee.birthday ? dayjs(employee.birthday) : undefined,
    })
    // 加载该项目的部门列表和职位列表（如果是总部，使用'hq'）
    loadOrgDepartments(projectId)
    loadAvailablePositions(projectId)
    loadDormitoryAllocations(employee.id)
    loadRentalProperties()
    setEditOpen(true)
  }, [editForm, loadOrgDepartments, loadAvailablePositions, loadDormitoryAllocations, loadRentalProperties])

  const handleUpdate = useCallback(async () => {
    const v = await editForm.validateFields()
    if (!currentEmployee) return
    try {
      await apiPut(api.employeesById(currentEmployee.id), {
        name: v.name,
        department_id: v.department_id,
        org_department_id: v.org_department_id,
        position_id: v.position_id,
        join_date: v.join_date.format('YYYY-MM-DD'),
        probation_salary_cents: Math.round(v.probation_salary_cents * 100),
        regular_salary_cents: Math.round(v.regular_salary_cents * 100),
        active: v.active,
        phone: combinePhone(v.phone_country_code || '+971', v.phone_number || ''),
        email: v.email,
        usdt_address: v.usdt_address,
        emergency_contact: v.emergency_contact,
        emergency_phone: combinePhone(v.emergency_phone_country_code || '+971', v.emergency_phone_number || ''),
        address: v.address,
        memo: v.memo,
        birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : undefined,
      })
      message.success('更新成功')
      setEditOpen(false)
      setCurrentEmployee(null)
      editForm.resetFields()
      loadEmployees()
    } catch (error: any) {
      handleConflictError(error, '员工', 'name')
    }
  }, [editForm, currentEmployee, loadEmployees])

  const handleRegularize = (employee: Employee) => {
    setCurrentEmployee(employee)
    regularizeForm.setFieldsValue({
      regular_date: employee.regular_date ? dayjs(employee.regular_date) : dayjs(),
    })
    setRegularizeOpen(true)
  }

  const handleRegularizeConfirm = async () => {
    const v = await regularizeForm.validateFields()
    if (!currentEmployee) return
    try {
      await apiPost(api.employeesRegularize(currentEmployee.id), {
        regular_date: v.regular_date.format('YYYY-MM-DD'),
      })
      message.success('转正成功')
      setRegularizeOpen(false)
      setCurrentEmployee(null)
      regularizeForm.resetFields()
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '转正失败')
    }
  }

  const handleLeave = (employee: Employee) => {
    setCurrentEmployee(employee)
    leaveForm.setFieldsValue({
      leave_date: dayjs(),
      leave_type: 'resigned',
      disable_account: true,
    })
    setLeaveOpen(true)
  }

  const handleLeaveConfirm = async () => {
    const v = await leaveForm.validateFields()
    if (!currentEmployee) return
    try {
      await apiPost(api.employeesLeave(currentEmployee.id), {
        leave_date: v.leave_date.format('YYYY-MM-DD'),
        leave_type: v.leave_type,
        leave_reason: v.leave_reason,
        leave_memo: v.leave_memo,
        disable_account: v.disable_account,
      })
      message.success('离职办理成功')
      setLeaveOpen(false)
      setCurrentEmployee(null)
      leaveForm.resetFields()
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '离职办理失败')
    }
  }

  const handleRejoin = (employee: Employee) => {
    setCurrentEmployee(employee)
    rejoinForm.setFieldsValue({
      join_date: dayjs(employee.join_date),
      enable_account: true,
    })
    setRejoinOpen(true)
  }

  const handleRejoinConfirm = async () => {
    const v = await rejoinForm.validateFields()
    if (!currentEmployee) return
    try {
      await apiPost(api.employeesRejoin(currentEmployee.id), {
        join_date: v.join_date.format('YYYY-MM-DD'),
        enable_account: v.enable_account,
      })
      message.success('重新入职成功')
      setRejoinOpen(false)
      setCurrentEmployee(null)
      rejoinForm.resetFields()
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '重新入职失败')
    }
  }

  const handleSalaryConfig = async (employee: Employee, type: 'probation' | 'regular') => {
    setCurrentEmployee(employee)
    setSalaryConfigType(type)
    
    // 加载该员工的多币种底薪配置
    try {
      const salaries = await apiGet(`${api.employeeSalaries}?employee_id=${employee.id}&salary_type=${type}`)
      setEmployeeSalaries(salaries)
      
      // 设置表单初始值
      salaryConfigForm.setFieldsValue({
        salaries: salaries.length > 0 
          ? salaries.map((s: any) => ({
              currency_id: s.currency_id,
              amount_cents: s.amount_cents / 100,
            }))
          : [{ currency_id: undefined, amount_cents: undefined }]
      })
      
      setSalaryConfigOpen(true)
    } catch (error: any) {
      message.error(error.message || '加载底薪配置失败')
    }
  }

  const handleSaveSalaries = async () => {
    if (!currentEmployee) return
    
    const v = await salaryConfigForm.validateFields()
    const salaries = v.salaries
      .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
      .map((s: any) => ({
        currency_id: s.currency_id,
        amount_cents: Math.round(s.amount_cents * 100),
      }))
    
    try {
      await apiPut(api.employeeSalariesBatch, {
        employee_id: currentEmployee.id,
        salary_type: salaryConfigType,
        salaries,
      })
      message.success('多币种底薪配置保存成功')
      setSalaryConfigOpen(false)
      setCurrentEmployee(null)
      salaryConfigForm.resetFields()
      setEmployeeSalaries([])
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const handleAllowanceConfig = async (employee: Employee, type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday') => {
    setCurrentEmployee(employee)
    setAllowanceConfigType(type)
    
    // 加载该员工的多币种补贴配置
    try {
      const allowances = await apiGet(`${api.employeeAllowances}?employee_id=${employee.id}&allowance_type=${type}`)
      setEmployeeAllowances(allowances)
      
      // 设置表单初始值
      allowanceConfigForm.setFieldsValue({
        allowances: allowances.length > 0 
          ? allowances.map((s: any) => ({
              currency_id: s.currency_id,
              amount_cents: s.amount_cents / 100,
            }))
          : [{ currency_id: undefined, amount_cents: undefined }]
      })
      
      setAllowanceConfigOpen(true)
    } catch (error: any) {
      message.error(error.message || '加载补贴配置失败')
    }
  }

  const handleSaveAllowances = async () => {
    if (!currentEmployee) return
    
    const v = await allowanceConfigForm.validateFields()
    const allowances = v.allowances
      .filter((s: any) => s.currency_id && s.amount_cents !== undefined && s.amount_cents !== null)
      .map((s: any) => ({
        currency_id: s.currency_id,
        amount_cents: Math.round(s.amount_cents * 100),
      }))
    
    try {
      await apiPut(api.employeeAllowancesBatch, {
        employee_id: currentEmployee.id,
        allowance_type: allowanceConfigType,
        allowances,
      })
      message.success('多币种补贴配置保存成功')
      setAllowanceConfigOpen(false)
      setCurrentEmployee(null)
      allowanceConfigForm.resetFields()
      setEmployeeAllowances([])
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const handleDelete = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(api.employeesById(id))
      message.success('删除成功')
      loadEmployees()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [loadEmployees])

  // 使用 useMemo 优化表格列定义
  const columns: ColumnsType<Employee> = useMemo(() => [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '项目',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'org_department_name',
      key: 'org_department_name',
      width: 120,
      render: (text: string, record: Employee) => {
        if (!text) return '-'
        return (
          <span>
            {text}
            {record.org_department_code && <span style={{ color: '#999', fontSize: '12px' }}> ({record.org_department_code})</span>}
          </span>
        )
      },
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone: string) => {
        if (!phone) return '-'
        // 如果有+号，显示格式化的号码
        if (phone.includes('+')) {
          const match = phone.match(/^(\+\d{1,4})(\d+)$/)
          if (match) {
            return `${match[1]} ${match[2]}`
          }
        }
        return phone
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 150,
      render: (email: string) => email || '-',
    },
    {
      title: '入职日期',
      dataIndex: 'join_date',
      key: 'join_date',
      width: 110,
      render: (date: string) => date,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: Employee) => {
        if (status === 'resigned') {
          return <Tag color="red">已离职</Tag>
        } else if (status === 'regular') {
          return <Tag color="green">已转正</Tag>
        } else {
          return <Tag color="orange">试用期</Tag>
        }
      },
      filters: [
        { text: '全部', value: 'all' },
        { text: '在职', value: 'active' },
        { text: '试用期', value: 'probation' },
        { text: '已转正', value: 'regular' },
        { text: '已离职', value: 'resigned' },
      ],
      filteredValue: statusFilter !== 'all' ? [statusFilter] : null,
      onFilter: (value, record) => {
        if (value === 'active') {
          return record.active === 1 && record.status !== 'resigned'
        }
        return record.status === value
      },
    },
    {
      title: '用户账号',
      key: 'user_account',
      width: 120,
      render: (_: any, record: Employee) => {
        if (!record.user_id) {
          return <Tag color="default">未创建</Tag>
        }
        if (record.user_active === 0) {
          return <Tag color="red">已停用</Tag>
        }
        return (
          <Tag color="green">
            {record.user_role ? ROLE_LABELS[record.user_role] || record.user_role : '已启用'}
          </Tag>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 380,
      render: (_: any, record: Employee) => (
        <Space size="small" wrap>
          {canEdit && record.status !== 'resigned' && (
            <>
              <Button size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button size="small" onClick={() => handleSalaryConfig(record, 'probation')}>
                试用期底薪
              </Button>
              <Button size="small" onClick={() => handleSalaryConfig(record, 'regular')}>
                转正底薪
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'living',
                      label: '生活补贴',
                      onClick: () => handleAllowanceConfig(record, 'living'),
                    },
                    {
                      key: 'housing',
                      label: '住房补贴',
                      onClick: () => handleAllowanceConfig(record, 'housing'),
                    },
                    {
                      key: 'transportation',
                      label: '交通补贴',
                      onClick: () => handleAllowanceConfig(record, 'transportation'),
                    },
                    {
                      key: 'meal',
                      label: '伙食补贴',
                      onClick: () => handleAllowanceConfig(record, 'meal'),
                    },
                    {
                      key: 'birthday',
                      label: '生日补贴',
                      onClick: () => handleAllowanceConfig(record, 'birthday'),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button size="small" icon={<SettingOutlined />}>
                  补贴配置
                </Button>
              </Dropdown>
              {record.status === 'probation' && (
                <Button size="small" type="primary" onClick={() => handleRegularize(record)}>
                  转正
                </Button>
              )}
              <Button size="small" danger onClick={() => handleLeave(record)}>
                离职
              </Button>
            </>
          )}
          {canEdit && record.status === 'resigned' && (
            <Button size="small" type="primary" onClick={() => handleRejoin(record)}>
              重新入职
            </Button>
          )}
          {isManager && record.user_id && (
            <>
              <Button size="small" onClick={() => { setResetUser(record); setResetUserOpen(true); resetUserForm.resetFields() }}>
                重置密码
              </Button>
              <Button size="small" onClick={async () => {
                try {
                  await apiPost(`${api.users}/${record.user_id}/toggle-active`, { active: record.user_active === 1 ? 0 : 1 })
                  message.success(record.user_active === 1 ? '已停用账号' : '已启用账号')
                  loadEmployees()
                } catch (error: any) {
                  message.error(error.message || '操作失败')
                }
              }}>{record.user_active === 1 ? '停用账号' : '启用账号'}</Button>
            </>
          )}
          {isManager && (
            <Popconfirm
              title={`确定要删除员工"${record.name}"吗？`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [canEdit, isManager, statusFilter, handleEdit, handleDelete, handleRegularize, handleLeave, handleRejoin, handleSalaryConfig, handleAllowanceConfig])

  return (
    <Card
      title="人员管理"
      extra={
        canEdit && (
          <Space>
            <Button type="primary" onClick={() => {
              setCreateOpen(true)
              createForm.resetFields()
              setOrgDepartments([])
              setPositions([])
              createForm.setFieldsValue({
                probation_salaries: [{ currency_id: undefined, amount_cents: undefined }],
                regular_salaries: [{ currency_id: undefined, amount_cents: undefined }],
                living_allowances: [],
                housing_allowances: [],
                transportation_allowances: [],
                meal_allowances: [],
              })
            }}>
              新建员工
            </Button>
          </Space>
        )
      }
    >
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>员工管理</div>
          <Table
        columns={columns}
        dataSource={filteredEmployees}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions bordered size="small" column={2} style={{ margin: '8px 0' }}>
              <Descriptions.Item label="试用期工资">{(record.probation_salary_cents / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="转正工资">{(record.regular_salary_cents / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="转正日期">{record.regular_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="生活补贴">{((record.living_allowance_cents || 0) / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="住房补贴">{((record.housing_allowance_cents || 0) / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="交通补贴">{((record.transportation_allowance_cents || 0) / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="伙食补贴">{((record.meal_allowance_cents || 0) / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="补贴合计">{(((record.living_allowance_cents || 0) + (record.housing_allowance_cents || 0) + (record.transportation_allowance_cents || 0) + (record.meal_allowance_cents || 0)) / 100).toFixed(2)}</Descriptions.Item>
              {record.status === 'resigned' && (
                <>
                  <Descriptions.Item label="离职日期">{record.leave_date || '-'}</Descriptions.Item>
                  <Descriptions.Item label="离职类型">
                    {record.leave_type === 'resigned' ? '主动离职' :
                     record.leave_type === 'terminated' ? '被动离职' :
                     record.leave_type === 'expired' ? '合同到期' :
                     record.leave_type === 'retired' ? '退休' :
                     record.leave_type === 'other' ? '其他' : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="离职原因">{record.leave_reason || '-'}</Descriptions.Item>
                  <Descriptions.Item label="离职备注">{record.leave_memo || '-'}</Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="USDT地址">{record.usdt_address || '-'}</Descriptions.Item>
              <Descriptions.Item label="紧急联系人">{record.emergency_contact || '-'}</Descriptions.Item>
              <Descriptions.Item label="紧急联系人电话">
                {record.emergency_phone ? (
                  record.emergency_phone.includes('+') ? (
                    (() => {
                      const match = record.emergency_phone.match(/^(\+\d{1,4})(\d+)$/)
                      return match ? `${match[1]} ${match[2]}` : record.emergency_phone
                    })()
                  ) : record.emergency_phone
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{record.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="生日">{record.birthday || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{record.memo || '-'}</Descriptions.Item>
              {record.user_id && (
                <>
                  <Descriptions.Item label="用户账号状态">
                    {record.user_active === 1 ? <Tag color="green">已启用</Tag> : <Tag color="red">已停用</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="用户角色">
                    {record.user_role ? ROLE_LABELS[record.user_role] || record.user_role : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近登录">
                    {record.user_last_login_at ? new Date(record.user_last_login_at).toLocaleString() : '从未登录'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          ),
        }}
      />
        </div>
      </div>

      <Modal
        title="新建员工"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
          setOrgDepartments([])
          setPositions([])
          createForm.setFieldsValue({
            probation_salaries: [{ currency_id: undefined, amount_cents: undefined }],
            regular_salaries: [{ currency_id: undefined, amount_cents: undefined }],
            living_allowances: [],
            housing_allowances: [],
            transportation_allowances: [],
            meal_allowances: [],
          })
        }}
        okText="创建"
        cancelText="取消"
        width={800}
      >
        <Form form={createForm} layout="vertical" initialValues={{
          probation_salaries: [{ currency_id: undefined, amount_cents: undefined }],
          regular_salaries: [{ currency_id: undefined, amount_cents: undefined }],
          living_allowances: [],
          housing_allowances: [],
          transportation_allowances: [],
          meal_allowances: [],
        }}>
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item
                name="project_id"
                label="项目归属/总部"
                rules={[{ required: true, message: '请选择项目归属或总部' }]}
              >
                <Select 
                  placeholder="请选择项目归属或总部"
                  allowClear
                  onChange={(value) => {
                    // 清空部门和职位选择
                    createForm.setFieldsValue({ 
                      org_department_id: undefined, 
                      position_id: undefined,
                      department_id: value === 'hq' ? 'hq' : value
                    })
                    // 加载对应的部门列表和职位列表
                    if (value) {
                      loadOrgDepartments(value)
                      loadAvailablePositions(value)
                    } else {
                      setOrgDepartments([])
                      setPositions([])
                    }
                  }}
                >
                  <Option value="hq">总部</Option>
                  {departments.filter(d => d.id !== 'hq').map((dept) => (
                    <Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="org_department_id"
                label="部门"
                rules={[{ required: true, message: '请选择部门' }]}
              >
                <Select 
                  placeholder={createForm.getFieldValue('project_id') ? '请选择部门' : '请先选择项目归属或总部'}
                  showSearch
                  disabled={!createForm.getFieldValue('project_id')}
                  filterOption={(input, option) => {
                    const label = typeof option?.label === 'string' ? option.label : String(option?.label ?? '')
                    return label.toLowerCase().includes(input.toLowerCase())
                  }}
                  onChange={() => {
                    // 部门选择变化时，职位列表保持不变（职位已从权限管理加载）
                  }}
                >
                  {orgDepartments.filter(d => d.active === 1).map((dept) => (
                    <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''}`}>
                      {dept.name}{dept.code ? ` (${dept.code})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="department_id"
                label="项目"
                hidden
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="position_id"
                label="职位"
                rules={[{ required: true, message: '请选择职位' }]}
                extra={
                  positions.length === 0 ? (
                    <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: 4 }}>
                      暂无可用职位，请前往{' '}
                      <a 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          // 触发页面切换事件（通过自定义事件）
                          window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'position-permissions' } }))
                        }}
                        style={{ color: '#1890ff' }}
                      >
                        权限管理
                      </a>
                      {' '}页面创建职位并配置权限
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                      职位来自权限管理，已绑定权限配置
                    </div>
                  )
                }
              >
                <Select 
                  placeholder={createForm.getFieldValue('project_id') ? '请选择职位' : '请先选择项目归属或总部'}
                  disabled={!createForm.getFieldValue('project_id')}
                  showSearch
                  filterOption={(input, option) => {
                    const children = option?.children
                    if (Array.isArray(children)) return false
                    const text = typeof children === 'string' ? children : String(children ?? '')
                    return text.toLowerCase().includes(input.toLowerCase())
                  }}
                >
                  {positions.map((pos) => (
                    <Option key={pos.id} value={pos.id}>
                      {pos.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="join_date"
                label="入职日期"
                rules={[{ required: true, message: '请选择入职日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item
                name="birthday"
                label="生日"
                rules={[{ required: true, message: '请选择生日' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="请选择生日" />
              </Form.Item>
            </TabPane>
            <TabPane tab="系统账号" key="account">
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入正确的邮箱地址' }]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              <div style={{ color: '#999', fontSize: '12px', marginTop: '-16px', marginBottom: '16px' }}>
                提示：用户角色将根据所选职位自动确定，无需手动设置
              </div>
            </TabPane>
            <TabPane tab="薪资与补贴" key="salary">
              <Form.Item
                name="probation_salaries"
                label="试用期多币种底薪"
                rules={[
                  { required: true, message: '请至少添加一种币种的底薪' },
                  {
                    validator: async (_, values) => {
                      if (!values || values.length === 0) {
                        return Promise.reject(new Error('请至少添加一种币种的底薪'))
                      }
                      const validSalaries = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                      if (validSalaries.length === 0) {
                        return Promise.reject(new Error('请至少添加一种币种的底薪'))
                      }
                      const currencyIds = validSalaries.map((s: any) => s.currency_id)
                      const uniqueCurrencies = new Set(currencyIds)
                      if (uniqueCurrencies.size !== currencyIds.length) {
                        return Promise.reject(new Error('不能重复添加同一种币种'))
                      }
                    },
                  },
                ]}
              >
                <Form.List name="probation_salaries">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                          <Form.Item
                            {...restField}
                            name={[name, 'currency_id']}
                            rules={[{ required: true, message: '请选择币种' }]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <Select 
                              id={`probation_salary_currency_${name}`}
                              placeholder="选择币种" 
                              style={{ width: '100%' }}
                            >
                              {currencies.map((c) => (
                                <Option key={c.code} value={c.code}>
                                  {c.code} - {c.name}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'amount_cents']}
                            rules={[{ required: true, message: '请输入底薪金额' }]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <InputNumber
                              id={`probation_salary_amount_${name}`}
                              placeholder="底薪金额"
                              style={{ width: '100%' }}
                              min={0}
                              precision={2}
                            />
                          </Form.Item>
                          {fields.length > 1 && (
                            <Button onClick={() => remove(name)} danger size="small">
                              删除
                            </Button>
                          )}
                        </Space>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                          添加币种底薪
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
              <Form.Item
                name="regular_salaries"
                label="转正多币种底薪"
                rules={[
                  { required: true, message: '请至少添加一种币种的底薪' },
                  {
                    validator: async (_, values) => {
                      if (!values || values.length === 0) {
                        return Promise.reject(new Error('请至少添加一种币种的底薪'))
                      }
                      const validSalaries = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                      if (validSalaries.length === 0) {
                        return Promise.reject(new Error('请至少添加一种币种的底薪'))
                      }
                      const currencyIds = validSalaries.map((s: any) => s.currency_id)
                      const uniqueCurrencies = new Set(currencyIds)
                      if (uniqueCurrencies.size !== currencyIds.length) {
                        return Promise.reject(new Error('不能重复添加同一种币种'))
                      }
                    },
                  },
                ]}
              >
                <Form.List name="regular_salaries">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                          <Form.Item
                            {...restField}
                            name={[name, 'currency_id']}
                            rules={[{ required: true, message: '请选择币种' }]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <Select 
                              id={`regular_salary_currency_${name}`}
                              placeholder="选择币种" 
                              style={{ width: '100%' }}
                            >
                              {currencies.map((c) => (
                                <Option key={c.code} value={c.code}>
                                  {c.code} - {c.name}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'amount_cents']}
                            rules={[{ required: true, message: '请输入底薪金额' }]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <InputNumber
                              id={`regular_salary_amount_${name}`}
                              placeholder="底薪金额"
                              style={{ width: '100%' }}
                              min={0}
                              precision={2}
                            />
                          </Form.Item>
                          <Button onClick={() => remove(name)} danger size="small">
                            删除
                          </Button>
                        </Space>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                          添加币种底薪
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
              <div style={{ color: '#999', fontSize: '12px', marginTop: '-16px', marginBottom: '16px' }}>
                提示：请至少为每种底薪类型配置一种币种，系统将使用多币种底薪配置生成薪资单
              </div>
              
              <div style={{ marginTop: '24px', marginBottom: '16px', borderTop: '1px solid #e8e8e8', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>补贴设置（可选）</div>
                
                <Form.Item name="living_allowances" label="生活补贴">
                  <Form.List name="living_allowances">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'currency_id']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <Select id={`living_allowance_currency_${name}`} placeholder="选择币种" style={{ width: '100%' }}>
                                {currencies.map((c) => (
                                  <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'amount_cents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <InputNumber id={`living_allowance_amount_${name}`} placeholder="金额" style={{ width: '100%' }} min={0} precision={2} />
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger size="small">删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种</Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                
                <Form.Item name="housing_allowances" label="住房补贴">
                  <Form.List name="housing_allowances">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'currency_id']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <Select id={`housing_allowance_currency_${name}`} placeholder="选择币种" style={{ width: '100%' }}>
                                {currencies.map((c) => (
                                  <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'amount_cents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <InputNumber id={`housing_allowance_amount_${name}`} placeholder="金额" style={{ width: '100%' }} min={0} precision={2} />
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger size="small">删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种</Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                
                <Form.Item name="transportation_allowances" label="交通补贴">
                  <Form.List name="transportation_allowances">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'currency_id']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <Select id={`transportation_allowance_currency_${name}`} placeholder="选择币种" style={{ width: '100%' }}>
                                {currencies.map((c) => (
                                  <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'amount_cents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <InputNumber id={`transportation_allowance_amount_${name}`} placeholder="金额" style={{ width: '100%' }} min={0} precision={2} />
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger size="small">删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种</Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                
                <Form.Item name="meal_allowances" label="伙食补贴">
                  <Form.List name="meal_allowances">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'currency_id']} rules={[{ required: true, message: '请选择币种' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <Select id={`meal_allowance_currency_${name}`} placeholder="选择币种" style={{ width: '100%' }}>
                                {currencies.map((c) => (
                                  <Option key={c.code} value={c.code}>{c.code} - {c.name}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'amount_cents']} rules={[{ required: true, message: '请输入金额' }]} style={{ marginBottom: 0, flex: 1 }}>
                              <InputNumber id={`meal_allowance_amount_${name}`} placeholder="金额" style={{ width: '100%' }} min={0} precision={2} />
                            </Form.Item>
                            <Button onClick={() => remove(name)} danger size="small">删除</Button>
                          </Space>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">添加币种</Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                
                <div style={{ color: '#999', fontSize: '12px', marginTop: '16px' }}>
                  提示：补贴每月第一个工作日现金发放，不随工资一起发放
                </div>
              </div>
            </TabPane>
            <TabPane tab="联系方式" key="contact">
              <Form.Item label="手机号">
                <Input.Group compact>
                  <Form.Item
                    name="phone_country_code"
                    noStyle
                    initialValue="+971"
                  >
                    <Select 
                      style={{ width: '30%' }} 
                      showSearch 
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={COUNTRY_CODES.map((country) => ({
                        label: `${country.flag} ${country.code} ${country.name}`,
                        value: country.code,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="phone_number"
                    noStyle
                    rules={[
                      { max: 15, message: '手机号码最多15位' },
                      { pattern: /^\d*$/, message: '只能输入数字' }
                    ]}
                  >
                    <Input
                      style={{ width: '70%' }}
                      placeholder="请输入手机号码"
                      maxLength={15}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }}
                    />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
              <Form.Item
                name="address"
                label="地址"
              >
                <TextArea rows={3} placeholder="请输入地址" />
              </Form.Item>
            </TabPane>
            <TabPane tab="USDT地址" key="usdt">
              <Form.Item
                name="usdt_address"
                label="USDT地址"
              >
                <Input placeholder="请输入USDT地址" />
              </Form.Item>
            </TabPane>
            <TabPane tab="紧急联系人" key="emergency">
              <Form.Item
                name="emergency_contact"
                label="紧急联系人姓名"
              >
                <Input placeholder="请输入紧急联系人姓名" />
              </Form.Item>
              <Form.Item label="紧急联系人电话">
                <Input.Group compact>
                  <Form.Item
                    name="emergency_phone_country_code"
                    noStyle
                    initialValue="+971"
                  >
                    <Select 
                      style={{ width: '30%' }} 
                      showSearch 
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={COUNTRY_CODES.map((country) => ({
                        label: `${country.flag} ${country.code} ${country.name}`,
                        value: country.code,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="emergency_phone_number"
                    noStyle
                    rules={[
                      { max: 15, message: '手机号码最多15位' },
                      { pattern: /^\d*$/, message: '只能输入数字' }
                    ]}
                  >
                    <Input
                      style={{ width: '70%' }}
                      placeholder="请输入手机号码"
                      maxLength={15}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }}
                    />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
            </TabPane>
            <TabPane tab="其他" key="other">
              <Form.Item
                name="memo"
                label="备注"
              >
                <TextArea rows={4} placeholder="请输入备注信息" />
              </Form.Item>
            </TabPane>
          </Tabs>
        </Form>
      </Modal>

      <Modal
        title="编辑员工"
        open={editOpen}
        onOk={handleUpdate}
        onCancel={() => {
          setEditOpen(false)
          setCurrentEmployee(null)
          editForm.resetFields()
          setOrgDepartments([])
          setPositions([])
        }}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <Form form={editForm} layout="vertical">
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item
                name="project_id"
                label="项目归属/总部"
                rules={[{ required: true, message: '请选择项目归属或总部' }]}
              >
                <Select 
                  placeholder="请选择项目归属或总部"
                  allowClear
                  onChange={(value) => {
                    // 清空部门和职位选择
                    editForm.setFieldsValue({ 
                      org_department_id: undefined, 
                      position_id: undefined,
                      department_id: value === 'hq' ? 'hq' : value
                    })
                    // 加载对应的部门列表和职位列表
                    if (value) {
                      loadOrgDepartments(value)
                      loadAvailablePositions(value)
                    } else {
                      setOrgDepartments([])
                      setPositions([])
                    }
                  }}
                >
                  <Option value="hq">总部</Option>
                  {departments.filter(d => d.id !== 'hq').map((dept) => (
                    <Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="org_department_id"
                label="部门"
                rules={[{ required: true, message: '请选择部门' }]}
              >
                <Select 
                  placeholder={editForm.getFieldValue('project_id') ? '请选择部门' : '请先选择项目归属或总部'}
                  showSearch
                  disabled={!editForm.getFieldValue('project_id')}
                  filterOption={(input, option) => {
                    const label = typeof option?.label === 'string' ? option.label : String(option?.label ?? '')
                    return label.toLowerCase().includes(input.toLowerCase())
                  }}
                  onChange={() => {
                    // 部门选择变化时，职位列表保持不变（职位已从权限管理加载）
                  }}
                >
                  {orgDepartments.filter(d => d.active === 1).map((dept) => (
                    <Option key={dept.id} value={dept.id} label={`${dept.name}${dept.code ? ` (${dept.code})` : ''}`}>
                      {dept.name}{dept.code ? ` (${dept.code})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="department_id"
                label="项目"
                hidden
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="position_id"
                label="职位"
                rules={[{ required: true, message: '请选择职位' }]}
                extra={
                  positions.length === 0 ? (
                    <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: 4 }}>
                      暂无可用职位，请前往{' '}
                      <a 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          // 触发页面切换事件（通过自定义事件）
                          window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'position-permissions' } }))
                        }}
                        style={{ color: '#1890ff' }}
                      >
                        权限管理
                      </a>
                      {' '}页面创建职位并配置权限
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                      职位来自权限管理，已绑定权限配置
                    </div>
                  )
                }
              >
                <Select 
                  placeholder={editForm.getFieldValue('project_id') ? '请选择职位' : '请先选择项目归属或总部'}
                  disabled={!editForm.getFieldValue('project_id')}
                  showSearch
                  filterOption={(input, option) => {
                    const children = option?.children
                    if (Array.isArray(children)) return false
                    const text = typeof children === 'string' ? children : String(children ?? '')
                    return text.toLowerCase().includes(input.toLowerCase())
                  }}
                >
                  {positions.map((pos) => (
                    <Option key={pos.id} value={pos.id}>
                      {pos.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="join_date"
                label="入职日期"
                rules={[{ required: true, message: '请选择入职日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item
                name="birthday"
                label="生日"
                rules={[{ required: true, message: '请选择生日' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="请选择生日" />
              </Form.Item>
              <Form.Item
                name="probation_salary_cents"
                label="试用期工资"
                rules={[{ required: true, message: '请输入试用期工资' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入试用期工资"
                />
              </Form.Item>
              <Form.Item
                name="regular_salary_cents"
                label="转正工资"
                rules={[{ required: true, message: '请输入转正工资' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入转正工资"
                />
              </Form.Item>
              <Form.Item
                name="active"
                label="状态"
                valuePropName="checked"
                getValueFromEvent={(e) => (e ? 1 : 0)}
                getValueProps={(value) => ({ checked: value === 1 })}
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
              <Form.Item
                name="living_allowance_cents"
                label="生活补贴"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入生活补贴"
                />
              </Form.Item>
              <Form.Item
                name="housing_allowance_cents"
                label="住房补贴"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入住房补贴"
                />
              </Form.Item>
              <Form.Item
                name="transportation_allowance_cents"
                label="交通补贴"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入交通补贴"
                />
              </Form.Item>
              <Form.Item
                name="meal_allowance_cents"
                label="伙食补贴"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入伙食补贴"
                />
              </Form.Item>
            </TabPane>
            <TabPane tab="联系方式" key="contact">
              <Form.Item label="手机号">
                <Input.Group compact>
                  <Form.Item
                    name="phone_country_code"
                    noStyle
                    initialValue="+971"
                  >
                    <Select 
                      style={{ width: '30%' }} 
                      showSearch 
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={COUNTRY_CODES.map((country) => ({
                        label: `${country.flag} ${country.code} ${country.name}`,
                        value: country.code,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="phone_number"
                    noStyle
                    rules={[
                      { max: 15, message: '手机号码最多15位' },
                      { pattern: /^\d*$/, message: '只能输入数字' }
                    ]}
                  >
                    <Input
                      style={{ width: '70%' }}
                      placeholder="请输入手机号码"
                      maxLength={15}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }}
                    />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
              <Form.Item
                name="address"
                label="地址"
              >
                <TextArea rows={3} placeholder="请输入地址" />
              </Form.Item>
            </TabPane>
            <TabPane tab="USDT地址" key="usdt">
              <Form.Item
                name="usdt_address"
                label="USDT地址"
              >
                <Input placeholder="请输入USDT地址" />
              </Form.Item>
            </TabPane>
            <TabPane tab="紧急联系人" key="emergency">
              <Form.Item
                name="emergency_contact"
                label="紧急联系人姓名"
              >
                <Input placeholder="请输入紧急联系人姓名" />
              </Form.Item>
              <Form.Item label="紧急联系人电话">
                <Input.Group compact>
                  <Form.Item
                    name="emergency_phone_country_code"
                    noStyle
                    initialValue="+971"
                  >
                    <Select 
                      style={{ width: '30%' }} 
                      showSearch 
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={COUNTRY_CODES.map((country) => ({
                        label: `${country.flag} ${country.code} ${country.name}`,
                        value: country.code,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="emergency_phone_number"
                    noStyle
                    rules={[
                      { max: 15, message: '手机号码最多15位' },
                      { pattern: /^\d*$/, message: '只能输入数字' }
                    ]}
                  >
                    <Input
                      style={{ width: '70%' }}
                      placeholder="请输入手机号码"
                      maxLength={15}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }}
                    />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
            </TabPane>
            <TabPane tab="其他" key="other">
              <Form.Item
                name="memo"
                label="备注"
              >
                <TextArea rows={4} placeholder="请输入备注信息" />
              </Form.Item>
            </TabPane>
          </Tabs>
        </Form>
      </Modal>

      <Modal
        title="员工转正"
        open={regularizeOpen}
        onOk={handleRegularizeConfirm}
        onCancel={() => {
          setRegularizeOpen(false)
          setCurrentEmployee(null)
          regularizeForm.resetFields()
        }}
        okText="确认转正"
        cancelText="取消"
      >
        <Form form={regularizeForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentEmployee?.name} disabled />
          </Form.Item>
          <Form.Item label="项目">
            <Input value={currentEmployee?.department_name} disabled />
          </Form.Item>
          <Form.Item
            name="regular_date"
            label="转正日期"
            rules={[{ required: true, message: '请选择转正日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="员工离职"
        open={leaveOpen}
        onOk={handleLeaveConfirm}
        onCancel={() => {
          setLeaveOpen(false)
          setCurrentEmployee(null)
          leaveForm.resetFields()
        }}
        okText="确认离职"
        cancelText="取消"
        width={600}
      >
        <Form form={leaveForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentEmployee?.name} disabled />
          </Form.Item>
          <Form.Item label="项目">
            <Input value={currentEmployee?.department_name} disabled />
          </Form.Item>
          <Form.Item
            name="leave_date"
            label="离职日期"
            rules={[{ required: true, message: '请选择离职日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="leave_type"
            label="离职类型"
            rules={[{ required: true, message: '请选择离职类型' }]}
          >
            <Select>
              <Option value="resigned">主动离职</Option>
              <Option value="terminated">被动离职</Option>
              <Option value="expired">合同到期</Option>
              <Option value="retired">退休</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="leave_reason"
            label="离职原因"
          >
            <TextArea rows={3} placeholder="请输入离职原因" />
          </Form.Item>
          <Form.Item
            name="leave_memo"
            label="离职备注"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item
            name="disable_account"
            label="账号处理"
            valuePropName="checked"
          >
            <Switch checkedChildren="禁用账号" unCheckedChildren="保持启用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="员工重新入职"
        open={rejoinOpen}
        onOk={handleRejoinConfirm}
        onCancel={() => {
          setRejoinOpen(false)
          setCurrentEmployee(null)
          rejoinForm.resetFields()
        }}
        okText="确认重新入职"
        cancelText="取消"
        width={500}
      >
        <Form form={rejoinForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentEmployee?.name} disabled />
          </Form.Item>
          <Form.Item label="项目">
            <Input value={currentEmployee?.department_name} disabled />
          </Form.Item>
          <Form.Item label="原入职日期">
            <Input value={currentEmployee?.join_date} disabled />
          </Form.Item>
          <Form.Item
            name="join_date"
            label="重新入职日期"
            rules={[{ required: true, message: '请选择重新入职日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="enable_account"
            label="账号处理"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用账号" unCheckedChildren="保持禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${currentEmployee?.name} - ${salaryConfigType === 'probation' ? '试用期' : '转正'}多币种底薪配置`}
        open={salaryConfigOpen}
        onOk={handleSaveSalaries}
        onCancel={() => {
          setSalaryConfigOpen(false)
          setCurrentEmployee(null)
          salaryConfigForm.resetFields()
          setEmployeeSalaries([])
        }}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form form={salaryConfigForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentEmployee?.name} disabled />
          </Form.Item>
          <Form.Item label="底薪类型">
            <Input value={salaryConfigType === 'probation' ? '试用期' : '转正'} disabled />
          </Form.Item>
          <Form.Item
            name="salaries"
            label="多币种底薪"
            rules={[
              {
                validator: async (_, values) => {
                  if (!values || values.length === 0) {
                    return Promise.reject(new Error('请至少添加一种币种的底薪'))
                  }
                  const validSalaries = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                  if (validSalaries.length === 0) {
                    return Promise.reject(new Error('请至少添加一种币种的底薪'))
                  }
                  // 检查币种是否重复
                  const currencyIds = validSalaries.map((s: any) => s.currency_id)
                  const uniqueCurrencies = new Set(currencyIds)
                  if (uniqueCurrencies.size !== currencyIds.length) {
                    return Promise.reject(new Error('不能重复添加同一种币种'))
                  }
                },
              },
            ]}
          >
            <Form.List name="salaries">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'currency_id']}
                        rules={[{ required: true, message: '请选择币种' }]}
                      >
                        <Select placeholder="选择币种" style={{ width: 150 }}>
                          {currencies.map((c) => (
                            <Option key={c.code} value={c.code}>
                              {c.code} - {c.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'amount_cents']}
                        rules={[{ required: true, message: '请输入底薪金额' }]}
                      >
                        <InputNumber
                          placeholder="底薪金额"
                          style={{ width: 200 }}
                          min={0}
                          precision={2}
                        />
                      </Form.Item>
                      <Button onClick={() => remove(name)} danger>
                        删除
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加币种底薪
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${currentEmployee?.name} - ${allowanceConfigType === 'living' ? '生活补贴' : allowanceConfigType === 'housing' ? '住房补贴' : allowanceConfigType === 'transportation' ? '交通补贴' : allowanceConfigType === 'meal' ? '伙食补贴' : '生日补贴'}多币种配置`}
        open={allowanceConfigOpen}
        onOk={handleSaveAllowances}
        onCancel={() => {
          setAllowanceConfigOpen(false)
          setCurrentEmployee(null)
          allowanceConfigForm.resetFields()
          setEmployeeAllowances([])
        }}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form form={allowanceConfigForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentEmployee?.name} disabled />
          </Form.Item>
          <Form.Item label="补贴类型">
            <Input 
              value={allowanceConfigType === 'living' ? '生活补贴' : allowanceConfigType === 'housing' ? '住房补贴' : allowanceConfigType === 'transportation' ? '交通补贴' : allowanceConfigType === 'meal' ? '伙食补贴' : '生日补贴'} 
              disabled 
            />
          </Form.Item>
          <Form.Item
            name="allowances"
            label="多币种补贴"
            rules={[
              {
                validator: async (_, values) => {
                  if (!values || values.length === 0) {
                    return Promise.reject(new Error('请至少添加一种币种的补贴'))
                  }
                  const validAllowances = values.filter((s: any) => s.currency_id && s.amount_cents !== undefined)
                  if (validAllowances.length === 0) {
                    return Promise.reject(new Error('请至少添加一种币种的补贴'))
                  }
                  // 检查币种是否重复
                  const currencyIds = validAllowances.map((s: any) => s.currency_id)
                  const uniqueCurrencies = new Set(currencyIds)
                  if (uniqueCurrencies.size !== currencyIds.length) {
                    return Promise.reject(new Error('不能重复添加同一种币种'))
                  }
                },
              },
            ]}
          >
            <Form.List name="allowances">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'currency_id']}
                        rules={[{ required: true, message: '请选择币种' }]}
                      >
                        <Select placeholder="选择币种" style={{ width: 150 }}>
                          {currencies.map((c) => (
                            <Option key={c.code} value={c.code}>
                              {c.code} - {c.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'amount_cents']}
                        rules={[{ required: true, message: '请输入补贴金额' }]}
                      >
                        <InputNumber
                          placeholder="补贴金额"
                          style={{ width: 200 }}
                          min={0}
                          precision={2}
                        />
                      </Form.Item>
                      <Button onClick={() => remove(name)} danger>
                        删除
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加币种补贴
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配宿舍 */}
      <Modal
        title={`分配宿舍：${currentEmployee?.name || ''}`}
        open={dormitoryAllocateOpen}
        onOk={async () => {
          const v = await dormitoryAllocateForm.validateFields()
            try {
              const payload = {
                employee_id: currentEmployee?.id,
                property_id: v.property_id,
                room_number: v.room_number || null,
                bed_number: v.bed_number || null,
                allocation_date: v.allocation_date ? v.allocation_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                monthly_rent_cents: v.monthly_rent_cents ? Math.round(v.monthly_rent_cents * 100) : null,
                memo: v.memo || null,
              }
              
              const property = rentalProperties.find(p => p.id === v.property_id)
              if (!property) {
                message.error('宿舍不存在')
                return
              }
              
              await apiPost(api.rentalPropertiesAllocateDormitory(v.property_id), payload)
              message.success('分配成功')
              setDormitoryAllocateOpen(false)
              dormitoryAllocateForm.resetFields()
              if (currentEmployee) {
                loadDormitoryAllocations(currentEmployee.id)
              }
            } catch (error: any) {
              message.error(error.message || '分配失败')
            }
        }}
        onCancel={() => {
          setDormitoryAllocateOpen(false)
          dormitoryAllocateForm.resetFields()
        }}
        okText="分配"
        cancelText="取消"
        width={600}
      >
        <Form form={dormitoryAllocateForm} layout="vertical">
          <Form.Item name="property_id" label="宿舍" rules={[{ required: true, message: '请选择宿舍' }]}>
            <Select
              placeholder="选择宿舍"
              showSearch
              optionFilterProp="label"
              options={rentalProperties.map(p => ({
                value: p.id,
                label: `${p.property_code} - ${p.name}`
              }))}
            />
          </Form.Item>
          <Form.Item name="room_number" label="房间号">
            <Input placeholder="房间号" />
          </Form.Item>
          <Form.Item name="bed_number" label="床位号">
            <Input placeholder="床位号" />
          </Form.Item>
          <Form.Item name="allocation_date" label="分配日期" rules={[{ required: true, message: '请选择分配日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="monthly_rent_cents" label="员工需支付月租金（如员工需要支付）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="员工月租金" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>


      <Modal title={resetUser ? `重置密码：${resetUser.email}` : '重置密码'} open={resetUserOpen} onCancel={() => setResetUserOpen(false)} onOk={async () => {
        if (!resetUser || !resetUser.user_id) return
        try {
          await apiPost(`${api.users}/${resetUser.user_id}/reset-password`, {})
          message.success('密码已重置，新密码已发送至邮箱')
          setResetUserOpen(false)
          setResetUser(null)
          loadEmployees()
        } catch (error: any) {
          message.error(error.message || '重置失败')
        }
      }}>
        <Form form={resetUserForm} layout="vertical">
          <p>系统将自动生成随机密码并通过邮件发送给用户。</p>
          <p style={{ color: '#999', fontSize: '12px', marginTop: 8 }}>
            用户首次登录时系统会要求修改密码。
          </p>
        </Form>
      </Modal>
    </Card>
  )
}
