import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message, Statistic, Row, Col, Typography } from 'antd'
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Title } = Typography

interface Reimbursement {
  id: string
  expenseType: string
  amountCents: number
  currencyId: string
  currency_symbol: string
  expenseDate: string
  description: string
  status: string
  approvedByName: string
  createdAt: number
}

interface Stats {
  status: string
  count: number
  totalCents: number
}

const expenseTypeLabels: Record<string, string> = {
  travel: '差旅费',
  office: '办公用品',
  meal: '餐饮',
  transport: '交通',
  other: '其他',
}

const statusColors: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  paid: 'default',
}

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  paid: '已支付',
}

import { PageContainer } from '../../../components/PageContainer'

export function MyReimbursements() {
  const [loading, setLoading] = useState(true)
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [stats, setStats] = useState<Stats[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<any>(api.my.reimbursements)
      setReimbursements(result.reimbursements || [])
      setStats(result.stats || [])
    } catch (error) {
      console.error('Failed to load reimbursements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      await apiClient.post(api.my.reimbursements, {
        expenseType: values.expenseType,
        amountCents: Math.round(values.amount * 100),
        currencyId: values.currencyId || 'CNY',
        expenseDate: values.expenseDate.format('YYYY-MM-DD'),
        description: values.description,
        voucherUrl: values.voucherUrl,
      })

      message.success('报销申请已提交')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatValue = (status: string) => {
    const stat = stats.find(s => s.status === status)
    return stat?.totalCents || 0
  }

  const columns = [
    { title: '类型', dataIndex: 'expenseType', render: (v: string) => expenseTypeLabels[v] || v },
    { title: '费用日期', dataIndex: 'expenseDate' },
    {
      title: '金额',
      dataIndex: 'amountCents',
      render: (v: number, r: Reimbursement) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}`
    },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
    },
    { title: '审批人', dataIndex: 'approvedByName' },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
  ]

  return (
    <PageContainer
      title="我的报销"
      breadcrumb={[{ title: '个人中心' }, { title: '我的报销' }]}
    >
      {/* 报销统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待审批"
              value={getStatValue('pending') / 100}
              suffix="元"
              prefix={<FileTextOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已通过"
              value={getStatValue('approved') / 100}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已驳回"
              value={getStatValue('rejected') / 100}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已支付"
              value={getStatValue('paid') / 100}
              suffix="元"
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="报销记录"
        bordered={false}
        className="page-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            发起报销
          </Button>
        }
      >
        <Table
          className="table-striped"
          dataSource={reimbursements}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 报销表单 */}
      <Modal
        title="发起报销申请"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" initialValues={{ currencyId: 'CNY' }}>
          <Form.Item name="expenseType" label="费用类型" rules={[{ required: true, message: '请选择费用类型' }]}>
            <Select>
              <Select.Option value="travel">差旅费</Select.Option>
              <Select.Option value="office">办公用品</Select.Option>
              <Select.Option value="meal">餐饮</Select.Option>
              <Select.Option value="transport">交通</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="expenseDate" label="费用日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="amount" label="金额（元）" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item name="currencyId" label="币种">
            <Select>
              <Select.Option value="CNY">人民币 (CNY)</Select.Option>
              <Select.Option value="USD">美元 (USD)</Select.Option>
              <Select.Option value="USDT">USDT</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="费用说明" rules={[{ required: true, message: '请输入说明' }]}>
            <TextArea rows={3} placeholder="请输入费用说明" />
          </Form.Item>
          <Form.Item name="voucherUrl" label="凭证链接">
            <Input placeholder="可选，填写凭证图片链接" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default MyReimbursements
