import { useState, useMemo, useCallback } from 'react'
import { Card, Table, Button, Space, message, Popconfirm, Tag, Descriptions, Dropdown } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Employee } from '../../../types'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { useEmployees, useFormModal, useToggleUserActive } from '../../../hooks'
import { usePermissions } from '../../../utils/permissions'
import { EditEmployeeModal } from '../../../features/employees/components/modals/EditEmployeeModal'
import { RegularizeEmployeeModal } from '../../../features/employees/components/modals/RegularizeEmployeeModal'
import { LeaveEmployeeModal } from '../../../features/employees/components/modals/LeaveEmployeeModal'
import { RejoinEmployeeModal } from '../../../features/employees/components/modals/RejoinEmployeeModal'
import { SalaryConfigModal } from '../../../features/employees/components/modals/SalaryConfigModal'
import { AllowanceConfigModal } from '../../../features/employees/components/modals/AllowanceConfigModal'
import { ResetUserPasswordModal } from '../../../features/employees/components/modals/ResetUserPasswordModal'
import { SensitiveField } from '../../../components/SensitiveField'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useApiMutation } from '../../../utils/useApiQuery'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { PageContainer } from '../../../components/PageContainer'
import { renderStatus, renderText } from '../../../utils/renderers'

import { useNavigate } from 'react-router-dom'

