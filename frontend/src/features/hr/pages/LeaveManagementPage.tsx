import { Card, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, DatePicker, InputNumber } from 'antd'
import { EmployeeSelect } from '../../../components/form'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useLeaves, useCreateLeave, useUpdateLeave, useDeleteLeave, useApproveLeave } from '../../../hooks/business/useLeaves'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { leaveSchema, approveLeaveSchema } from '../../../validations/leave.schema'
import { DataTable, StatusTag, PageToolbar, EmptyText } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { LEAVE_STATUS } from '../../../utils/status'
import type { EmployeeLeave } from '../../../hooks/business/useLeaves'
import React, { useState } from 'react'
import { useEmployees } from '../../../hooks/useBusinessData'
import { PageContainer } from '../../../components/PageContainer'
import { DataTableColumn } from '../../../components/common/DataTable'

const { Option } = Select

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: '病假',
  annual: '年假',
  personal: '事假',
  other: '其他',
}

export function LeaveManagement() {
  const { data: leaves = [], isLoading, refetch } = useLeaves()
  const { mutateAsync: createLeave } = useCreateLeave()
  const { mutateAsync: updateLeave } = useUpdateLeave()
  const { mutateAsync: deleteLeave } = useDeleteLeave()
  const { mutateAsync: approveLeave } = useApproveLeave()

  const [submitting, setSubmitting] = useState(false)
  const [searchParams, setSearchParams] = useState<{ employee?: string; leaveType?: string; status?: string }>({})

  const {
    isOpen: createOpen,
    openCreate,
    close: closeCreate,
  } = useFormModal<EmployeeLeave>()

  const {
    isOpen: editOpen,
    data: editRow,
    openEdit,
    close: closeEdit,
  } = useFormModal<EmployeeLeave>()

  const {
    isOpen: approveOpen,
    data: approveRow,
    openEdit: openApprove,
    close: closeApprove,
  } = useFormModal<EmployeeLeave>()

  const { form: createForm, validateWithZod: validateCreate } = useZodForm(leaveSchema)
  const { form: editForm, validateWithZod: validateEdit } = useZodForm(leaveSchema)
  const { form: approveForm, validateWithZod: validateApprove } = useZodForm(approveLeaveSchema)

  const { hasPermission, canManageSubordinates } = usePermissions()
  const canEdit = hasPermission('hr', 'leave', 'view')
  const canApprove = hasPermission('hr', 'leave', 'approve') || canManageSubordinates

  // 使用React Query hook获取员工数据
  const { data: employeesData = [] } = useEmployees(true)

  // 转换员工数据格式
  const employees = React.useMemo(() => {
    return employeesData.map((e: any) => ({
      id: e.id,
      name: e.name || '',
      departmentName: e.departmentName || '',
      active: 1
    }))
  }, [employeesData])

  // 过滤请假记录
  const filteredLeaves = React.useMemo(() => {
    return leaves.filter((leave: EmployeeLeave) => {
      if (searchParams.employee && !leave.employeeName?.toLowerCase().includes(searchParams.employee.toLowerCase())) {
        return false
      }
      if (searchParams.leaveType && leave.leave_type !== searchParams.leaveType) {
        return false
      }
      if (searchParams.status && leave.status !== searchParams.status) {
        return false
      }
      return true
    })
  }, [leaves, searchParams])

  const handleCreate = withErrorHandler(
    async () => {
      const values = await validateCreate()
      // 计算天数
      const start = dayjs(values.startDate)
      const end = dayjs(values.endDate)
      const days = values.days || (end.diff(start, 'day') + 1)

      await createLeave({
        ...values,
        startDate: dayjs(values.startDate).format('YYYY-MM-DD'),
        endDate: dayjs(values.endDate).format('YYYY-MM-DD'),
        days,
      })
      closeCreate()
      createForm.resetFields()
    },
    {
      successMessage: '创建成功',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleUpdate = withErrorHandler(
    async () => {
      if (!editRow) return
      const values = await validateEdit()
      // 计算天数
      const start = dayjs(values.startDate)
      const end = dayjs(values.endDate)
      const days = values.days || (end.diff(start, 'day') + 1)

      await updateLeave({
        id: editRow.id,
        data: {
          ...values,
          startDate: dayjs(values.startDate).format('YYYY-MM-DD'),
          endDate: dayjs(values.endDate).format('YYYY-MM-DD'),
          days,
        }
      })
      closeEdit()
      editForm.resetFields()
    },
    {
      successMessage: '更新成功',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleApproveConfirm = withErrorHandler(
    async () => {
      if (!approveRow) return
      const values = await validateApprove()
      await approveLeave({
        id: approveRow.id,
        status: values.status,
        memo: values.memo,
      })
      closeApprove()
      approveForm.resetFields()
    },
    {
      successMessage: '操作成功',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleDelete = withErrorHandler(
    async (id: string) => {
      await deleteLeave(id)
    },
    { successMessage: '删除成功' }
  )

  const onEdit = (record: EmployeeLeave) => {
    if (record.status !== 'pending') {
      message.warning('只能编辑待审批的请假记录')
      return
    }
    editForm.setFieldsValue({
      ...record,
      startDate: dayjs(record.startDate),
      endDate: dayjs(record.endDate),
    })
    openEdit(record)
  }

  const onApprove = (record: EmployeeLeave) => {
    approveForm.setFieldsValue({
      status: 'approved',
      memo: record.memo,
    })
    openApprove(record)
  }

  const columns: DataTableColumn<EmployeeLeave>[] = [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 120,
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
    },
    {
      title: '请假类型',
      dataIndex: 'leave_type',
      key: 'leave_type',
      width: 100,
      render: (type: string) => LEAVE_TYPE_LABELS[type] || type,
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
    },
    {
      title: '天数',
      dataIndex: 'days',
      key: 'days',
      width: 80,
      align: 'right',
      render: (days: number) => days.toFixed(1),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <StatusTag status={status} statusMap={LEAVE_STATUS} />
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '审批人',
      dataIndex: 'approver_name',
      key: 'approver_name',
      width: 100,
      render: (name: string) => <EmptyText value={name} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: unknown, record: EmployeeLeave) => (
        <Space>
          {canEdit && record.status === 'pending' && (
            <Button size="small" onClick={() => onEdit(record)}>
              编辑
            </Button>
          )}
          {canApprove && record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => onApprove(record)}>
              审批
            </Button>
          )}
          {canManageSubordinates && (
            <Popconfirm
              title="确定要删除这条请假记录吗？"
              onConfirm={() => handleDelete(record.id)}
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
  ]

  const renderFormFields = () => (
    <>
      <Form.Item
        name="leave_type"
        label="请假类型"
      >
        <Select placeholder="请选择请假类型">
          <Option value="sick">病假</Option>
          <Option value="annual">年假</Option>
          <Option value="personal">事假</Option>
          <Option value="other">其他</Option>
        </Select>
      </Form.Item>
      <Form.Item
        name="startDate"
        label="开始日期"
      >
        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item
        name="endDate"
        label="结束日期"
      >
        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item
        name="days"
        label="请假天数"
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0.5}
          step={0.5}
          precision={1}
          placeholder="自动计算，也可手动输入"
        />
      </Form.Item>
      <Form.Item
        name="reason"
        label="请假原因"
      >
        <Input.TextArea rows={3} placeholder="请输入请假原因" />
      </Form.Item>
      <Form.Item
        name="memo"
        label="备注"
      >
        <Input.TextArea rows={2} placeholder="可选，备注信息" />
      </Form.Item>
    </>
  )

  return (
    <PageContainer
      title="员工请假管理"
      breadcrumb={[{ title: '人事管理' }, { title: '员工请假管理' }]}
    >
      <Card
        className="page-card"
        bordered={false}
      >
        <SearchFilters
          fields={[
            { name: 'employee', label: '员工姓名', type: 'input', placeholder: '请输入员工姓名' },
            {
              name: 'leaveType',
              label: '请假类型',
              type: 'select',
              placeholder: '请选择请假类型',
              options: [
                { label: '全部', value: '' },
                { value: 'sick', label: '病假' },
                { value: 'annual', label: '年假' },
                { value: 'personal', label: '事假' },
                { value: 'other', label: '其他' },
              ],
            },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '请选择状态',
              options: [
                { label: '全部', value: '' },
                { value: 'pending', label: '待审批' },
                { value: 'approved', label: '已批准' },
                { value: 'rejected', label: '已拒绝' },
              ],
            },
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <PageToolbar
          actions={[
            {
              label: '刷新',
              icon: <ReloadOutlined />,
              onClick: () => refetch(),
              loading: isLoading
            },
            ...(canEdit ? [{
              label: '新建请假',
              type: 'primary' as const,
              onClick: openCreate
            }] : [])
          ]}
          style={{ marginTop: 16 }}
        />

        <DataTable<EmployeeLeave>
          columns={columns}
          data={filteredLeaves}
          loading={isLoading}
          rowKey="id"
          actions={(record) => (
            <Space>
              {canEdit && record.status === 'pending' && (
                <Button size="small" onClick={() => onEdit(record)}>
                  编辑
                </Button>
              )}
              {canApprove && record.status === 'pending' && (
                <Button size="small" type="primary" onClick={() => onApprove(record)}>
                  审批
                </Button>
              )}
              {canManageSubordinates && (
                <Popconfirm
                  title="确定要删除这条请假记录吗？"
                  onConfirm={() => handleDelete(record.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              )}
            </Space>
          )}
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 1200 } }}
        />

        <Modal
          title="新建请假"
          open={createOpen}
          onOk={handleCreate}
          onCancel={() => {
            closeCreate()
            createForm.resetFields()
          }}
          confirmLoading={submitting}
          okText="创建"
          cancelText="取消"
        >
          <Form
            form={createForm}
            layout="vertical"
            onValuesChange={(changedValues, allValues) => {
              if ((changedValues.startDate || changedValues.endDate) && allValues.startDate && allValues.endDate) {
                const start = dayjs(allValues.startDate)
                const end = dayjs(allValues.endDate)
                const calculatedDays = end.diff(start, 'day') + 1
                createForm.setFieldsValue({ days: calculatedDays })
              }
            }}
          >
            <Form.Item
              name="employeeId"
              label="员工"
            >
              <EmployeeSelect placeholder="请选择员工" />
            </Form.Item>
            {renderFormFields()}
          </Form>
        </Modal>

        <Modal
          title="编辑请假"
          open={editOpen}
          onOk={handleUpdate}
          onCancel={() => {
            closeEdit()
            editForm.resetFields()
          }}
          confirmLoading={submitting}
          okText="保存"
          cancelText="取消"
        >
          <Form
            form={editForm}
            layout="vertical"
            onValuesChange={(changedValues, allValues) => {
              if ((changedValues.startDate || changedValues.endDate) && allValues.startDate && allValues.endDate) {
                const start = dayjs(allValues.startDate)
                const end = dayjs(allValues.endDate)
                const calculatedDays = end.diff(start, 'day') + 1
                editForm.setFieldsValue({ days: calculatedDays })
              }
            }}
          >
            {renderFormFields()}
          </Form>
        </Modal>

        <Modal
          title="审批请假"
          open={approveOpen}
          onOk={handleApproveConfirm}
          onCancel={() => {
            closeApprove()
            approveForm.resetFields()
          }}
          confirmLoading={submitting}
          okText="确认"
          cancelText="取消"
        >
          <Form form={approveForm} layout="vertical">
            <Form.Item label="员工姓名">
              <Input value={approveRow?.employeeName} disabled />
            </Form.Item>
            <Form.Item label="请假类型">
              <Input value={LEAVE_TYPE_LABELS[approveRow?.leave_type || '']} disabled />
            </Form.Item>
            <Form.Item label="请假日期">
              <Input value={`${approveRow?.startDate} 至 ${approveRow?.endDate}`} disabled />
            </Form.Item>
            <Form.Item label="请假天数">
              <Input value={`${approveRow?.days} 天`} disabled />
            </Form.Item>
            <Form.Item label="请假原因">
              <Input.TextArea value={approveRow?.reason} rows={2} disabled />
            </Form.Item>
            <Form.Item
              name="status"
              label="审批结果"
            >
              <Select>
                <Option value="approved">批准</Option>
                <Option value="rejected">拒绝</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="memo"
              label="审批备注"
            >
              <Input.TextArea rows={2} placeholder="可选，审批备注" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}

