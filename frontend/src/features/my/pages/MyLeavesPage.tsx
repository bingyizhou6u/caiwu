import { useState } from 'react'
import { Card, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message, Statistic, Row, Col, Typography, Alert } from 'antd'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMyLeaves, useCreateMyLeave, type MyLeave } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { z } from 'zod'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title } = Typography

// Zod schema for leave creation
const createLeaveSchema = z.object({
  leave_type: z.string().min(1, '请选择请假类型'),
  dateRange: z.array(z.any()).length(2, '请选择请假日期范围'),
  days: z.number().min(0.5, '请假天数必须大于0'),
  reason: z.string().optional(),
})

type CreateLeaveFormData = z.infer<typeof createLeaveSchema>

const leaveTypeLabels: Record<string, string> = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  other: '其他',
}


import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, StatusTag, EmptyText } from '../../../components/common'
import { LEAVE_STATUS } from '../../../utils/status'

export function MyLeaves() {
  const { data, isLoading: loading } = useMyLeaves()
  const { mutateAsync: createLeave } = useCreateMyLeave()
  const { form, validateWithZod: validateCreate } = useZodForm(createLeaveSchema)
  
  const {
    isOpen: modalVisible,
    openCreate,
    close: closeModal,
  } = useFormModal()

  const leaves = data?.leaves || []
  const stats = data?.stats || []

  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateCreate()
      const [startDate, endDate] = values.dateRange

      await createLeave({
        leave_type: values.leave_type,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        days: values.days,
        reason: values.reason,
      })
    },
    {
      successMessage: '请假申请已提交',
      onSuccess: () => {
        closeModal()
        form.resetFields()
      }
    }
  )

  const getUsedDays = (type: string) => {
    const stat = stats.find((s: any) => s.leaveType === type)
    return stat?.usedDays || 0
  }

  const columns: DataTableColumn<MyLeave>[] = [
    { title: '类型', dataIndex: 'leaveType', key: 'leaveType', render: (v: string) => leaveTypeLabels[v] || v },
    { title: '开始日期', dataIndex: 'startDate', key: 'startDate' },
    { title: '结束日期', dataIndex: 'endDate', key: 'endDate' },
    { title: '天数', dataIndex: 'days', key: 'days' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string | null) => <StatusTag status={v} statusMap={LEAVE_STATUS} />
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '审批人', dataIndex: 'approvedByName', key: 'approvedByName' },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: number | null) => <EmptyText value={v ? dayjs(v).format('YYYY-MM-DD HH:mm') : null} />
    },
  ]

  return (
    <PageContainer
      title="我的请假"
      breadcrumb={[{ title: '个人中心' }, { title: '我的请假' }]}
    >
      <Card bordered className="page-card page-card-outer">
        {/* 假期统计 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic title="年假已用" value={getUsedDays('annual')} suffix="天" prefix={<CalendarOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic title="病假已用" value={getUsedDays('sick')} suffix="天" />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic title="事假已用" value={getUsedDays('personal')} suffix="天" />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic title="其他已用" value={getUsedDays('other')} suffix="天" />
            </Card>
          </Col>
        </Row>

        <Card
          title="请假记录"
          bordered={false}
          className="page-card-inner"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { openCreate(); form.resetFields() }}>
              发起请假
            </Button>
          }
        >
        <DataTable<any>
          columns={columns}
          data={leaves}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          tableProps={{ className: 'table-striped' }}
        />
        </Card>
      </Card>

      {/* 请假表单 */}
      <Modal
        title="发起请假申请"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { closeModal(); form.resetFields() }}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="leave_type" label="请假类型" rules={[{ required: true, message: '请选择请假类型' }]}>
            <Select>
              <Select.Option value="annual">年假</Select.Option>
              <Select.Option value="sick">病假</Select.Option>
              <Select.Option value="personal">事假</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="请假日期" rules={[{ required: true, message: '请选择日期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="days" label="请假天数" rules={[{ required: true, message: '请输入天数' }]}>
            <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} placeholder="支持0.5天" />
          </Form.Item>
          <Form.Item name="reason" label="请假原因">
            <TextArea rows={3} placeholder="请输入请假原因" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default MyLeaves
