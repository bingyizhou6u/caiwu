import React, { useState, useMemo, useCallback } from 'react'
import { Card, Button, Space, Tag, Descriptions, Dropdown } from 'antd'
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import type { Employee } from '../../../types'
import { useEmployees, useFormModal, useToggleUserActive, useResendActivation, useResetTotp } from '../../../hooks'
import { usePermissions } from '../../../utils/permissions'
import { EMPLOYEE_STATUS, ACCOUNT_STATUS } from '../../../utils/status'
import { StatusTag } from '../../../components/common/StatusTag'
import { EmployeeFormModal } from '../../../features/employees/components/modals/EmployeeFormModal'
import { ResetUserPasswordModal } from '../../../features/employees/components/modals/ResetUserPasswordModal'
import { SensitiveField } from '../../../components/SensitiveField'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'
import { DataTable, EmptyText } from '../../../components/common'
import type { DataTableColumn } from '../../../components/common'
import { useQueryClient } from '@tanstack/react-query'
import { formatAmountWithCurrency } from '../../../utils/amount'

export function EmployeeManagement() {
  const modal = useFormModal<Employee>()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // 模态框状态
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
    { successMessage: '激活邮件已发送' }
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
      fixed: 'left' as const,
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 100,
      render: (text: string) => <EmptyText value={text} />,
    },
    {
      title: '部门',
      dataIndex: 'orgDepartmentName',
      key: 'orgDepartmentName',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '职位',
      dataIndex: 'positionName',
      key: 'positionName',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '入职日期',
      dataIndex: 'joinDate',
      key: 'joinDate',
      width: 100,
      render: (date: string) => date || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => <StatusTag status={status} statusMap={EMPLOYEE_STATUS} />,
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
      title: '账号',
      key: 'account',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: Employee) => {
        // 无账号
        if (!record.userId) {
          return <Tag color="default">无</Tag>
        }
        // 账号已停用
        if (record.userActive === 0) {
          return <Tag color="red">停用</Tag>
        }
        // 账号正常：显示激活状态和2FA
        const isActivated = record.isActivated
        const has2FA = !!record.totpEnabled // 确保转换为布尔值

        return (
          <Space size={2}>
            <Tag color={isActivated ? 'green' : 'orange'} style={{ margin: 0 }}>
              {isActivated ? '已激活' : '待激活'}
            </Tag>
            {has2FA && <Tag color="purple" style={{ margin: 0 }}>2FA</Tag>}
          </Space>
        )
      },
    },
  ],
    [statusFilter])

  const renderActions = useCallback((record: Employee) => {
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
          label: '发送激活邮件',
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
        {canEdit && (
          <Button size="small" type="primary" onClick={() => modal.openEdit(record)}>
            编辑
          </Button>
        )}
        {isManager && accountMenuItems.length > 0 && (
          <Dropdown menu={{ items: accountMenuItems }} trigger={['click']}>
            <Button size="small" icon={<SettingOutlined />}>账号</Button>
          </Dropdown>
        )}
      </Space>
    )
  }, [canEdit, isManager, handleToggleActive, modal, handleResendActivation, handleResetTotp])
  return (
    <PageContainer
      title="人员管理"
      breadcrumb={[{ title: '人力资源' }, { title: '人员管理' }]}
    >
      <Card
        bordered={false}
        className="page-card"
        extra={
          <Space>
            {hasPermission('hr', 'employee', 'create') && (
              <Button type="primary" onClick={() => setCreateModalOpen(true)}>
                新建员工
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}>刷新</Button>
          </Space>
        }
      >
        <DataTable<Employee>
          columns={columns}
          data={employees}
          loading={isLoading}
          rowKey="id"
          actions={renderActions}
          onChange={(_pagination, filters) => {
            if (filters.status && filters.status.length > 0) {
              setStatusFilter(filters.status[0] as string)
            } else {
              setStatusFilter('all')
            }
          }}
          tableProps={{
            expandable: {
              expandedRowRender: (record) => (
                <Descriptions bordered size="small" column={2} style={{ margin: '8px 0' }}>
                  {/* 联系信息 */}
                  <Descriptions.Item label="手机号">
                    {record.phone ? (
                      <SensitiveField value={record.phone} type="phone" permission="hr.employee.view_sensitive" entityId={record.id} entityType="employee" />
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="个人邮箱"><EmptyText value={record.personalEmail} /></Descriptions.Item>

                  {/* 薪资信息 */}
                  <Descriptions.Item label="试用期工资">
                    <SensitiveField value={formatAmountWithCurrency(record.probationSalaryCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="转正工资">
                    <SensitiveField value={formatAmountWithCurrency(record.regularSalaryCents || 0, 'CNY', false)} type="salary" permission="hr.salary.view" entityId={record.id} entityType="employee" />
                  </Descriptions.Item>
                  <Descriptions.Item label="转正日期"><EmptyText value={record.regularDate} /></Descriptions.Item>
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
                      <Descriptions.Item label="离职日期"><EmptyText value={record.leaveDate} /></Descriptions.Item>
                      <Descriptions.Item label="离职类型">
                        {record.leave_type === 'resigned' ? '主动离职' :
                          record.leave_type === 'terminated' ? '被动离职' :
                            record.leave_type === 'expired' ? '合同到期' :
                              record.leave_type === 'retired' ? '退休' :
                                record.leave_type === 'other' ? '其他' : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="离职原因"><EmptyText value={record.leave_reason} /></Descriptions.Item>
                      <Descriptions.Item label="离职备注"><EmptyText value={record.leave_memo} /></Descriptions.Item>
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
                  <Descriptions.Item label="生日"><EmptyText value={record.birthday} /></Descriptions.Item>
                  <Descriptions.Item label="备注" span={2}><EmptyText value={record.memo} /></Descriptions.Item>
                  {record.userId && (
                    <>
                      <Descriptions.Item label="账号状态">
                        <StatusTag status={record.userActive === 1 ? 'enabled' : 'disabled'} statusMap={ACCOUNT_STATUS} />
                      </Descriptions.Item>
                      {record.positionName && (
                        <>
                          <Descriptions.Item label="职位名称">
                            {record.positionName}
                          </Descriptions.Item>
                          <Descriptions.Item label="职位代码">
                            <EmptyText value={record.positionCode} />
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

      <EmployeeFormModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          queryClient.invalidateQueries({ queryKey: ['employees'] })
        }}
      />

      <EmployeeFormModal
        open={modal.mode === 'edit' && modal.isOpen}
        employee={modal.data}
        onCancel={modal.close}
        onSuccess={() => {
          modal.close()
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
