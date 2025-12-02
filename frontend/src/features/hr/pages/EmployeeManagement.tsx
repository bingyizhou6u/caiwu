import { useState, useMemo, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, InputNumber, DatePicker, Switch, Tabs, Descriptions, Dropdown } from 'antd'
import { PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { apiGet, apiPost, apiPut, apiDelete, handleConflictError } from '../../../utils/api'
import { useApiQuery, useApiMutation } from '../../../utils/useApiQuery'
import { usePermissions } from '../../../utils/permissions'
import { CreateEmployeeModal } from '../../../features/employees/components/modals/CreateEmployeeModal'
import { EditEmployeeModal } from '../../../features/employees/components/modals/EditEmployeeModal'

const { Option } = Select
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
  work_schedule?: {
    days: number[]
    start: string
    end: string
  }
  annual_leave_cycle_months?: number
  annual_leave_days?: number
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
  position_id?: string  // 职位ID
  position_code?: string  // 职位代码
  position_name?: string  // 职位名称
  position_level?: number  // 职位层级 (1-总部 2-项目 3-组)
  position_function_role?: string  // 职能角色
}

export function EmployeeManagement() {
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

  // 使用新的权限系统
  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canEdit = hasPermission('hr', 'employee', 'update')
  const canCreate = hasPermission('hr', 'employee', 'create')
  const canDelete = hasPermission('hr', 'employee', 'delete')

  // Query Employees
  const employeesUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        params.append('active_only', 'true')
      } else {
        params.append('status', statusFilter)
      }
    }
    return `${api.employees}?${params.toString()}`
  }, [statusFilter])

  const { data: employees = [], refetch: refetchEmployees } = useApiQuery(
    ['employees', statusFilter],
    employeesUrl,
    {
      select: (data: any) => Array.isArray(data) ? data : data?.results || []
    }
  )

  // Query Departments (Projects)
  const { data: departments = [] } = useApiQuery(
    ['departments'],
    api.departments,
    {
      select: (data: any) => {
        const rawList = Array.isArray(data) ? data : data?.results || []
        const list = rawList.map((d: any) => ({ id: d.id, name: d.name }))
        // Add HQ if not present
        const hqIdExists = list.find((d: any) => d.id === 'hq')
        if (!hqIdExists) {
          const hqNameExists = list.find((d: any) => d.name === '总部')
          if (!hqNameExists) {
            list.unshift({ id: 'hq', name: '总部' })
          } else {
            list.unshift({ id: 'hq', name: '总部' })
          }
        }
        return list
      }
    }
  )

  // Query Currencies
  const { data: currencies = [] } = useApiQuery(
    ['currencies'],
    api.currencies,
    {
      select: (data: any) => (Array.isArray(data) ? data : data?.results || []).map((c: any) => ({
        code: c.code,
        name: c.name,
        active: c.active
      }))
    }
  )

  const loadDormitoryAllocations = async (employeeId: string) => {
    try {
      const allocations = await apiGet(`${api.rentalPropertiesAllocations}?employee_id=${employeeId}`)
      setDormitoryAllocations(Array.isArray(allocations) ? allocations : [])
    } catch (error: any) {
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
    return employees
  }, [employees])

  const handleEdit = useCallback((employee: Employee) => {
    setCurrentEmployee(employee)
    setEditOpen(true)
  }, [])



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
      refetchEmployees()
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
      refetchEmployees()
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
      refetchEmployees()
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
      refetchEmployees()
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
      refetchEmployees()
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const handleDelete = useCallback(async (id: string, name: string) => {
    try {
      await apiDelete(api.employeesById(id))
      message.success('删除成功')
      refetchEmployees()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }, [refetchEmployees])

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
      title: '账号权限',
      key: 'account_permission',
      width: 180,
      render: (_: any, record: Employee) => {
        if (!record.user_id) {
          return <Tag color="default">未创建账号</Tag>
        }
        if (record.user_active === 0) {
          return <Tag color="red">账号已停用</Tag>
        }
        // 显示职位信息，与权限管理体系一致（所有员工必须有职位）
        const levelLabels: Record<number, string> = {
          1: '总部',
          2: '项目',
          3: '组',
        }
        const functionRoleLabels: Record<string, string> = {
          director: '主管',
          hr: '人事',
          finance: '财务',
          admin: '行政',
          developer: '开发',
          support: '客服',
          member: '组员',
        }
        const levelLabel = record.position_level ? levelLabels[record.position_level] || `级别${record.position_level}` : ''
        const roleLabel = record.position_function_role ? functionRoleLabels[record.position_function_role] || record.position_function_role : ''
        return (
          <div>
            <div><Tag color="green">{record.position_name}</Tag></div>
            {levelLabel && <div style={{ fontSize: 12, color: '#666' }}>层级: {levelLabel}</div>}
            {roleLabel && <div style={{ fontSize: 12, color: '#666' }}>职能: {roleLabel}</div>}
          </div>
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
                  await apiPost(`${api.auth.login.replace('/login', '')}/users/${record.user_id}/toggle-active`, { active: record.user_active === 1 ? 0 : 1 })
                  message.success(record.user_active === 1 ? '已停用账号' : '已启用账号')
                  refetchEmployees()
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
  ], [canEdit, isManager, statusFilter, handleEdit, handleDelete, handleRegularize, handleLeave, handleRejoin, handleSalaryConfig, handleAllowanceConfig, refetchEmployees])

  return (
    <Card
      title="人员管理"
      extra={
        canEdit && (
          <Space>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建员工
            </Button>
          </Space>
        )
      }
    >
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>人员管理</div>
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
                      <Descriptions.Item label="账号状态">
                        {record.user_active === 1 ? <Tag color="green">已启用</Tag> : <Tag color="red">已停用</Tag>}
                      </Descriptions.Item>
                      {record.position_name && (
                        <>
                          <Descriptions.Item label="职位名称">
                            {record.position_name}
                          </Descriptions.Item>
                          <Descriptions.Item label="职位代码">
                            {record.position_code || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="职位层级">
                            {record.position_level === 1 ? '总部' :
                              record.position_level === 2 ? '项目' :
                                record.position_level === 3 ? '组' :
                                  record.position_level || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="职能角色">
                            {record.position_function_role === 'director' ? '主管' :
                              record.position_function_role === 'hr' ? '人事' :
                                record.position_function_role === 'finance' ? '财务' :
                                  record.position_function_role === 'admin' ? '行政' :
                                    record.position_function_role === 'developer' ? '开发' :
                                      record.position_function_role === 'support' ? '客服' :
                                        record.position_function_role === 'member' ? '组员' :
                                          record.position_function_role || '-'}
                          </Descriptions.Item>
                        </>
                      )}
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

      <CreateEmployeeModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false)
          refetchEmployees()
        }}
        departments={departments}
        currencies={currencies}
      />


      <EditEmployeeModal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setCurrentEmployee(null)
        }}
        onSuccess={() => {
          setEditOpen(false)
          setCurrentEmployee(null)
          refetchEmployees()
        }}
        departments={departments}
        employee={currentEmployee}
      />

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
                          {currencies.map((c: any) => (
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
                          {currencies.map((c: any) => (
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
          await apiPost(`${api.auth.login.replace('/login', '')}/users/${resetUser.user_id}/reset-password`, {})
          message.success('密码已重置，新密码已发送至邮箱')
          setResetUserOpen(false)
          setResetUser(null)
          refetchEmployees()
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
