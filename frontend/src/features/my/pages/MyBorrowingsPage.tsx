import { useState } from 'react'
import { Card, Button, Tag, Space, Modal, Form, Select, InputNumber, Input, message, Statistic, Row, Col, Typography, Progress } from 'antd'
import { PlusOutlined, BankOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMyBorrowings, useCreateMyBorrowing } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { z } from 'zod'

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


import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, AmountDisplay, StatusTag, EmptyText } from '../../../components/common'
import { BORROWING_STATUS } from '../../../utils/status'

const createBorrowingSchema = z.object({
  amount: z.number().min(0.01, '金额必须大于0'),
  currency: z.string().optional(),
  memo: z.string().optional(),
})

type CreateBorrowingFormData = z.infer<typeof createBorrowingSchema>

export function MyBorrowings() {
  const { data, isLoading: loading } = useMyBorrowings()
  const { mutateAsync: createBorrowing } = useCreateMyBorrowing()
  const { form, validateWithZod: validateCreate } = useZodForm(createBorrowingSchema)
  
  const {
    isOpen: modalVisible,
    openCreate,
    close: closeModal,
  } = useFormModal()

  const borrowings = data?.borrowings || []
  const stats = data?.stats || { totalBorrowedCents: 0, totalRepaidCents: 0, balanceCents: 0 }

  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateCreate()

      await createBorrowing({
        amountCents: Math.round(values.amount * 100),
        currency: values.currency || 'CNY',
        memo: values.memo,
      })
    },
    {
      successMessage: '借支申请已提交',
      onSuccess: () => {
        closeModal()
        form.resetFields()
      }
    }
  )

  const repaymentProgress = stats.totalBorrowedCents > 0
    ? Math.round((stats.totalRepaidCents / stats.totalBorrowedCents) * 100)
    : 100

  const columns: DataTableColumn<Borrowing>[] = [
    { title: '借支日期', dataIndex: 'borrow_date', key: 'borrow_date' },
    {
      title: '金额',
      key: 'amount',
      render: (_: unknown, r: Borrowing) => <AmountDisplay cents={r.amountCents} currency={r.currency} showSymbol={false} />
    },
    {
      title: '已还',
      key: 'repaid',
      render: (_: unknown, r: Borrowing) => <AmountDisplay cents={r.repaid_cents || 0} currency={r.currency} showSymbol={false} />
    },
    {
      title: '余额',
      key: 'balance',
      render: (_: unknown, r: Borrowing) => {
        const balance = r.amountCents - (r.repaid_cents || 0)
        return (
          <AmountDisplay 
            cents={balance} 
            currency={r.currency} 
            showSymbol={false}
            style={{ color: balance > 0 ? '#cf1322' : '#3f8600' }}
          />
        )
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string | null) => <StatusTag status={v} statusMap={BORROWING_STATUS} />
    },
    { title: '备注', dataIndex: 'memo', key: 'memo', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: number | null) => <EmptyText value={v ? dayjs(v).format('YYYY-MM-DD HH:mm') : null} />
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { openCreate(); form.resetFields() }}>
            申请借支
          </Button>
        }
      >
        <DataTable<any>
          columns={columns}
          data={borrowings}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          tableProps={{ className: 'table-striped' }}
        />
      </Card>

      {/* 借支表单 */}
      <Modal
        title="申请借支"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { closeModal(); form.resetFields() }}
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
