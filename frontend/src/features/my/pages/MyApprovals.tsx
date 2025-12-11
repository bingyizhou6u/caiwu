import { useState, useEffect } from 'react'
import { Card, Table, Tabs, Tag, Button, Space, Modal, Input, message, Badge, Typography, Empty } from 'antd'
import { CheckOutlined, CloseOutlined, CalendarOutlined, FileTextOutlined, BankOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Title } = Typography

interface PendingLeave {
  id: string
  employeeName: string
  departmentName: string
  orgDepartmentName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  createdAt: number
}

interface PendingReimbursement {
  id: string
  employeeName: string
  departmentName: string
  orgDepartmentName: string
  expenseType: string
  amountCents: number
  currency_symbol: string
  expenseDate: string
  description: string
  createdAt: number
}

interface PendingBorrowing {
  id: string
  employeeName: string
  amountCents: number
  currency_symbol: string
  memo: string
  createdAt: number
}

interface ApprovalCounts {
  leaves: number
  reimbursements: number
  borrowings: number
}

const leaveTypeLabels: Record<string, string> = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  other: '其他',
}

const expenseTypeLabels: Record<string, string> = {
  travel: '差旅费',
  office: '办公用品',
  meal: '餐饮',
  transport: '交通',
  other: '其他',
}

import { PageContainer } from '../../../components/PageContainer'

export function MyApprovals() {
  const [loading, setLoading] = useState(true)
  const [leaves, setLeaves] = useState<PendingLeave[]>([])
  const [reimbursements, setReimbursements] = useState<PendingReimbursement[]>([])
  const [borrowings, setBorrowings] = useState<PendingBorrowing[]>([])
  const [counts, setCounts] = useState<ApprovalCounts>({ leaves: 0, reimbursements: 0, borrowings: 0 })
  const [actionModal, setActionModal] = useState<{ visible: boolean, type: string, id: string, action: 'approve' | 'reject' } | null>(null)
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<any>(api.approvals.pending)
      setLeaves(result.leaves || [])
      setReimbursements(result.reimbursements || [])
      setBorrowings(result.borrowings || [])
      setCounts(result.counts || { leaves: 0, reimbursements: 0, borrowings: 0 })
    } catch (error) {
      console.error('Failed to load approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    try {
      await apiClient.post(`/approvals/${actionModal.type}/${actionModal.id}/${actionModal.action}`, { memo })
      message.success(actionModal.action === 'approve' ? '审批通过' : '已驳回')
      setActionModal(null)
      setMemo('')
      loadData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const showActionModal = (type: string, id: string, action: 'approve' | 'reject') => {
    setActionModal({ visible: true, type, id, action })
  }

  const leaveColumns = [
    { title: '申请人', dataIndex: 'employeeName' },
    { title: '部门', render: (_: any, r: PendingLeave) => r.orgDepartmentName || r.departmentName },
    { title: '类型', dataIndex: 'leaveType', render: (v: string) => leaveTypeLabels[v] || v },
    { title: '开始日期', dataIndex: 'startDate' },
    { title: '结束日期', dataIndex: 'endDate' },
    { title: '天数', dataIndex: 'days' },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: number) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作',
      render: (_: any, r: PendingLeave) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => showActionModal('leave', r.id, 'approve')}>通过</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => showActionModal('leave', r.id, 'reject')}>驳回</Button>
        </Space>
      )
    },
  ]

  const reimbursementColumns = [
    { title: '申请人', dataIndex: 'employeeName' },
    { title: '部门', render: (_: any, r: PendingReimbursement) => r.orgDepartmentName || r.departmentName },
    { title: '类型', dataIndex: 'expenseType', render: (v: string) => expenseTypeLabels[v] || v },
    { title: '费用日期', dataIndex: 'expenseDate' },
    { title: '金额', dataIndex: 'amountCents', render: (v: number, r: PendingReimbursement) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}` },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: number) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作',
      render: (_: any, r: PendingReimbursement) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => showActionModal('reimbursement', r.id, 'approve')}>通过</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => showActionModal('reimbursement', r.id, 'reject')}>驳回</Button>
        </Space>
      )
    },
  ]

  const borrowingColumns = [
    { title: '申请人', dataIndex: 'employeeName' },
    { title: '金额', dataIndex: 'amountCents', render: (v: number, r: PendingBorrowing) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}` },
    { title: '原因', dataIndex: 'memo', ellipsis: true },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: number) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作',
      render: (_: any, r: PendingBorrowing) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => showActionModal('borrowing', r.id, 'approve')}>通过</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => showActionModal('borrowing', r.id, 'reject')}>驳回</Button>
        </Space>
      )
    },
  ]

  const totalPending = counts.leaves + counts.reimbursements + counts.borrowings

  return (
    <PageContainer
      title={
        <Space>
          我的审批
          {totalPending > 0 && <Badge count={totalPending} />}
        </Space>
      }
      breadcrumb={[{ title: '个人中心' }, { title: '我的审批' }]}
    >
      <Card bordered={false} className="page-card">
        <Tabs defaultActiveKey="leaves" items={[
          {
            key: 'leaves',
            label: <><CalendarOutlined /> 请假 <Badge count={counts.leaves} size="small" /></>,
            children: leaves.length > 0 ? (
              <Table className="table-striped" dataSource={leaves} columns={leaveColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            ) : <Empty description="暂无待审批请假" />
          },
          {
            key: 'reimbursements',
            label: <><FileTextOutlined /> 报销 <Badge count={counts.reimbursements} size="small" /></>,
            children: reimbursements.length > 0 ? (
              <Table className="table-striped" dataSource={reimbursements} columns={reimbursementColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            ) : <Empty description="暂无待审批报销" />
          },
          {
            key: 'borrowings',
            label: <><BankOutlined /> 借支 <Badge count={counts.borrowings} size="small" /></>,
            children: borrowings.length > 0 ? (
              <Table className="table-striped" dataSource={borrowings} columns={borrowingColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            ) : <Empty description="暂无待审批借支" />
          },
        ]} />

        {/* 审批操作弹窗 */}
        <Modal
          title={actionModal?.action === 'approve' ? '确认通过' : '确认驳回'}
          open={!!actionModal?.visible}
          onOk={handleAction}
          onCancel={() => { setActionModal(null); setMemo('') }}
          confirmLoading={submitting}
          okText={actionModal?.action === 'approve' ? '通过' : '驳回'}
          okButtonProps={{ danger: actionModal?.action === 'reject' }}
        >
          <p>{actionModal?.action === 'approve' ? '确定要通过此申请吗？' : '确定要驳回此申请吗？'}</p>
          <TextArea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="审批备注（可选）"
            rows={3}
          />
        </Modal>
      </Card>
    </PageContainer>
  )
}

export default MyApprovals