export function EmployeeManagement() {
  const navigate = useNavigate()
  const modal = useFormModal<Employee>()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 模态框状态
  const [regularizeOpen, setRegularizeOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [rejoinOpen, setRejoinOpen] = useState(false)
  const [salaryConfigOpen, setSalaryConfigOpen] = useState(false)
  const [salaryConfigType, setSalaryConfigType] = useState<'probation' | 'regular'>('probation')
  const [employeeSalaries, setEmployeeSalaries] = useState<any[]>([])
  const [allowanceConfigOpen, setAllowanceConfigOpen] = useState(false)
  const [allowanceConfigType, setAllowanceConfigType] = useState<'living' | 'housing' | 'transportation' | 'meal' | 'birthday'>('living')
  const [employeeAllowances, setEmployeeAllowances] = useState<any[]>([])
  const [resetUserOpen, setResetUserOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)

  // 权限
  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canEdit = hasPermission('hr', 'employee', 'update')
  const canDelete = isManager // 仅管理员可删除

  // Hooks
  const { data: employees = [], refetch: refetchEmployees, isLoading } = useEmployees({
    status: statusFilter !== 'all' && statusFilter !== 'active' ? statusFilter : undefined,
    activeOnly: statusFilter === 'active'
  })
  const { mutateAsync: updateEmployee } = useApiMutation()



  const handleRegularize = (employee: Employee) => {
    setCurrentEmployee(employee)
    setRegularizeOpen(true)
  }

  const handleLeave = (employee: Employee) => {
    setCurrentEmployee(employee)
    setLeaveOpen(true)
  }

  const handleRejoin = (employee: Employee) => {
    setCurrentEmployee(employee)
    setRejoinOpen(true)
  }

  const handleSalaryConfig = async (employee: Employee, type: 'probation' | 'regular') => {
    setCurrentEmployee(employee)
    setSalaryConfigType(type)
    try {
      const salaries = await apiClient.get<any[]>(`${api.employeeSalaries}?employeeId=${employee.id}&salaryType=${type}`)
      setEmployeeSalaries(salaries)
      setSalaryConfigOpen(true)
    } catch (error: any) {
      message.error(error.message || '加载底薪配置失败')
    }
  }

  const handleAllowanceConfig = async (employee: Employee, type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday') => {
    setCurrentEmployee(employee)
    setAllowanceConfigType(type)
    try {
      const allowances = await apiClient.get<any[]>(`${api.employeeAllowances}?employeeId=${employee.id}&allowanceType=${type}`)
      setEmployeeAllowances(allowances)
      setAllowanceConfigOpen(true)
    } catch (error: any) {
      message.error(error.message || '加载补贴配置失败')
    }
  }

  const handleToggleActive = withErrorHandler(
    async (record: Employee) => {
      await updateEmployee({
        url: api.employeesById(record.id),
        method: 'PUT',
        body: { active: record.userActive === 1 ? 0 : 1 }
      })
      refetchEmployees()
    },
    { successMessage: '操作成功' }
  )

  const handleResendActivation = withErrorHandler(
    async (record: Employee) => {
      await apiClient.post(api.employeesResendActivation(record.id))
    },
    { successMessage: '激活邮件已重新发送' }
  )

  const handleResetTotp = withErrorHandler(
    async (record: Employee) => {
      await apiClient.post(api.employeesResetTotp(record.id))
    },
    { successMessage: '2FA 重置成功，员工下次登录将无需验证码' }
  )

  const columns: ColumnsType<Employee> = useMemo(() => [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'orgDepartmentName',
      key: 'orgDepartmentName',
      width: 120,
      render: (text: string, record: Employee) => {
        if (!text) return '-'
        return (
          <span>
            {text}
            {record.orgDepartmentCode && <span style={{ color: '#999', fontSize: '12px' }}> ({record.orgDepartmentCode})</span>}
          </span>
        )
      },
    },
    {
      title: '职位',
      dataIndex: 'positionId',
      key: 'positionId',
      width: 120,
      render: (text) => renderText(text) // Simplification if positions map is not directly used here or needs lookup
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text: string) => renderStatus(text, {
        active: { text: '在职', color: 'success' },
        probation: { text: '试用期', color: 'processing' },
        resigned: { text: '离职', color: 'default' }
      })
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone: string, record: Employee) => {
        if (!phone) return '-'
        return <SensitiveField value={phone} type="phone" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
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
      dataIndex: 'joinDate',
      key: 'joinDate',
      width: 110,
      render: (date: string) => date,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
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
        if (!record.userId) {
          return <Tag color="default">未创建账号</Tag>
        }
        if (record.userActive === 0) {
          return <Tag color="red">账号已停用</Tag>
        }

        const activatedTag = record.isActivated ?
          <Tag color="success">已激活</Tag> :
          <Tag color="warning">未激活</Tag>

        const totpTag = record.totpEnabled ?
          <Tag color="blue" title="2FA已开启">2FA</Tag> :
          null

        const levelLabels: Record<number, string> = {
          1: '总部',
          2: '项目',
          3: '组',
        }
        const levelLabel = record.positionLevel ? levelLabels[record.positionLevel] || `级别${record.positionLevel}` : ''
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Tag color="blue">{record.positionName || '无职位'}</Tag>
              {activatedTag}
              {totpTag}
            </div>
            {levelLabel && <div style={{ fontSize: 12, color: '#666' }}>层级: {levelLabel}</div>}
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
              <Button size="small" onClick={() => modal.openEdit(record)}>
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
          {isManager && record.userId && (
            <>
              <Button size="small" onClick={() => { setCurrentEmployee(record); setResetUserOpen(true); }}>
                重置密码
              </Button>
              <Button size="small" onClick={() => handleToggleActive(record)}>
                {record.userActive === 1 ? '停用账号' : '启用账号'}
              </Button>
              {!record.isActivated && record.userActive === 1 && (
                <Popconfirm
                  title="重新发送激活邮件？"
                  description="这将使之前的激活链接失效"
                  onConfirm={() => handleResendActivation(record)}
                  okText="发送"
                  cancelText="取消"
                >
                  <Button size="small">重发激活</Button>
                </Popconfirm>
              )}
              {record.totpEnabled && record.userActive === 1 && (
                <Popconfirm
                  title="确定重置2FA？"
                  description="重置后员工将使用无2FA模式登录"
                  onConfirm={() => handleResetTotp(record)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>重置2FA</Button>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ],
    [canEdit, isManager, statusFilter, handleToggleActive, modal])
  return (
    <PageContainer>
      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetchEmployees()}>刷新</Button>
            <Button type="primary" onClick={() => modal.openCreate()}>新建员工</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={employees}
          loading={isLoading}
          onChange={(_pagination, filters) => {
            if (filters.status && filters.status.length > 0) {
              setStatusFilter(filters.status[0] as string)
            } else {
              setStatusFilter('all')
            }
          }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions bordered size="small" column={2} style={{ margin: '8px 0' }}>
                <Descriptions.Item label="试用期工资">
                  <SensitiveField value={((record.probationSalaryCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="转正工资">
                  <SensitiveField value={((record.regularSalaryCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="转正日期">{record.regularDate || '-'}</Descriptions.Item>
                <Descriptions.Item label="生活补贴">
                  <SensitiveField value={((record.livingAllowanceCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="住房补贴">
                  <SensitiveField value={((record.housingAllowanceCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="交通补贴">
                  <SensitiveField value={((record.transportationAllowanceCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="伙食补贴">
                  <SensitiveField value={((record.mealAllowanceCents || 0) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="补贴合计">
                  <SensitiveField value={(((record.livingAllowanceCents || 0) + (record.housingAllowanceCents || 0) + (record.transportationAllowanceCents || 0) + (record.mealAllowanceCents || 0)) / 100).toFixed(2)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                {record.status === 'resigned' && (
                  <>
                    <Descriptions.Item label="离职日期">{record.leaveDate || '-'}</Descriptions.Item>
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
                <Descriptions.Item label="USDT地址">
                  <SensitiveField value={record.usdtAddress || '-'} type="default" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="紧急联系人">
                  <SensitiveField value={record.emergencyContact || '-'} type="default" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="紧急联系人电话">
                  {record.emergencyPhone ? (
                    <SensitiveField value={record.emergencyPhone} type="phone" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>
                  <SensitiveField value={record.address || '-'} type="address" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
                </Descriptions.Item>
                <Descriptions.Item label="生日">{record.birthday || '-'}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{record.memo || '-'}</Descriptions.Item>
                {record.userId && (
                  <>
                    <Descriptions.Item label="账号状态">
                      {record.userActive === 1 ? <Tag color="green">已启用</Tag> : <Tag color="red">已停用</Tag>}
                    </Descriptions.Item>
                    {record.positionName && (
                      <>
                        <Descriptions.Item label="职位名称">
                          {record.positionName}
                        </Descriptions.Item>
                        <Descriptions.Item label="职位代码">
                          {record.positionCode || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="职位层级">
                          {record.positionLevel === 1 ? '总部' :
                            record.positionLevel === 2 ? '项目' :
                              record.positionLevel === 3 ? '组' :
                                record.positionLevel || '-'}
                        </Descriptions.Item>
                      </>
                    )}
                    <Descriptions.Item label="最近登录">
                      {record.userLastLoginAt ? new Date(record.userLastLoginAt).toLocaleString() : '从未登录'}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            ),
          }}
        />
      </Card>

      <EditEmployeeModal
        open={modal.mode === 'edit' && modal.isOpen}
        employee={modal.data}
        onCancel={modal.close}
        onSuccess={() => {
          modal.close()
          refetchEmployees()
        }}
      />

      <RegularizeEmployeeModal
        open={regularizeOpen}
        employee={currentEmployee}
        onCancel={() => {
          setRegularizeOpen(false)
          setCurrentEmployee(null)
        }}
        onSuccess={() => {
          setRegularizeOpen(false)
          setCurrentEmployee(null)
          refetchEmployees()
        }}
      />

      <LeaveEmployeeModal
        open={leaveOpen}
        employee={currentEmployee}
        onCancel={() => {
          setLeaveOpen(false)
          setCurrentEmployee(null)
        }}
        onSuccess={() => {
          setLeaveOpen(false)
          setCurrentEmployee(null)
          refetchEmployees()
        }}
      />

      <RejoinEmployeeModal
        open={rejoinOpen}
        employee={currentEmployee}
        onCancel={() => {
          setRejoinOpen(false)
          setCurrentEmployee(null)
        }}
        onSuccess={() => {
          setRejoinOpen(false)
          setCurrentEmployee(null)
          refetchEmployees()
        }}
      />

      <SalaryConfigModal
        open={salaryConfigOpen}
        employee={currentEmployee}
        type={salaryConfigType}
        initialSalaries={employeeSalaries}
        onCancel={() => {
          setSalaryConfigOpen(false)
          setCurrentEmployee(null)
          setEmployeeSalaries([])
        }}
        onSuccess={() => {
          setSalaryConfigOpen(false)
          setCurrentEmployee(null)
          setEmployeeSalaries([])
          refetchEmployees()
        }}
      />

      <AllowanceConfigModal
        open={allowanceConfigOpen}
        employee={currentEmployee}
        type={allowanceConfigType}
        initialAllowances={employeeAllowances}
        onCancel={() => {
          setAllowanceConfigOpen(false)
          setCurrentEmployee(null)
          setEmployeeAllowances([])
        }}
        onSuccess={() => {
          setAllowanceConfigOpen(false)
          setCurrentEmployee(null)
          setEmployeeAllowances([])
          refetchEmployees()
        }}
      />

      <ResetUserPasswordModal
        open={resetUserOpen}
        employee={currentEmployee}
        onCancel={() => {
          setResetUserOpen(false)
          setCurrentEmployee(null)
        }}
        onSuccess={() => {
          setResetUserOpen(false)
          setCurrentEmployee(null)
        }}
      />
    </PageContainer >
  )
}
