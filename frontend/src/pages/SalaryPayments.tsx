import { useEffect, useState, useMemo } from 'react'
import { Card, Table, Button, Modal, Form, Space, message, Tag, Select, Upload, Input, InputNumber } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import { formatAmount } from '../utils/formatters'
import { loadCurrencies, loadAccounts } from '../utils/loaders'
import { uploadImageAsWebP, isSupportedImageType } from '../utils/image'

const { TextArea } = Input

type SalaryPayment = {
  id: string
  employee_id: string
  employee_name: string
  department_id: string
  department_name?: string
  year: number
  month: number
  salary_cents: number
  status: 'pending_employee_confirmation' | 'pending_finance_approval' | 'pending_payment' | 'pending_payment_confirmation' | 'completed'
  allocation_status?: 'pending' | 'requested' | 'approved'
  account_id?: string
  account_name?: string
  account_currency?: string
  employee_confirmed_at?: number
  employee_confirmed_by?: string
  employee_confirmed_by_name?: string
  finance_approved_at?: number
  finance_approved_by?: string
  finance_approved_by_name?: string
  payment_transferred_at?: number
  payment_transferred_by?: string
  payment_transferred_by_name?: string
  payment_voucher_path?: string
  payment_confirmed_at?: number
  payment_confirmed_by?: string
  payment_confirmed_by_name?: string
  memo?: string
  allocations?: Array<{
    id: string
    currency_id: string
    currency_name?: string
    amount_cents: number
    account_id?: string
    account_name?: string
    status: 'pending' | 'approved' | 'rejected'
    requested_by?: string
    requested_by_name?: string
    approved_by?: string
    approved_by_name?: string
  }>
}

const STATUS_LABELS: Record<string, string> = {
  pending_employee_confirmation: '待员工确认',
  pending_finance_approval: '待财务确认',
  pending_payment: '待出纳转账',
  pending_payment_confirmation: '待出纳确认',
  completed: '已完成',
}

const STATUS_COLORS: Record<string, string> = {
  pending_employee_confirmation: 'orange',
  pending_finance_approval: 'blue',
  pending_payment: 'cyan',
  pending_payment_confirmation: 'purple',
  completed: 'green',
}

