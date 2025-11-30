import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, message, Select, Popconfirm, Tag, DatePicker, InputNumber, Upload } from 'antd'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'
import { EyeOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons'
import { apiGet, apiPost, apiPut, apiDelete, safeApiCall, handleConflictError } from '../utils/api'
import { formatAmount } from '../utils/formatters'
import { loadCurrencies, loadAccounts, loadExpenseCategories, loadEmployees } from '../utils/loaders'
import { convertToWebP, uploadImageAsWebP } from '../utils/image'
import { usePermissions } from '../utils/permissions'

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

type ExpenseReimbursement = {
  id: string
  employee_id: string
  employee_name?: string
  department_id?: string
  department_name?: string
  expense_type: string
  amount_cents: number
  expense_date: string
  description: string
  currency_id?: string
  currency_code?: string
  currency_name?: string
  account_id?: string
  account_name?: string
  voucher_url?: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  memo?: string
  approved_by?: string
  approver_name?: string
  approved_at?: number
  paid_at?: number
  created_by?: string
  creator_name?: string
  created_at: number
}

export function ExpenseReimbursement() {
  const [data, setData] = useState<ExpenseReimbursement[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [currentReimbursement, setCurrentReimbursement] = useState<ExpenseReimbursement | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [approveForm] = Form.useForm()
  const [createVoucherFile, setCreateVoucherFile] = useState<File | null>(null)
  const [editVoucherFile, setEditVoucherFile] = useState<File | null>(null)
  
  const { hasPermission, canManageSubordinates, isManager: _isManager } = usePermissions()
  const canEdit = hasPermission('hr', 'reimbursement', 'view')
  const canApprove = hasPermission('hr', 'reimbursement', 'approve') || canManageSubordinates
  const isManager = _isManager()

  const loadReimbursements = async () => {
    setLoading(true)
    const result = await safeApiCall(() => apiGet(api.expenseReimbursements), '获取报销记录失败')
    if (result) setData(result)
    setLoading(false)
  }

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

  useEffect(() => {
    loadReimbursements()
    loadMasterData()
  }, [])

  const uploadVoucher = async (file: File): Promise<string> => {
    return uploadImageAsWebP(file, api.upload.voucher)
  }

  const handleCreate = async () => {
    const v = await createForm.validateFields()
    try {
      // 必须上传凭证
      if (!createVoucherFile) {
        message.error('请上传凭证')
        return
      }
      
      // 先上传凭证
      const voucherUrl = await uploadVoucher(createVoucherFile)
      
      await apiPost(api.expenseReimbursements, {
        employee_id: v.employee_id,
        expense_type: v.expense_type,
        amount_cents: Math.round(v.amount * 100),
        expense_date: v.expense_date.format('YYYY-MM-DD'),
        description: v.description,
        currency_id: v.currency_id,
        voucher_url: voucherUrl,
        memo: v.memo,
      })
      message.success('创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      setCreateVoucherFile(null)
      loadReimbursements()
    } catch (error: any) {
      message.error(error.message || '创建失败')
    }
  }

  const handleEdit = (reimbursement: ExpenseReimbursement) => {
    if (reimbursement.status !== 'pending') {
      message.warning('只能编辑待审批的报销记录')
      return
    }
    setCurrentReimbursement(reimbursement)
    editForm.setFieldsValue({
      expense_type: reimbursement.expense_type,
      amount: reimbursement.amount_cents / 100,
      expense_date: dayjs(reimbursement.expense_date),
      description: reimbursement.description,
      currency_id: reimbursement.currency_id,
      voucher_url: reimbursement.voucher_url,
      memo: reimbursement.memo,
    })
    setEditVoucherFile(null)
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    const v = await editForm.validateFields()
    if (!currentReimbursement) return
    try {
      let voucherUrl = v.voucher_url
      
      // 如果有上传的新文件，先上传凭证
      if (editVoucherFile) {
        voucherUrl = await uploadVoucher(editVoucherFile)
      }
      
      await apiPut(api.expenseReimbursementsById(currentReimbursement.id), {
        expense_type: v.expense_type,
        amount_cents: Math.round(v.amount * 100),
        expense_date: v.expense_date.format('YYYY-MM-DD'),
        description: v.description,
        currency_id: v.currency_id,
        voucher_url: voucherUrl,
        memo: v.memo,
      })
      message.success('更新成功')
      setEditOpen(false)
      setCurrentReimbursement(null)
      editForm.resetFields()
      setEditVoucherFile(null)
      loadReimbursements()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    }
  }

  const handleApprove = (reimbursement: ExpenseReimbursement) => {
    setCurrentReimbursement(reimbursement)
    approveForm.setFieldsValue({
      status: 'approved',
      account_id: reimbursement.account_id,
      category_id: undefined,
      memo: reimbursement.memo,
    })
    setApproveOpen(true)
  }

  const handleApproveConfirm = async () => {
    const v = await approveForm.validateFields()
    if (!currentReimbursement) return
    try {
      await apiPost(api.expenseReimbursementsApprove(currentReimbursement.id), {
        status: v.status,
        account_id: v.status === 'approved' ? v.account_id : undefined,
        category_id: v.status === 'approved' ? v.category_id : undefined,
        memo: v.memo,
      })
      message.success(v.status === 'approved' ? '已批准' : '已拒绝')
      setApproveOpen(false)
      setCurrentReimbursement(null)
      approveForm.resetFields()
      loadReimbursements()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handlePay = async (id: string) => {
    try {
      await apiPost(api.expenseReimbursementsPay(id), {})
      message.success('已标记为已支付')
      loadReimbursements()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(api.expenseReimbursementsById(id))
      message.success('删除成功')
      loadReimbursements()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const handlePreview = (voucherUrl: string) => {
    setPreviewUrl(voucherUrl)
    setPreviewOpen(true)
  }

  const columns: ColumnsType<ExpenseReimbursement> = [
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
      title: '报销类型',
      dataIndex: 'expense_type',
      key: 'expense_type',
      width: 100,
      render: (type: string) => EXPENSE_TYPE_LABELS[type] || type,
    },
    {
      title: '报销金额',
      dataIndex: 'amount_cents',
      key: 'amount_cents',
      width: 120,
      align: 'right',
      render: (cents: number, record: ExpenseReimbursement) => (
        <span>
          {formatAmount(cents)}
          {record.currency_code && <span style={{ color: '#999', marginLeft: 4 }}>({record.currency_code})</span>}
        </span>
      ),
    },
    {
      title: '报销日期',
      dataIndex: 'expense_date',
      key: 'expense_date',
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
      dataIndex: 'account_name',
      key: 'account_name',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '凭证',
      key: 'voucher',
      width: 80,
      render: (_: any, record: ExpenseReimbursement) => {
        if (!record.voucher_url) return '-'
        return (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.voucher_url!)}
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
            <Button size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canApprove && record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleApprove(record)}>
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
    <Card
      title="员工报销管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadReimbursements} loading={loading}>刷新</Button>
          {canEdit && (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建报销
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
        scroll={{ x: 1400 }}
      />

      <Modal
        title="新建报销"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
          setCreateVoucherFile(null)
        }}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Form form={createForm} layout="vertical">
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
            name="expense_type"
            label="报销类型"
            rules={[{ required: true, message: '请选择报销类型' }]}
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
            name="currency_id"
            label="币种"
            rules={[{ required: true, message: '请选择币种' }]}
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
            rules={[{ required: true, message: '请输入报销金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入报销金额"
            />
          </Form.Item>
          <Form.Item
            name="expense_date"
            label="报销日期"
            rules={[{ required: true, message: '请选择报销日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="description"
            label="报销说明"
            rules={[{ required: true, message: '请输入报销说明' }]}
          >
            <TextArea rows={3} placeholder="请输入报销说明" />
          </Form.Item>
          <Form.Item
            name="voucher"
            label="凭证"
            rules={[{ required: true, message: '请上传凭证' }]}
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
          setEditOpen(false)
          setCurrentReimbursement(null)
          editForm.resetFields()
          setEditVoucherFile(null)
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="expense_type"
            label="报销类型"
            rules={[{ required: true, message: '请选择报销类型' }]}
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
            name="currency_id"
            label="币种"
            rules={[{ required: true, message: '请选择币种' }]}
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
            rules={[{ required: true, message: '请输入报销金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="expense_date"
            label="报销日期"
            rules={[{ required: true, message: '请选择报销日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="description"
            label="报销说明"
            rules={[{ required: true, message: '请输入报销说明' }]}
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
                {currentReimbursement?.voucher_url ? '重新上传' : '上传凭证'}
              </Button>
            </Upload>
            {currentReimbursement?.voucher_url && !editVoucherFile && (
              <div style={{ marginTop: 8 }}>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handlePreview(currentReimbursement.voucher_url!)}
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
          setApproveOpen(false)
          setCurrentReimbursement(null)
          approveForm.resetFields()
        }}
        okText="确认"
        cancelText="取消"
        width={600}
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentReimbursement?.employee_name} disabled />
          </Form.Item>
          <Form.Item label="报销类型">
            <Input value={EXPENSE_TYPE_LABELS[currentReimbursement?.expense_type || '']} disabled />
          </Form.Item>
          <Form.Item label="报销金额">
            <Input value={`${formatAmount(currentReimbursement?.amount_cents || 0)} (${currentReimbursement?.currency_code || '-'})`} disabled />
          </Form.Item>
          <Form.Item label="报销日期">
            <Input value={currentReimbursement?.expense_date} disabled />
          </Form.Item>
          <Form.Item label="报销说明">
            <TextArea value={currentReimbursement?.description} rows={3} disabled />
          </Form.Item>
          {currentReimbursement?.voucher_url && (
            <Form.Item label="凭证">
              <Button
                icon={<EyeOutlined />}
                onClick={() => handlePreview(currentReimbursement.voucher_url!)}
              >
                查看凭证
              </Button>
            </Form.Item>
          )}
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
                      name="account_id"
                      label="支出账户"
                      rules={[{ required: true, message: '请选择支出账户' }]}
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
                          .filter((acc: any) => acc.currency === currentReimbursement?.currency_id)
                          .map((acc: any) => (
                            <Option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.currency_code})
                            </Option>
                          ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="category_id"
                      label="支出类别"
                      rules={[{ required: true, message: '请选择支出类别' }]}
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
  )
}

