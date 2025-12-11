import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Select, InputNumber, Input, message, Statistic, Row, Col, Typography, Progress } from 'antd'
import { PlusOutlined, BankOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Title } = Typography

interface Borrowing {
  id: string
  amountCents: number
  currency: string
  currency_symbol: string
  borrow_date: string
  memo: string
  status: string
  accountName: string
  repaid_cents: number
  createdAt: number
}

interface Stats {
  totalBorrowedCents: number
  totalRepaidCents: number
  balanceCents: number
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

export function MyBorrowings() {
  const [loading, setLoading] = useState(true)
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [stats, setStats] = useState<Stats>({ totalBorrowedCents: 0, totalRepaidCents: 0, balanceCents: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<any>(api.my.borrowings)
      setBorrowings(result.borrowings || [])
      setStats(result.stats || { totalBorrowedCents: 0, totalRepaidCents: 0, balanceCents: 0 })
    } catch (error) {
      console.error('Failed to load borrowings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      await apiClient.post(api.my.borrowings, {
        amountCents: Math.round(values.amount * 100),
        currency: values.currency || 'CNY',
        memo: values.memo,
      })

      message.success('借支申请已提交')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const repaymentProgress = stats.totalBorrowedCents > 0
    ? Math.round((stats.totalRepaidCents / stats.totalBorrowedCents) * 100)
    : 100

  const columns = [
    { title: '借支日期', dataIndex: 'borrow_date' },
    {
      title: '金额',
      dataIndex: 'amountCents',
      render: (v: number, r: Borrowing) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}`
    },
    {
      title: '已还',
      dataIndex: 'repaid_cents',
      render: (v: number, r: Borrowing) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}`
    },
    {
      title: '余额',
      render: (_: any, r: Borrowing) => {
        const balance = r.amountCents - r.repaid_cents
        return <span style={{ color: balance > 0 ? '#cf1322' : '#3f8600' }}>
          {r.currency_symbol || '¥'}{(balance / 100).toFixed(2)}
        </span>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
    },
    { title: '备注', dataIndex: 'memo', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
  ]

  return (
    <PageContainer
      title="我的借支"
      breadcrumb={[{ title: '个人中心' }, { title: '我的借支' }]}
    >
      {/* 借支统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="累计借支"
              value={stats.totalBorrowedCents / 100}
              suffix="元"
              prefix={<BankOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="累计还款"
              value={stats.totalRepaidCents / 100}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="待还余额"
              value={stats.balanceCents / 100}
              suffix="元"
              precision={2}
              valueStyle={{ color: stats.balanceCents > 0 ? '#cf1322' : '#3f8600' }}
            />
            <Progress
              percent={repaymentProgress}
              size="small"
              status={repaymentProgress === 100 ? 'success' : 'active'}
              format={() => `已还 ${repaymentProgress}%`}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="借支记录"
        bordered={false}
        className="page-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            申请借支
          </Button>
        }
      >
        <Table
          className="table-striped"
          dataSource={borrowings}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 借支表单 */}
      <Modal
        title="申请借支"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" initialValues={{ currency: 'CNY' }}>
          <Form.Item name="amount" label="借支金额（元）" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0.01} step={100} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item name="currency" label="币种">
            <Select>
              <Select.Option value="CNY">人民币 (CNY)</Select.Option>
              <Select.Option value="USD">美元 (USD)</Select.Option>
              <Select.Option value="USDT">USDT</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="memo" label="借支原因">
            <TextArea rows={3} placeholder="请输入借支原因" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default MyBorrowings
