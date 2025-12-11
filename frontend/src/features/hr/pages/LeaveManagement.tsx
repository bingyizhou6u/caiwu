import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, DatePicker, InputNumber } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useLeaves, useCreateLeave, useUpdateLeave, useDeleteLeave, useApproveLeave } from '../../../hooks/business/useLeaves'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { leaveSchema, approveLeaveSchema } from '../../../validations/leave.schema'
import type { EmployeeLeave } from '../../../hooks/business/useLeaves'
import { useEffect, useState } from 'react'
import { loadEmployees } from '../../../utils/loaders'

const { Option } = Select

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: '病假',
  annual: '年假',
  personal: '事假',
  other: '其他',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

import { PageContainer } from '../../../components/PageContainer'

export function LeaveManagement() {
  const { data: leaves = [], isLoading, refetch } = useLeaves()
  const { mutateAsync: createLeave } = useCreateLeave()
  const { mutateAsync: updateLeave } = useUpdateLeave()
  const { mutateAsync: deleteLeave } = useDeleteLeave()
  const { mutateAsync: approveLeave } = useApproveLeave()

  const [employees, setEmployees] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

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

  const { hasPermission, canManageSubordinates, isManager: _isManager } = usePermissions()
  const canEdit = hasPermission('hr', 'leave', 'view')
  const canApprove = hasPermission('hr', 'leave', 'approve') || canManageSubordinates
  const isManager = _isManager()

  useEffect(() => {
    loadMasterData()
  }, [])

  const loadMasterData = async () => {
    try {
      const employeesData = await loadEmployees()
      setEmployees(employeesData.map(e => ({
        id: e.value as string,
        name: e.label.split(' (')[0],
        departmentName: e.label.split(' (')[1]?.replace(')', ''),
        active: 1
      })))
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  const handleCreate = withErrorHandler(
    async () => {
      setSubmitting(true)
      try {
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
      } finally {
        setSubmitting(false)
      }
    },
    { successMessage: '创建成功' }
  )

  const handleUpdate = withErrorHandler(
    async () => {
      if (!editRow) return
      setSubmitting(true)
      try {
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
      } finally {
        setSubmitting(false)
      }
    },
    { successMessage: '更新成功' }
  )

  const handleApproveConfirm = withErrorHandler(
    async () => {
      if (!approveRow) return
      setSubmitting(true)
      try {
        const values = await validateApprove()
        await approveLeave({
          id: approveRow.id,
          status: values.status,
          memo: values.memo,
        })
        closeApprove()
        approveForm.resetFields()
      } finally {
        setSubmitting(false)
      }
    },
    { successMessage: '操作成功' }
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

  const columns: ColumnsType<EmployeeLeave> = [
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
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status] || status}
        </Tag>
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
      render: (name: string) => name || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: EmployeeLeave) => (
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
          {isManager && (
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
        title="员工请假管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
            {canEdit && (
              <Button type="primary" onClick={openCreate}>
                新建请假
              </Button>
            )}
          </Space>
        }
        className="page-card"
        bordered={false}
      >
        <Table
          className="table-striped"
          columns={columns}
          dataSource={leaves}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
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
              <Select placeholder="请选择员工" showSearch optionFilterProp="children">
                {employees.map((emp) => (
                  <Option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.departmentName})
                  </Option>
                ))}
              </Select>
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

