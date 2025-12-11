import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message, Statistic, Row, Col, Typography, Alert } from 'antd'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title } = Typography

interface Leave {
  id: string
  leave_type: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason: string
  approvedByName: string
  createdAt: number
}

interface LeaveStats {
  leave_type: string
  used_days: number
}

interface AnnualLeaveInfo {
  cycleMonths: number
  cycleNumber: number
  cycleStart: string
  cycleEnd: string
  isFirstCycle: boolean
  entitledDays: number
  usedDays: number
  remainingDays: number
}

const leaveTypeLabels: Record<string, string> = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  other: '其他',
}

const statusColors: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
}

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

import { PageContainer } from '../../../components/PageContainer'

export function MyLeaves() {
  const [loading, setLoading] = useState(true)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [stats, setStats] = useState<LeaveStats[]>([])
  const [annualLeaveInfo, setAnnualLeaveInfo] = useState<AnnualLeaveInfo | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<any>(api.my.leaves)
      setLeaves(result.leaves || [])
      setStats(result.stats || [])
    } catch (error) {
      console.error('Failed to load leaves:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const [startDate, endDate] = values.dateRange

      await apiClient.post(api.my.leaves, {
        leave_type: values.leave_type,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        days: values.days,
        reason: values.reason,
      })

      message.success('请假申请已提交')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getUsedDays = (type: string) => {
    const stat = stats.find(s => s.leave_type === type)
    return stat?.used_days || 0
  }

  const columns = [
    { title: '类型', dataIndex: 'leave_type', render: (v: string) => leaveTypeLabels[v] || v },
    { title: '开始日期', dataIndex: 'startDate' },
    { title: '结束日期', dataIndex: 'endDate' },
    { title: '天数', dataIndex: 'days' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
    },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '审批人', dataIndex: 'approvedByName' },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
  ]

  return (
    <PageContainer
      title="我的请假"
      breadcrumb={[{ title: '个人中心' }, { title: '我的请假' }]}
    >
      {/* 年假周期信息 */}
      {annualLeaveInfo && !annualLeaveInfo.isFirstCycle && (
        <Alert
          message={`当前年假周期（第${annualLeaveInfo.cycleNumber}周期）`}
          description={`${annualLeaveInfo.cycleStart} 至 ${annualLeaveInfo.cycleEnd}，本周期可用 ${annualLeaveInfo.entitledDays} 天，已用 ${annualLeaveInfo.usedDays} 天，剩余 ${annualLeaveInfo.remainingDays} 天`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
      {annualLeaveInfo?.isFirstCycle && (
        <Alert
          message="试用期内暂无年假"
          description="入职第一周期内不享有年假，请等待下一周期开始"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 假期统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="年假已用" value={getUsedDays('annual')} suffix="天" prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="病假已用" value={getUsedDays('sick')} suffix="天" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="事假已用" value={getUsedDays('personal')} suffix="天" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="其他已用" value={getUsedDays('other')} suffix="天" />
          </Card>
        </Col>
      </Row>

      <Card
        title="请假记录"
        bordered={false}
        className="page-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            发起请假
          </Button>
        }
      >
        <Table
          className="table-striped"
          dataSource={leaves}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 请假表单 */}
      <Modal
        title="发起请假申请"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
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
