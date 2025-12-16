import React, { useState, useMemo, useCallback } from 'react'
import { Card, Button, Space, Tag, Descriptions, Dropdown } from 'antd'
import { SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Employee } from '../../../types'
import { useEmployees, useFormModal, useToggleUserActive, useResendActivation, useResetTotp, useEmployeeSalaries, useEmployeeAllowances } from '../../../hooks'
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
import { PageContainer } from '../../../components/PageContainer'
import { DataTable } from '../../../components/common/DataTable'
import type { DataTableColumn } from '../../../components/common/DataTable'
import { useQueryClient } from '@tanstack/react-query'
import { formatAmountWithCurrency } from '../../../utils/amount'

export function EmployeeManagement() {
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
  const queryClient = useQueryClient()
  const { data: employees = [], isLoading, refetch: refetchEmployees } = useEmployees({
    status: statusFilter !== 'all' && statusFilter !== 'active' ? statusFilter : undefined,
    activeOnly: statusFilter === 'active'
  })
  const { mutateAsync: toggleActive } = useToggleUserActive()
  const { mutateAsync: resendActivation } = useResendActivation()
  const { mutateAsync: resetTotp } = useResetTotp()



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

  const handleSalaryConfig = (employee: Employee, type: 'probation' | 'regular') => {
    setCurrentEmployee(employee)
    setSalaryConfigType(type)
    setSalaryConfigOpen(true)
  }

  const handleAllowanceConfig = (employee: Employee, type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday') => {
    setCurrentEmployee(employee)
    setAllowanceConfigType(type)
    setAllowanceConfigOpen(true)
  }

  // 查询薪资和补贴数据
  const { data: salariesData = [] } = useEmployeeSalaries(
    currentEmployee && salaryConfigOpen
      ? { employeeId: currentEmployee.id, salaryType: salaryConfigType }
      : { employeeId: '', salaryType: 'probation' }
  )

  const { data: allowancesData = [] } = useEmployeeAllowances(
    currentEmployee && allowanceConfigOpen
      ? { employeeId: currentEmployee.id, allowanceType: allowanceConfigType }
      : { employeeId: '', allowanceType: 'living' }
  )

  // 使用useEffect更新状态
  React.useEffect(() => {
    if (salaryConfigOpen && salariesData.length > 0) {
      setEmployeeSalaries(salariesData)
    }
  }, [salaryConfigOpen, salariesData])

  React.useEffect(() => {
    if (allowanceConfigOpen && allowancesData.length > 0) {
      setEmployeeAllowances(allowancesData)
    }
  }, [allowanceConfigOpen, allowancesData])

  const handleToggleActive = withErrorHandler(
    async (record: Employee) => {
      await toggleActive({ id: record.id, active: record.userActive !== 1 })
    },
    { successMessage: '操作成功' }
  )

  const handleResendActivation = withErrorHandler(
    async (record: Employee) => {
      await resendActivation(record.id)
    },
    { successMessage: '激活邮件已重新发送' }
  )

  const handleResetTotp = withErrorHandler(
    async (record: Employee) => {
      await resetTotp(record.id)
    },
    { successMessage: '2FA 重置成功，员工下次登录将无需验证码' }
  )

  const columns: DataTableColumn<Employee>[] = useMemo(() => [
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
      dataIndex: 'positionName',
      key: 'positionName',
      width: 120,
      render: (text: string) => text || '-',
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
      render: (_: unknown, record: Employee) => {
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
  ],
    [canEdit, isManager, statusFilter, handleToggleActive, modal])

  const renderActions = useCallback((record: Employee) => {
    // 薪资配置菜单项
    const salaryMenuItems = [
      {
        key: 'probation',
        label: '试用期底薪',
        onClick: () => handleSalaryConfig(record, 'probation'),
      },
      {
        key: 'regular',
        label: '转正底薪',
        onClick: () => handleSalaryConfig(record, 'regular'),
      },
    ]

    // 补贴配置菜单项
    const allowanceMenuItems = [
      { key: 'living', label: '生活补贴', onClick: () => handleAllowanceConfig(record, 'living') },
      { key: 'housing', label: '住房补贴', onClick: () => handleAllowanceConfig(record, 'housing') },
      { key: 'transportation', label: '交通补贴', onClick: () => handleAllowanceConfig(record, 'transportation') },
      { key: 'meal', label: '伙食补贴', onClick: () => handleAllowanceConfig(record, 'meal') },
      { key: 'birthday', label: '生日补贴', onClick: () => handleAllowanceConfig(record, 'birthday') },
    ]

    // 状态操作菜单项
    const statusMenuItems = []
    if (record.status === 'probation') {
      statusMenuItems.push({
        key: 'regularize',
        label: '转正',
        onClick: () => handleRegularize(record),
      })
    }
    if (record.status !== 'resigned') {
      statusMenuItems.push({
        key: 'leave',
        label: '离职',
        danger: true,
        onClick: () => handleLeave(record),
      })
    }
    if (record.status === 'resigned') {
      statusMenuItems.push({
        key: 'rejoin',
        label: '重新入职',
        onClick: () => handleRejoin(record),
      })
    }

    // 账号管理菜单项
    const accountMenuItems: any[] = []
    if (record.userId) {
      accountMenuItems.push({
        key: 'resetPassword',
        label: '重置密码',
        onClick: () => { setCurrentEmployee(record); setResetUserOpen(true); },
      })
      accountMenuItems.push({
        key: 'toggleActive',
        label: record.userActive === 1 ? '停用账号' : '启用账号',
        danger: record.userActive === 1,
        onClick: () => handleToggleActive(record),
      })
      if (!record.isActivated && record.userActive === 1) {
        accountMenuItems.push({
          key: 'resendActivation',
          label: '重发激活邮件',
          onClick: () => handleResendActivation(record),
        })
      }
      if (record.totpEnabled && record.userActive === 1) {
        accountMenuItems.push({
          key: 'resetTotp',
          label: '重置2FA',
          danger: true,
          onClick: () => handleResetTotp(record),
        })
      }
    }

    return (
      <Space size="small">
        {canEdit && record.status !== 'resigned' && (
          <>
            <Button size="small" type="primary" onClick={() => modal.openEdit(record)}>
              编辑
            </Button>
            <Dropdown menu={{ items: salaryMenuItems }} trigger={['click']}>
              <Button size="small">薪资</Button>
            </Dropdown>
            <Dropdown menu={{ items: allowanceMenuItems }} trigger={['click']}>
              <Button size="small">补贴</Button>
            </Dropdown>
          </>
        )}
        {canEdit && statusMenuItems.length > 0 && (
          <Dropdown menu={{ items: statusMenuItems }} trigger={['click']}>
            <Button size="small">{record.status === 'resigned' ? '入职' : '状态'}</Button>
          </Dropdown>
        )}
        {isManager && accountMenuItems.length > 0 && (
          <Dropdown menu={{ items: accountMenuItems }} trigger={['click']}>
            <Button size="small" icon={<SettingOutlined />}>账号</Button>
          </Dropdown>
        )}
      </Space>
    )
  }, [canEdit, isManager, handleToggleActive, modal, handleSalaryConfig, handleAllowanceConfig, handleRegularize, handleLeave, handleRejoin, handleResendActivation, handleResetTotp])
  return (
    <PageContainer>
      <Card
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}>刷新</Button>
        }
      >
        <DataTable<Employee>
          columns={columns}
          data={employees}
          loading={isLoading}
          rowKey="id"
          actions={renderActions}
          tableProps={{
            onChange: (_pagination, filters) => {
              if (filters.status && filters.status.length > 0) {
                setStatusFilter(filters.status[0] as string)
              } else {
                setStatusFilter('all')
              }
            },
            expandable: {
              expandedRowRender: (record) => (
                <Descriptions bordered size="small" column={2} style={{ margin: '8px 0' }}>
                  <Descriptions.Item label="试用期工资">
                    <SensitiveField value={formatAmountWithCurrency(record.probationSalaryCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="转正工资">
                    <SensitiveField value={formatAmountWithCurrency(record.regularSalaryCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="转正日期">{record.regularDate || '-'}</Descriptions.Item>
                  <Descriptions.Item label="生活补贴">
                    <SensitiveField value={formatAmountWithCurrency(record.livingAllowanceCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="住房补贴">
                    <SensitiveField value={formatAmountWithCurrency(record.housingAllowanceCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="交通补贴">
                    <SensitiveField value={formatAmountWithCurrency(record.transportationAllowanceCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="伙食补贴">
                    <SensitiveField value={formatAmountWithCurrency(record.mealAllowanceCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="补贴合计">
                    <SensitiveField value={formatAmountWithCurrency((record.livingAllowanceCents || 0) + (record.housingAllowanceCents || 0) + (record.transportationAllowanceCents || 0) + (record.mealAllowanceCents || 0), 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
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
            },
          }}
        />
      </Card>

      <EditEmployeeModal
        open={modal.mode === 'edit' && modal.isOpen}
        employee={modal.data}
        onCancel={modal.close}
        onSuccess={() => {
          modal.close()
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          queryClient.invalidateQueries({ queryKey: ['employees'] })
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
