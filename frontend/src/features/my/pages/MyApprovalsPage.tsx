import { useState } from 'react'
import { Card, Tabs, Tag, Button, Space, Modal, Input, message, Badge, Typography, Empty } from 'antd'
import { CheckOutlined, CloseOutlined, CalendarOutlined, FileTextOutlined, BankOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMyPendingApprovals, useApproveLeaveMy, useRejectLeave, useApproveReimbursement, useRejectReimbursement, useApproveBorrowing, useRejectBorrowing } from '../../../hooks'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { AmountDisplay } from '../../../components/common'

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
import { DataTable } from '../../../components/common/DataTable'

export function MyApprovals() {
  const { data, isLoading: loading } = useMyPendingApprovals()
  const { mutateAsync: approveLeave } = useApproveLeaveMy()
  const { mutateAsync: rejectLeave } = useRejectLeave()
  const { mutateAsync: approveReimbursement } = useApproveReimbursement()
  const { mutateAsync: rejectReimbursement } = useRejectReimbursement()
  const { mutateAsync: approveBorrowing } = useApproveBorrowing()
  const { mutateAsync: rejectBorrowing } = useRejectBorrowing()

  const [memo, setMemo] = useState('')
  
  const {
    isOpen: actionModalVisible,
    data: actionModalData,
    openEdit: openActionModal,
    close: closeActionModal,
  } = useFormModal<{ type: string; id: string; action: 'approve' | 'reject' }>()

  const leaves = data?.leaves || []
  const reimbursements = data?.reimbursements || []
  const borrowings = data?.borrowings || []
  const counts = data?.counts || { leaves: 0, reimbursements: 0, borrowings: 0 }

  const handleAction = withErrorHandler(
    async () => {
      if (!actionModalData) return

      const { type, id, action } = actionModalData

      if (type === 'leave') {
        if (action === 'approve') {
          await approveLeave({ id, memo })
        } else {
          await rejectLeave({ id, memo })
        }
      } else if (type === 'reimbursement') {
        if (action === 'approve') {
          await approveReimbursement({ id, memo })
        } else {
          await rejectReimbursement({ id, memo })
        }
      } else if (type === 'borrowing') {
        if (action === 'approve') {
          await approveBorrowing({ id, memo })
        } else {
          await rejectBorrowing({ id, memo })
        }
      }
    },
    {
      successMessage: (_, { action }) => action === 'approve' ? '审批通过' : '已驳回',
      onSuccess: () => {
        closeActionModal()
        setMemo('')
      }
    }
  )

  const showActionModal = (type: string, id: string, action: 'approve' | 'reject') => {
    openActionModal({ type, id, action })
  }

  const leaveColumns = [
    { title: '申请人', dataIndex: 'employeeName' },
    { title: '部门', render: (_: unknown, r: PendingLeave) => r.orgDepartmentName || r.departmentName },
    { title: '类型', dataIndex: 'leaveType', render: (v: string) => leaveTypeLabels[v] || v },
    { title: '开始日期', dataIndex: 'startDate' },
    { title: '结束日期', dataIndex: 'endDate' },
    { title: '天数', dataIndex: 'days' },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: number) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作',
      render: (_: unknown, r: PendingLeave) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => showActionModal('leave', r.id, 'approve')}>通过</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => showActionModal('leave', r.id, 'reject')}>驳回</Button>
        </Space>
      )
    },
  ]

  const reimbursementColumns = [
    { title: '申请人', dataIndex: 'employeeName' },
    { title: '部门', render: (_: unknown, r: PendingReimbursement) => r.orgDepartmentName || r.departmentName },
    { title: '类型', dataIndex: 'expenseType', render: (v: string) => expenseTypeLabels[v] || v },
    { title: '费用日期', dataIndex: 'expenseDate' },
    { title: '金额', dataIndex: 'amountCents', render: (v: number, r: PendingReimbursement) => <AmountDisplay cents={v} currency={r.currency_symbol || 'CNY'} showSymbol={false} /> },
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
    { title: '金额', dataIndex: 'amountCents', render: (v: number, r: PendingBorrowing) => <AmountDisplay cents={v} currency={r.currency_symbol || 'CNY'} showSymbol={false} /> },
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
              <DataTable<any>
                columns={leaveColumns}
                data={leaves}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                tableProps={{ className: 'table-striped' }}
              />
            ) : <Empty description="暂无待审批请假" />
          },
          {
            key: 'reimbursements',
            label: <><FileTextOutlined /> 报销 <Badge count={counts.reimbursements} size="small" /></>,
            children: reimbursements.length > 0 ? (
              <DataTable<any>
                columns={reimbursementColumns}
                data={reimbursements}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                tableProps={{ className: 'table-striped' }}
              />
            ) : <Empty description="暂无待审批报销" />
          },
          {
            key: 'borrowings',
            label: <><BankOutlined /> 借支 <Badge count={counts.borrowings} size="small" /></>,
            children: borrowings.length > 0 ? (
              <DataTable<any>
                columns={borrowingColumns}
                data={borrowings}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                tableProps={{ className: 'table-striped' }}
              />
            ) : <Empty description="暂无待审批借支" />
          },
        ]} />

        {/* 审批操作弹窗 */}
        <Modal
          title={actionModalData?.action === 'approve' ? '确认通过' : '确认驳回'}
          open={actionModalVisible}
          onOk={handleAction}
          onCancel={() => { closeActionModal(); setMemo('') }}
          okText={actionModalData?.action === 'approve' ? '通过' : '驳回'}
          okButtonProps={{ danger: actionModalData?.action === 'reject' }}
        >
          <p>{actionModalData?.action === 'approve' ? '确定要通过此申请吗？' : '确定要驳回此申请吗？'}</p>
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
