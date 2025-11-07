import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, DatePicker, InputNumber } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { apiGet, apiPost, apiPut, apiDelete, safeApiCall, handleConflictError } from '../utils/api'
import { loadEmployees } from '../utils/loaders'

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

type EmployeeLeave = {
  id: string
  employee_id: string
  employee_name?: string
  department_id?: string
  department_name?: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  memo?: string
  approved_by?: string
  approver_name?: string
  approved_at?: number
  created_by?: string
  creator_name?: string
  created_at: number
}

export function LeaveManagement({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<EmployeeLeave[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [currentLeave, setCurrentLeave] = useState<EmployeeLeave | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [approveForm] = Form.useForm()
  const canEdit = userRole === 'manager' || userRole === 'finance'
  const canApprove = userRole === 'manager' || userRole === 'finance'
  const isManager = userRole === 'manager'

  const loadLeaves = async () => {
    setLoading(true)
    const result = await safeApiCall(() => apiGet(api.employeeLeaves), '获取请假记录失败')
    if (result) setData(result)
    setLoading(false)
  }

  const loadMasterData = async () => {
    try {
      const employeesData = await loadEmployees()
      setEmployees(employeesData.map(e => ({ 
        id: e.value as string, 
        name: e.label.split(' (')[0],
        active: 1
      })))
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    loadLeaves()
    loadMasterData()
  }, [])

  const handleCreate = async () => {
    const v = await createForm.validateFields()
    try {
      // 计算天数
      const start = dayjs(v.start_date)
      const end = dayjs(v.end_date)
      const days = end.diff(start, 'day') + 1
      
      await apiPost(api.employeeLeaves, {
        employee_id: v.employee_id,
        leave_type: v.leave_type,
        start_date: v.start_date.format('YYYY-MM-DD'),
        end_date: v.end_date.format('YYYY-MM-DD'),
        days: v.days || days,
        reason: v.reason,
        memo: v.memo,
      })
      message.success('创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      loadLeaves()
    } catch (error: any) {
      message.error(error.message || '创建失败')
    }
  }

  const handleEdit = (leave: EmployeeLeave) => {
    if (leave.status !== 'pending') {
      message.warning('只能编辑待审批的请假记录')
      return
    }
    setCurrentLeave(leave)
    editForm.setFieldsValue({
      leave_type: leave.leave_type,
      start_date: dayjs(leave.start_date),
      end_date: dayjs(leave.end_date),
      days: leave.days,
      reason: leave.reason,
      memo: leave.memo,
    })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    const v = await editForm.validateFields()
    if (!currentLeave) return
    try {
      // 计算天数（如果未手动输入）
      let days = v.days
      if (!days && v.start_date && v.end_date) {
        const start = dayjs(v.start_date)
        const end = dayjs(v.end_date)
        days = end.diff(start, 'day') + 1
      }
      
      await apiPut(api.employeeLeavesById(currentLeave.id), {
        leave_type: v.leave_type,
        start_date: v.start_date.format('YYYY-MM-DD'),
        end_date: v.end_date.format('YYYY-MM-DD'),
        days: days,
        reason: v.reason,
        memo: v.memo,
      })
      message.success('更新成功')
      setEditOpen(false)
      setCurrentLeave(null)
      editForm.resetFields()
      loadLeaves()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    }
  }

  const handleApprove = (leave: EmployeeLeave) => {
    setCurrentLeave(leave)
    approveForm.setFieldsValue({
      status: 'approved',
      memo: leave.memo,
    })
    setApproveOpen(true)
  }

  const handleApproveConfirm = async () => {
    const v = await approveForm.validateFields()
    if (!currentLeave) return
    try {
      await apiPost(api.employeeLeavesApprove(currentLeave.id), {
        status: v.status,
        memo: v.memo,
      })
      message.success(v.status === 'approved' ? '已批准' : '已拒绝')
      setApproveOpen(false)
      setCurrentLeave(null)
      approveForm.resetFields()
      loadLeaves()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(api.employeeLeavesById(id))
      message.success('删除成功')
      loadLeaves()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const columns: ColumnsType<EmployeeLeave> = [
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 120,
    },
    {
      title: '项目',
      dataIndex: 'department_name',
      key: 'department_name',
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
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
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
            <Button size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canApprove && record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleApprove(record)}>
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

  return (
    <Card
      title="员工请假管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadLeaves} loading={loading}>刷新</Button>
          {canEdit && (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建请假
            </Button>
          )}
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="新建请假"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form 
          form={createForm} 
          layout="vertical"
          onValuesChange={(changedValues, allValues) => {
            // 当开始日期或结束日期变化时，自动计算天数
            if ((changedValues.start_date || changedValues.end_date) && allValues.start_date && allValues.end_date) {
              const start = dayjs(allValues.start_date)
              const end = dayjs(allValues.end_date)
              const calculatedDays = end.diff(start, 'day') + 1
              createForm.setFieldsValue({ days: calculatedDays })
            }
          }}
        >
          <Form.Item
            name="employee_id"
            label="员工"
            rules={[{ required: true, message: '请选择员工' }]}
          >
            <Select placeholder="请选择员工" showSearch optionFilterProp="children">
              {employees.map((emp) => (
                <Option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department_name})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="leave_type"
            label="请假类型"
            rules={[{ required: true, message: '请选择请假类型' }]}
          >
            <Select placeholder="请选择请假类型">
              <Option value="sick">病假</Option>
              <Option value="annual">年假</Option>
              <Option value="personal">事假</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="start_date"
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="end_date"
            label="结束日期"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="days"
            label="请假天数"
            rules={[{ required: true, message: '请输入请假天数' }]}
            dependencies={['start_date', 'end_date']}
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
            rules={[{ required: true, message: '请输入请假原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入请假原因" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={2} placeholder="可选，备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑请假"
        open={editOpen}
        onOk={handleUpdate}
        onCancel={() => {
          setEditOpen(false)
          setCurrentLeave(null)
          editForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form 
          form={editForm} 
          layout="vertical"
          onValuesChange={(changedValues, allValues) => {
            // 当开始日期或结束日期变化时，自动计算天数
            if ((changedValues.start_date || changedValues.end_date) && allValues.start_date && allValues.end_date) {
              const start = dayjs(allValues.start_date)
              const end = dayjs(allValues.end_date)
              const calculatedDays = end.diff(start, 'day') + 1
              editForm.setFieldsValue({ days: calculatedDays })
            }
          }}
        >
          <Form.Item
            name="leave_type"
            label="请假类型"
            rules={[{ required: true, message: '请选择请假类型' }]}
          >
            <Select placeholder="请选择请假类型">
              <Option value="sick">病假</Option>
              <Option value="annual">年假</Option>
              <Option value="personal">事假</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="start_date"
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="end_date"
            label="结束日期"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="days"
            label="请假天数"
            rules={[{ required: true, message: '请输入请假天数' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.5}
              step={0.5}
              precision={1}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="请假原因"
            rules={[{ required: true, message: '请输入请假原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入请假原因" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={2} placeholder="可选，备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审批请假"
        open={approveOpen}
        onOk={handleApproveConfirm}
        onCancel={() => {
          setApproveOpen(false)
          setCurrentLeave(null)
          approveForm.resetFields()
        }}
        okText="确认"
        cancelText="取消"
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentLeave?.employee_name} disabled />
          </Form.Item>
          <Form.Item label="请假类型">
            <Input value={LEAVE_TYPE_LABELS[currentLeave?.leave_type || '']} disabled />
          </Form.Item>
          <Form.Item label="请假日期">
            <Input value={`${currentLeave?.start_date} 至 ${currentLeave?.end_date}`} disabled />
          </Form.Item>
          <Form.Item label="请假天数">
            <Input value={`${currentLeave?.days} 天`} disabled />
          </Form.Item>
          <Form.Item label="请假原因">
            <Input.TextArea value={currentLeave?.reason} rows={2} disabled />
          </Form.Item>
          <Form.Item
            name="status"
            label="审批结果"
            rules={[{ required: true, message: '请选择审批结果' }]}
          >
            <Select>
              <Option value="approved">批准</Option>
              <Option value="rejected">拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="memo" label="审批备注">
            <Input.TextArea rows={2} placeholder="可选，审批备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