export function SalaryPayments({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateYear, setGenerateYear] = useState<number>(new Date().getFullYear())
  const [generateMonth, setGenerateMonth] = useState<number>(new Date().getMonth() + 1)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [paymentTransferOpen, setPaymentTransferOpen] = useState(false)
  const [paymentTransferForm] = Form.useForm()
  const [allocationRequestOpen, setAllocationRequestOpen] = useState(false)
  const [allocationRequestForm] = Form.useForm()
  const [allocationApproveOpen, setAllocationApproveOpen] = useState(false)
  const [accounts, setAccounts] = useState<Array<{ value: string, label: string, currency?: string }>>([])
  const [currencies, setCurrencies] = useState<Array<{ value: string, label: string }>>([])
  const [allocationLoading, setAllocationLoading] = useState(false)
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false)
  const [currentPayment, setCurrentPayment] = useState<SalaryPayment | null>(null)
  const [paymentConfirmForm] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const isManager = userRole === 'manager'
  const isFinance = userRole === 'finance' || isManager
  const isEmployee = userRole === 'employee'

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: year.toString() })
      if (month) params.append('month', month.toString())
      if (status) params.append('status', status)
      const res = await fetch(`${api.salaryPayments}?${params}`, { credentials: 'include' })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '加载薪资发放记录失败')
        return
      }
      setData(result.results ?? result ?? [])
    } catch (error: any) {
      message.error('查询失败：' + (error.message || '网络错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [year, month, status])

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [accountsData, currenciesData] = await Promise.all([
          loadAccounts(),
          loadCurrencies()
        ])
        setAccounts(accountsData)
        setCurrencies(currenciesData)
      } catch (error: any) {
        message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
      }
    }
    loadMasterData()
  }, [])

  const handleGenerate = async () => {
    setGenerateLoading(true)
    try {
      const res = await fetch(api.salaryPaymentsGenerate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: generateYear, month: generateMonth }),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '生成薪资单失败')
        return
      }
      message.success(`成功生成${result.created}条薪资单`)
      setGenerateOpen(false)
      load()
    } catch (error: any) {
      message.error('生成失败：' + (error.message || '网络错误'))
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleEmployeeConfirm = async (id: string) => {
    try {
      const res = await fetch(api.salaryPaymentsEmployeeConfirm(id), {
        method: 'POST',
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '确认失败')
        return
      }
      message.success('确认成功')
      load()
    } catch (error: any) {
      message.error('确认失败：' + (error.message || '网络错误'))
    }
  }

  const handleFinanceApprove = async (id: string) => {
    try {
      const res = await fetch(api.salaryPaymentsFinanceApprove(id), {
        method: 'POST',
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '确认失败')
        return
      }
      message.success('确认成功')
      load()
    } catch (error: any) {
      message.error('确认失败：' + (error.message || '网络错误'))
    }
  }

  const handlePaymentTransfer = async (id: string) => {
    const payment = data.find(p => p.id === id)
    if (!payment) return
    
    setCurrentPayment(payment)
    paymentTransferForm.resetFields()
    setPaymentTransferOpen(true)
  }

  const handlePaymentTransferConfirm = async () => {
    if (!currentPayment) return
    const v = await paymentTransferForm.validateFields()
    
    try {
      const res = await fetch(api.salaryPaymentsPaymentTransfer(currentPayment.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: v.account_id
        }),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '标记转账失败')
        return
      }
      message.success('标记转账成功')
      setPaymentTransferOpen(false)
      setCurrentPayment(null)
      paymentTransferForm.resetFields()
      load()
    } catch (error: any) {
      message.error('标记转账失败：' + (error.message || '网络错误'))
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      if (!isSupportedImageType(file)) {
        message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
        setUploading(false)
        return false
      }
      
      const url = await uploadImageAsWebP(file, api.upload.voucher)
      setVoucherFile(file)
      paymentConfirmForm.setFieldValue('payment_voucher_path', url)
      setFileList([{ uid: '1', name: file.name, status: 'done' }])
      message.success('凭证上传成功（已转换为WebP格式）')
      setUploading(false)
      return false
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
      setUploading(false)
      return false
    }
  }

  const handlePaymentConfirm = async () => {
    const v = await paymentConfirmForm.validateFields()
    if (!currentPayment) return
    
    try {
      const res = await fetch(api.salaryPaymentsPaymentConfirm(currentPayment.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_voucher_path: v.payment_voucher_path
        }),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '确认失败')
        return
      }
      message.success('确认成功')
      setPaymentConfirmOpen(false)
      setCurrentPayment(null)
      setVoucherFile(null)
      setFileList([])
      paymentConfirmForm.resetFields()
      load()
    } catch (error: any) {
      message.error('确认失败：' + (error.message || '网络错误'))
    }
  }

  const showPreview = (url: string) => {
    window.open(api.vouchers(url), '_blank')
  }

  const columns: ColumnsType<SalaryPayment> = useMemo(() => [
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 120,
      fixed: 'left',
    },
    {
      title: '项目',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '年月',
      key: 'year_month',
      width: 100,
      render: (_: any, record: SalaryPayment) => {
        if (!record.year || !record.month) return '-'
        return `${record.year}年${record.month}月`
      },
    },
    {
      title: '薪资',
      dataIndex: 'salary_cents',
      key: 'salary_cents',
      width: 120,
      align: 'right',
      render: (cents: number | null | undefined) => {
        if (cents == null) return '-'
        return (
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
            {formatAmount(cents)}
          </span>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string | null | undefined) => {
        if (!status) return '-'
        return (
          <Tag color={STATUS_COLORS[status] || 'default'}>
            {STATUS_LABELS[status] || '未知状态'}
          </Tag>
        )
      },
    },
    {
      title: '币种分配',
      key: 'allocation_status',
      width: 120,
      render: (_: any, record: SalaryPayment) => {
        if (!record.allocation_status || record.allocation_status === 'pending') return '-'
        return (
          <Tag color={record.allocation_status === 'approved' ? 'green' : 'orange'}>
            {record.allocation_status === 'approved' ? '已批准' : '待审批'}
          </Tag>
        )
      },
    },
    {
      title: '转账账户',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
      render: (name: string | null | undefined, record: SalaryPayment) => {
        if (!name) return '-'
        return `${name}${record.account_currency ? ` [${record.account_currency}]` : ''}`
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_: any, record: SalaryPayment) => (
        <Space>
          {record.status === 'pending_employee_confirmation' && (
            <Button size="small" type="primary" onClick={() => handleEmployeeConfirm(record.id)}>
              员工确认
            </Button>
          )}
          {record.status === 'pending_finance_approval' && isFinance && (
            <Button size="small" type="primary" onClick={() => handleFinanceApprove(record.id)}>
              财务确认
            </Button>
          )}
          {record.status === 'pending_payment' && isFinance && (
            <Button size="small" type="primary" onClick={() => handlePaymentTransfer(record.id)}>
              标记转账
            </Button>
          )}
          {(record.status === 'pending_employee_confirmation' || record.status === 'pending_finance_approval') && (record.allocation_status === 'pending' || !record.allocation_status || record.allocation_status === 'requested') && (
            <Button size="small" onClick={() => {
              setCurrentPayment(record)
              allocationRequestForm.resetFields()
              if (record.allocations && record.allocations.length > 0) {
                // 如果有现有分配，填充表单
                allocationRequestForm.setFieldsValue({
                  allocations: record.allocations.map(a => ({
                    currency_id: a.currency_id,
                    amount_cents: a.amount_cents / 100,
                    account_id: a.account_id
                  }))
                })
              }
              setAllocationRequestOpen(true)
            }}>
              {record.allocation_status === 'requested' ? '修改币种分配' : '申请币种分配'}
            </Button>
          )}
          {record.status === 'pending_finance_approval' && record.allocation_status === 'requested' && isFinance && (
            <Button size="small" type="primary" onClick={() => {
              setCurrentPayment(record)
              setAllocationApproveOpen(true)
            }}>
              审批币种分配
            </Button>
          )}
          {record.status === 'pending_payment_confirmation' && isFinance && (
            <Button size="small" type="primary" onClick={() => {
              setCurrentPayment(record)
              setPaymentConfirmOpen(true)
            }}>
              确认转账
            </Button>
          )}
          {record.payment_voucher_path && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => showPreview(record.payment_voucher_path!)}>
              查看凭证
            </Button>
          )}
        </Space>
      ),
    },
  ], [isFinance])

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => ({
    value: y,
    label: `${y}年`,
  }))

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
    value: m,
    label: `${m}月`,
  }))

  return (
    <Card
      title="薪资发放管理"
      extra={
        isFinance && (
          <Button type="primary" onClick={() => setGenerateOpen(true)}>
            生成薪资单
          </Button>
        )
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 120 }}
          value={year}
          onChange={setYear}
          options={yearOptions}
        />
        <Select
          style={{ width: 120 }}
          value={month}
          onChange={setMonth}
          placeholder="全部月份"
          allowClear
          options={monthOptions}
        />
        <Select
          style={{ width: 150 }}
          value={status}
          onChange={setStatus}
          placeholder="全部状态"
          allowClear
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Button onClick={load}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="生成薪资单"
        open={generateOpen}
        onOk={handleGenerate}
        onCancel={() => {
          setGenerateOpen(false)
          setGenerateYear(new Date().getFullYear())
          setGenerateMonth(new Date().getMonth() + 1)
        }}
        okText="生成"
        cancelText="取消"
        confirmLoading={generateLoading}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <span>年份：</span>
            <Select
              style={{ width: 120 }}
              value={generateYear}
              onChange={setGenerateYear}
              options={yearOptions}
            />
          </div>
          <div>
            <span>月份：</span>
            <Select
              style={{ width: 120 }}
              value={generateMonth}
              onChange={setGenerateMonth}
              options={monthOptions}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title="标记转账 - 选择账户"
        open={paymentTransferOpen}
        onOk={handlePaymentTransferConfirm}
        onCancel={() => {
          setPaymentTransferOpen(false)
          setCurrentPayment(null)
          paymentTransferForm.resetFields()
        }}
        okText="确认"
        cancelText="取消"
        width={600}
      >
        <Form form={paymentTransferForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentPayment?.employee_name} disabled />
          </Form.Item>
          <Form.Item label="薪资">
            <Input value={currentPayment ? formatAmount(currentPayment.salary_cents) : ''} disabled />
          </Form.Item>
          {currentPayment?.allocations && currentPayment.allocations.length > 0 && currentPayment.allocation_status === 'approved' && (
            <Form.Item label="币种分配">
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {currentPayment.allocations.map((alloc, idx) => (
                  <div key={idx} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                    <div>{alloc.currency_name || currencies.find(c => c.value === alloc.currency_id)?.label || alloc.currency_id}: {formatAmount(alloc.amount_cents)}</div>
                    {alloc.account_name && <div style={{ fontSize: 12, color: '#666' }}>账户: {alloc.account_name}</div>}
                  </div>
                ))}
              </div>
            </Form.Item>
          )}
          <Form.Item
            name="account_id"
            label="转账账户"
            rules={[{ required: true, message: '请选择转账账户' }]}
          >
            <Select
              placeholder="请选择账户"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={accounts}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="申请币种分配"
        open={allocationRequestOpen}
        onOk={async () => {
          try {
            const v = await allocationRequestForm.validateFields()
            if (!currentPayment) return
            
            const allocations = v.allocations.map((a: any) => ({
              currency_id: a.currency_id,
              amount_cents: Math.round(a.amount_cents * 100),
              account_id: a.account_id || undefined
            }))
            
            setAllocationLoading(true)
            const res = await fetch(api.salaryPaymentsAllocations(currentPayment.id), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ allocations }),
              credentials: 'include'
            })
            const result = await res.json()
            if (!res.ok) {
              message.error(result.error || '申请失败')
              return
            }
            message.success('申请成功')
            setAllocationRequestOpen(false)
            setCurrentPayment(null)
            allocationRequestForm.resetFields()
            load()
          } catch (error: any) {
            message.error('申请失败：' + (error.message || '网络错误'))
          } finally {
            setAllocationLoading(false)
          }
        }}
        onCancel={() => {
          setAllocationRequestOpen(false)
          setCurrentPayment(null)
          allocationRequestForm.resetFields()
        }}
        okText="提交"
        cancelText="取消"
        width={700}
        confirmLoading={allocationLoading}
      >
        <Form form={allocationRequestForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentPayment?.employee_name} disabled />
          </Form.Item>
          <Form.Item label="总薪资（USDT）">
            <Input value={currentPayment ? formatAmount(currentPayment.salary_cents) : ''} disabled />
          </Form.Item>
          <Form.Item
            name="allocations"
            label="币种分配"
            rules={[
              { required: true, message: '请至少添加一种币种分配' },
              {
                validator: (_, value) => {
                  if (!value || value.length === 0) {
                    return Promise.reject(new Error('请至少添加一种币种分配'))
                  }
                  const total = value.reduce((sum: number, a: any) => sum + (a.amount_cents || 0), 0)
                  const salaryTotal = currentPayment ? currentPayment.salary_cents / 100 : 0
                  if (total > salaryTotal) {
                    return Promise.reject(new Error(`分配总额不能超过薪资总额 ${formatAmount(salaryTotal * 100)}`))
                  }
                  return Promise.resolve()
                }
              }
            ]}
          >
            <Form.List name="allocations">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'currency_id']}
                        rules={[{ required: true, message: '请选择币种' }]}
                      >
                        <Select placeholder="币种" style={{ width: 150 }} options={currencies} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'amount_cents']}
                        rules={[{ required: true, message: '请输入金额' }]}
                      >
                        <InputNumber placeholder="金额" min={0} precision={2} style={{ width: 150 }} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'account_id']}
                      >
                        <Select
                          placeholder="账户（可选）"
                          style={{ width: 200 }}
                          allowClear
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={accounts.filter(acc => {
                            const currency = allocationRequestForm.getFieldValue(['allocations', name, 'currency_id'])
                            return !currency || acc.currency === currency
                          })}
                        />
                      </Form.Item>
                      <Button onClick={() => remove(name)}>删除</Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block>
                      添加币种分配
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审批币种分配"
        open={allocationApproveOpen}
        onOk={async () => {
          if (!currentPayment) return
          try {
            const res = await fetch(api.salaryPaymentsAllocationsApprove(currentPayment.id), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ approve_all: true }),
              credentials: 'include'
            })
            const result = await res.json()
            if (!res.ok) {
              message.error(result.error || '审批失败')
              return
            }
            message.success('审批成功')
            setAllocationApproveOpen(false)
            setCurrentPayment(null)
            load()
          } catch (error: any) {
            message.error('审批失败：' + (error.message || '网络错误'))
          }
        }}
        onCancel={() => {
          setAllocationApproveOpen(false)
          setCurrentPayment(null)
        }}
        okText="全部批准"
        cancelText="取消"
        width={700}
      >
        {currentPayment?.allocations && currentPayment.allocations.length > 0 ? (
          <div>
            <p>员工: {currentPayment.employee_name}</p>
            <p>总薪资: {formatAmount(currentPayment.salary_cents)}</p>
            <Table
              columns={[
                { title: '币种', dataIndex: 'currency_name', key: 'currency_name', render: (_: any, r: any) => r.currency_name || currencies.find(c => c.value === r.currency_id)?.label || r.currency_id },
                { title: '金额', dataIndex: 'amount_cents', key: 'amount_cents', render: (c: number) => formatAmount(c) },
                { title: '账户', dataIndex: 'account_name', key: 'account_name', render: (n: string) => n || '-' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => (
                  <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'orange'}>
                    {s === 'approved' ? '已批准' : s === 'rejected' ? '已拒绝' : '待审批'}
                  </Tag>
                )},
              ]}
              dataSource={currentPayment.allocations}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        ) : (
          <p>暂无分配记录</p>
        )}
      </Modal>

      <Modal
        title="确认转账并上传凭证"
        open={paymentConfirmOpen}
        onOk={handlePaymentConfirm}
        onCancel={() => {
          setPaymentConfirmOpen(false)
          setCurrentPayment(null)
          setVoucherFile(null)
          setFileList([])
          paymentConfirmForm.resetFields()
        }}
        okText="确认"
        cancelText="取消"
        width={600}
      >
        <Form form={paymentConfirmForm} layout="vertical">
          <Form.Item label="员工姓名">
            <Input value={currentPayment?.employee_name} disabled />
          </Form.Item>
          <Form.Item label="薪资">
            <Input value={currentPayment ? formatAmount(currentPayment.salary_cents) : ''} disabled />
          </Form.Item>
          <Form.Item
            name="payment_voucher_path"
            label="转账凭证"
            rules={[{ required: true, message: '请上传转账凭证' }]}
          >
            <Upload
              fileList={fileList}
              beforeUpload={handleUpload}
              onRemove={() => {
                setFileList([])
                setVoucherFile(null)
                paymentConfirmForm.setFieldValue('payment_voucher_path', undefined)
              }}
              maxCount={1}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                上传凭证
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

