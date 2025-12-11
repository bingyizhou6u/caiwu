import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, DatePicker, InputNumber, Upload } from 'antd'
import { api } from '../../../config/api'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'
import { EyeOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons'
import { formatAmount } from '../../../utils/formatters'
import { loadCurrencies, loadAccounts, loadExpenseCategories, loadEmployees } from '../../../utils/loaders'
import { uploadImageAsWebP } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useApproveExpense, usePayExpense } from '../../../hooks/business/useExpenses'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { expenseSchema, approveExpenseSchema } from '../../../validations/expense.schema'
import type { ExpenseReimbursement } from '../../../hooks/business/useExpenses'

const { Option } = Select
const { TextArea } = Input

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  travel: '差旅费',
  office: '办公用品',
  meal: '餐饮',
  transport: '交通',
  other: '其他',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  paid: '已支付',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  paid: 'blue',
}

import { PageContainer } from '../../../components/PageContainer'

export function ExpenseReimbursement() {
  const { data: expenses = [], isLoading, refetch } = useExpenses()
  const { mutateAsync: createExpense } = useCreateExpense()
  const { mutateAsync: updateExpense } = useUpdateExpense()
  const { mutateAsync: deleteExpense } = useDeleteExpense()
  const { mutateAsync: approveExpense } = useApproveExpense()
  const { mutateAsync: payExpense } = usePayExpense()

  const [employees, setEmployees] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [createVoucherFile, setCreateVoucherFile] = useState<File | null>(null)
  const [editVoucherFile, setEditVoucherFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { hasPermission, canManageSubordinates, isManager: _isManager } = usePermissions()
  const canEdit = hasPermission('hr', 'reimbursement', 'view')
  const canApprove = hasPermission('hr', 'reimbursement', 'approve') || canManageSubordinates
  const isManager = _isManager()

  const {
    isOpen: createOpen,
    openCreate,
    close: closeCreate,
  } = useFormModal<ExpenseReimbursement>()

  const {
    isOpen: editOpen,
    data: editRow,
    openEdit,
    close: closeEdit,
  } = useFormModal<ExpenseReimbursement>()

  const {
    isOpen: approveOpen,
    data: approveRow,
    openEdit: openApprove,
    close: closeApprove,
  } = useFormModal<ExpenseReimbursement>()

  const { form: createForm, validateWithZod: validateCreate } = useZodForm(expenseSchema)
  const { form: editForm, validateWithZod: validateEdit } = useZodForm(expenseSchema)
  const { form: approveForm, validateWithZod: validateApprove } = useZodForm(approveExpenseSchema)

  useEffect(() => {
    loadMasterData()
  }, [])

  const loadMasterData = async () => {
    try {
      const [currenciesData, accountsData, categoriesData, employeesData] = await Promise.all([
        loadCurrencies(),
        loadAccounts(),
        loadExpenseCategories(),
        loadEmployees()
      ])
      // 将SelectOption格式转换为原始格式
      setCurrencies(currenciesData.map(c => ({
        id: c.value as string,
        code: c.value as string,
        name: c.label.split(' - ')[1] || c.label
      })))
      setAccounts(accountsData.map(a => ({
        id: a.value as string,
        name: a.label.split(' (')[0],
        currency: a.currency
      })))
      setCategories(categoriesData.map(c => ({
        id: c.value as string,
        name: c.label,
        kind: 'expense'
      })))
      setEmployees(employeesData.map(e => ({
        id: e.value as string,
        name: e.label.split(' (')[0],
        active: 1
      })))
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  const uploadVoucher = async (file: File): Promise<string> => {
    return uploadImageAsWebP(file, api.upload.voucher)
  }

  const handleCreate = withErrorHandler(
    async () => {
      setSubmitting(true)
      try {
        const values = await validateCreate()

        // 必须上传凭证
        if (!createVoucherFile) {
          throw new Error('请上传凭证')
        }

        // 先上传凭证
        const voucherUrl = await uploadVoucher(createVoucherFile)

        await createExpense({
          ...values,
          amountCents: Math.round(values.amount * 100),
          expenseDate: dayjs(values.expenseDate).format('YYYY-MM-DD'),
          voucherUrl: voucherUrl,
        })
        closeCreate()
        createForm.resetFields()
        setCreateVoucherFile(null)
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
        let voucherUrl = editRow.voucherUrl

        // 如果有上传的新文件，先上传凭证
        if (editVoucherFile) {
          voucherUrl = await uploadVoucher(editVoucherFile)
        }

        await updateExpense({
          id: editRow.id,
          data: {
            ...values,
            amountCents: Math.round(values.amount * 100),
            expenseDate: dayjs(values.expenseDate).format('YYYY-MM-DD'),
            voucherUrl: voucherUrl,
          }
        })
        closeEdit()
        editForm.resetFields()
        setEditVoucherFile(null)
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
        await approveExpense({
          id: approveRow.id,
          status: values.status,
          accountId: values.status === 'approved' ? values.accountId : undefined,
          categoryId: values.status === 'approved' ? values.categoryId : undefined,
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

  const handlePay = withErrorHandler(
    async (id: string) => {
      await payExpense(id)
    },
    { successMessage: '已标记为已支付' }
  )

  const handleDelete = withErrorHandler(
    async (id: string) => {
      await deleteExpense(id)
    },
    { successMessage: '删除成功' }
  )

  const handlePreview = (voucherUrl: string) => {
    setPreviewUrl(voucherUrl)
    setPreviewOpen(true)
  }

  const onEdit = (record: ExpenseReimbursement) => {
    if (record.status !== 'pending') {
      message.warning('只能编辑待审批的报销记录')
      return
    }
    editForm.setFieldsValue({
      ...record,
      amount: record.amountCents / 100,
      expenseDate: dayjs(record.expenseDate),
    })
    setEditVoucherFile(null)
    openEdit(record)
  }

  const onApprove = (record: ExpenseReimbursement) => {
    approveForm.setFieldsValue({
      status: 'approved',
      accountId: record.accountId,
      categoryId: undefined,
      memo: record.memo,
    })
    openApprove(record)
  }

  const columns: ColumnsType<ExpenseReimbursement> = [
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
      title: '报销类型',
      dataIndex: 'expenseType',
      key: 'expenseType',
      width: 100,
      render: (type: string) => EXPENSE_TYPE_LABELS[type] || type,
    },
    {
      title: '报销金额',
      dataIndex: 'amountCents',
      key: 'amountCents',
      width: 120,
      align: 'right',
      render: (cents: number, record: ExpenseReimbursement) => (
        <span>
          {formatAmount(cents)}
          {record.currencyCode && <span style={{ color: '#999', marginLeft: 4 }}>({record.currencyCode})</span>}
        </span>
      ),
    },
    {
      title: '报销日期',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
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
      title: '报销说明',
      dataIndex: 'description',
      key: 'description',
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
      title: '支出账户',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '凭证',
      key: 'voucher',
      width: 80,
      render: (_: any, record: ExpenseReimbursement) => {
        if (!record.voucherUrl) return '-'
        return (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.voucherUrl!)}
          >
            查看
          </Button>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_: any, record: ExpenseReimbursement) => (
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
          {canApprove && record.status === 'approved' && (
            <Button size="small" type="primary" onClick={() => handlePay(record.id)}>
              标记已支付
            </Button>
          )}
          {isManager && (
            <Popconfirm
              title="确定要删除这条报销记录吗？"
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
    <PageContainer
      title="员工报销管理"
      breadcrumb={[{ title: '人事管理' }, { title: '员工报销管理' }]}
    >
      <Card
        title="员工报销管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
            {canEdit && (
              <Button type="primary" onClick={openCreate}>
                新建报销
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
          dataSource={expenses}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />

        <Modal
          title="新建报销"
          open={createOpen}
          onOk={handleCreate}
          onCancel={() => {
            closeCreate()
            createForm.resetFields()
            setCreateVoucherFile(null)
          }}
          okText="创建"
          cancelText="取消"
          width={600}
          confirmLoading={submitting}
        >
          <Form form={createForm} layout="vertical">
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
            <Form.Item
              name="expenseType"
              label="报销类型"
            >
              <Select placeholder="请选择报销类型">
                <Option value="travel">差旅费</Option>
                <Option value="office">办公用品</Option>
                <Option value="meal">餐饮</Option>
                <Option value="transport">交通</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="currencyId"
              label="币种"
            >
              <Select placeholder="请选择币种">
                {currencies.map((curr) => (
                  <Option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="amount"
              label="报销金额"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入报销金额"
              />
            </Form.Item>
            <Form.Item
              name="expenseDate"
              label="报销日期"
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="description"
              label="报销说明"
            >
              <TextArea rows={3} placeholder="请输入报销说明" />
            </Form.Item>
            <Form.Item
              name="voucher"
              label="凭证"
              required
            >
              <Upload
                beforeUpload={(file) => {
                  if (!file.type.startsWith('image/')) {
                    message.error('只能上传图片文件')
                    return false
                  }
                  setCreateVoucherFile(file)
                  return false
                }}
                onRemove={() => {
                  setCreateVoucherFile(null)
                  createForm.setFieldsValue({ voucher: undefined })
                }}
                maxCount={1}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>上传凭证</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={2} placeholder="可选，备注信息" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="编辑报销"
          open={editOpen}
          onOk={handleUpdate}
          onCancel={() => {
            closeEdit()
            editForm.resetFields()
            setEditVoucherFile(null)
          }}
          okText="保存"
          cancelText="取消"
          width={600}
          confirmLoading={submitting}
        >
          <Form form={editForm} layout="vertical">
            <Form.Item
              name="expenseType"
              label="报销类型"
            >
              <Select placeholder="请选择报销类型">
                <Option value="travel">差旅费</Option>
                <Option value="office">办公用品</Option>
                <Option value="meal">餐饮</Option>
                <Option value="transport">交通</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="currencyId"
              label="币种"
            >
              <Select placeholder="请选择币种">
                {currencies.map((curr) => (
                  <Option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="amount"
              label="报销金额"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
              />
            </Form.Item>
            <Form.Item
              name="expenseDate"
              label="报销日期"
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="description"
              label="报销说明"
            >
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item name="voucher" label="凭证">
              <Upload
                beforeUpload={(file) => {
                  if (!file.type.startsWith('image/')) {
                    message.error('只能上传图片文件')
                    return false
                  }
                  setEditVoucherFile(file)
                  return false
                }}
                onRemove={() => {
                  setEditVoucherFile(null)
                  editForm.setFieldsValue({ voucher: undefined })
                }}
                maxCount={1}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>
                  {editRow?.voucherUrl ? '重新上传' : '上传凭证'}
                </Button>
              </Upload>
              {editRow?.voucherUrl && !editVoucherFile && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(editRow.voucherUrl!)}
                  >
                    查看当前凭证
                  </Button>
                </div>
              )}
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={2} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="审批报销"
          open={approveOpen}
          onOk={handleApproveConfirm}
          onCancel={() => {
            closeApprove()
            approveForm.resetFields()
          }}
          okText="确认"
          cancelText="取消"
          width={600}
          confirmLoading={submitting}
        >
          <Form form={approveForm} layout="vertical">
            <Form.Item label="员工姓名">
              <Input value={approveRow?.employeeName} disabled />
            </Form.Item>
            <Form.Item label="报销类型">
              <Input value={EXPENSE_TYPE_LABELS[approveRow?.expenseType || '']} disabled />
            </Form.Item>
            <Form.Item label="报销金额">
              <Input value={`${formatAmount(approveRow?.amountCents || 0)} (${approveRow?.currencyCode || '-'})`} disabled />
            </Form.Item>
            <Form.Item label="报销日期">
              <Input value={approveRow?.expenseDate} disabled />
            </Form.Item>
            <Form.Item label="报销说明">
              <TextArea value={approveRow?.description} rows={3} disabled />
            </Form.Item>
            {approveRow?.voucherUrl && (
              <Form.Item label="凭证">
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => handlePreview(approveRow.voucherUrl!)}
                >
                  查看凭证
                </Button>
              </Form.Item>
            )}
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
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
            >
              {({ getFieldValue }) => {
                const status = getFieldValue('status')
                if (status === 'approved') {
                  return (
                    <>
                      <Form.Item
                        name="accountId"
                        label="支出账户"
                        dependencies={['status']}
                      >
                        <Select
                          placeholder="请选择支出账户"
                          showSearch
                          optionFilterProp="children"
                          filterOption={(input, option) =>
                            String(option?.label || "").toLowerCase().includes(input.toLowerCase())
                          }
                        >
                          {accounts
                            .filter((acc: any) => acc.currency === approveRow?.currencyId)
                            .map((acc: any) => (
                              <Option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.currencyCode})
                              </Option>
                            ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        name="categoryId"
                        label="支出类别"
                        dependencies={['status']}
                      >
                        <Select placeholder="请选择支出类别" showSearch optionFilterProp="children">
                          {categories.map((cat: any) => (
                            <Option key={cat.id} value={cat.id}>
                              {cat.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </>
                  )
                }
                return null
              }}
            </Form.Item>
            <Form.Item name="memo" label="审批备注">
              <TextArea rows={2} placeholder="可选，审批备注" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="查看凭证"
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          footer={null}
          width={800}
        >
          <img src={previewUrl} alt="凭证" style={{ width: '100%' }} />
        </Modal>
      </Card>
    </PageContainer>
  )
}

