import { useEffect, useState, useMemo } from 'react'
import { Card, Button, Modal, Form, Space, message, Tag, Select, Upload, Input, Table } from 'antd'
import { CurrencySelect, AmountInput, AccountSelect } from '../../../components/form'
import type { ColumnsType } from 'antd/es/table'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../../../config/api'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useCurrencyOptions } from '../../../hooks'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'
import { useSalaryPayments, useGenerateSalaryPayments, useEmployeeConfirmSalary, useFinanceApproveSalary, usePaymentTransferSalary, useRequestAllocationSalary, useApproveAllocationSalary, useConfirmPaymentSalary } from '../../../hooks/business/useSalaryPayments'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { salaryPaymentGenerateSchema, salaryPaymentTransferSchema, salaryPaymentAllocationSchema, salaryPaymentConfirmSchema } from '../../../validations/salary.schema'
import { DataTable, StatusTag, AmountDisplay, PageToolbar, EmptyText } from '../../../components/common'
import { SensitiveField } from '../../../components/SensitiveField'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { SALARY_PAYMENT_STATUS, SALARY_ALLOCATION_STATUS } from '../../../utils/status'
import { formatAmountWithCurrency } from '../../../utils/amount'
import type { SalaryPayment } from '../../../hooks/business/useSalaryPayments'
import { PageContainer } from '../../../components/PageContainer'

export function SalaryPayments() {
  const { hasPermission, functionRole } = usePermissions()
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const [status, setStatus] = useState<string | undefined>(undefined)

  const { data: payments = [], isLoading, refetch } = useSalaryPayments({ year, month, status })
  const { mutateAsync: generatePayments, isPending: generating } = useGenerateSalaryPayments()
  const { mutateAsync: employeeConfirm } = useEmployeeConfirmSalary()
  const { mutateAsync: financeApprove } = useFinanceApproveSalary()
  const { mutateAsync: paymentTransfer } = usePaymentTransferSalary()
  const { mutateAsync: requestAllocation, isPending: allocating } = useRequestAllocationSalary()
  const { mutateAsync: approveAllocation } = useApproveAllocationSalary()
  const { mutateAsync: confirmPayment } = useConfirmPaymentSalary()

  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)

  const _isFinance = functionRole === 'finance'

  const {
    isOpen: generateOpen,
    openCreate: openGenerate,
    close: closeGenerate,
  } = useFormModal()

  const {
    isOpen: transferOpen,
    data: transferRow,
    openEdit: openTransfer,
    close: closeTransfer,
  } = useFormModal<SalaryPayment>()

  const {
    isOpen: allocationOpen,
    data: allocationRow,
    openEdit: openAllocation,
    close: closeAllocation,
  } = useFormModal<SalaryPayment>()

  const {
    isOpen: allocationApproveOpen,
    data: allocationApproveRow,
    openEdit: openAllocationApprove,
    close: closeAllocationApprove,
  } = useFormModal<SalaryPayment>()

  const {
    isOpen: confirmOpen,
    data: confirmRow,
    openEdit: openConfirm,
    close: closeConfirm,
  } = useFormModal<SalaryPayment>()

  const { form: generateForm, validateWithZod: validateGenerate } = useZodForm(salaryPaymentGenerateSchema)
  const { form: transferForm, validateWithZod: validateTransfer } = useZodForm(salaryPaymentTransferSchema)
  const { form: allocationForm, validateWithZod: validateAllocation } = useZodForm(salaryPaymentAllocationSchema)
  const { form: confirmForm, validateWithZod: validateConfirm } = useZodForm(salaryPaymentConfirmSchema)

  // Business data hooks
  const { data: accounts = [] } = useAccounts()
  const { data: currencies = [] } = useCurrencyOptions()

  // 初始化生成表单
  useEffect(() => {
    if (generateOpen) {
      generateForm.setFieldsValue({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
      })
    }
  }, [generateOpen, generateForm])

  const handleGenerate = withErrorHandler(
    async () => {
      const values = await validateGenerate()
      const result = await generatePayments(values)
      message.success(`成功生成${result.created}条薪资单`)
      closeGenerate()
    },
    { errorMessage: '生成失败' }
  )

  const handleEmployeeConfirm = withErrorHandler(
    async (id: string) => {
      await employeeConfirm(id)
    },
    { successMessage: '确认成功' }
  )

  const handleFinanceApprove = withErrorHandler(
    async (id: string) => {
      await financeApprove(id)
    },
    { successMessage: '确认成功' }
  )

  const handlePaymentTransferConfirm = withErrorHandler(
    async () => {
      if (!transferRow) return
      const values = await validateTransfer()
      await paymentTransfer({ id: transferRow.id, accountId: values.accountId })
      message.success('标记转账成功')
      closeTransfer()
      transferForm.resetFields()
    },
    {
      showSuccess: false, // 手动显示成功消息
      errorMessage: '标记转账失败',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleAllocationRequest = withErrorHandler(
    async () => {
      if (!allocationRow) return
      const values = await validateAllocation()
      const allocations = values.allocations.map((a: any) => ({
        currencyId: a.currencyId,
        amountCents: Math.round(a.amountCents * 100),
        accountId: a.accountId || undefined
      }))

      // 验证总额
      const total = allocations.reduce((sum: number, a: any) => sum + (a.amountCents || 0), 0)
      if (total > allocationRow.salary_cents) {
        const formattedAmount = formatAmountWithCurrency(allocationRow.salary_cents, 'USDT')
        throw new Error(`分配总额不能超过薪资总额 ${formattedAmount}`)
      }

      await requestAllocation({ id: allocationRow.id, allocations })
      message.success('申请成功')
      closeAllocation()
      allocationForm.resetFields()
    },
    {
      showSuccess: false, // 手动显示成功消息
      errorMessage: '申请失败',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleAllocationApprove = withErrorHandler(
    async () => {
      if (!allocationApproveRow) return
      await approveAllocation({ id: allocationApproveRow.id, approve_all: true })
      closeAllocationApprove()
    },
    { successMessage: '审批成功' }
  )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      if (!isSupportedImageType(file)) {
        message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
        setUploading(false)
        return false
      }

      const url = await uploadImageAsWebP(file, api.upload.voucher)
      confirmForm.setFieldValue('payment_voucher_path', url)
      setFileList([{ uid: '1', name: file.name, status: 'done' }])
      message.success('凭证上传成功（已转换为WebP格式）')
      setUploading(false)
      return false
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
      setUploading(false)
      return false
    }
  }

  const handlePaymentConfirm = withErrorHandler(
    async () => {
      if (!confirmRow) return
      const values = await validateConfirm()
      await confirmPayment({ id: confirmRow.id, payment_voucher_path: values.payment_voucher_path })
      message.success('确认成功')
      closeConfirm()
      setFileList([])
      confirmForm.resetFields()
    },
    {
      showSuccess: false, // 手动显示成功消息
      errorMessage: '确认失败',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const showPreview = (url: string) => {
    window.open(api.vouchers(url), '_blank')
  }

  const onOpenTransfer = (record: SalaryPayment) => {
    transferForm.resetFields()
    openTransfer(record)
  }

  const onOpenAllocation = (record: SalaryPayment) => {
    allocationForm.resetFields()
    if (record.allocations && record.allocations.length > 0) {
      allocationForm.setFieldsValue({
        allocations: record.allocations.map(a => ({
          currencyId: a.currencyId,
          amountCents: a.amountCents / 100,
          accountId: a.accountId
        }))
      })
    }
    openAllocation(record)
  }

  const columns: ColumnsType<SalaryPayment> = useMemo(() => [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 120,
      fixed: 'left',
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
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
      render: (cents: number | null | undefined, r: SalaryPayment) => {
        if (!cents) return '-'
        const amountStr = `${(cents / 100).toFixed(2)} ${(r as any).currency || 'CNY'}`
        return (
          <SensitiveField
            value={amountStr}
            type="salary"
            permission="hr.salary.view"
            entityId={r.id}
            entityType="salary_payment"
          />
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string | null | undefined) => (
        <StatusTag status={status} statusMap={SALARY_PAYMENT_STATUS} />
      ),
    },
    {
      title: '币种分配',
      key: 'allocation_status',
      width: 120,
      render: (_: any, record: SalaryPayment) => {
        if (!record.allocation_status || record.allocation_status === 'pending') return <EmptyText value={null} />
        return <StatusTag status={record.allocation_status} statusMap={SALARY_ALLOCATION_STATUS} />
      },
    },
    {
      title: '转账账户',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 150,
      render: (name: string | null | undefined, record: SalaryPayment) => {
        if (!name) return <EmptyText value={null} />
        return <EmptyText value={`${name}${record.account_currency ? ` [${record.account_currency}]` : ''}`} />
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
          {record.status === 'pending_finance_approval' && _isFinance && (
            <Button size="small" type="primary" onClick={() => handleFinanceApprove(record.id)}>
              财务确认
            </Button>
          )}
          {record.status === 'pending_payment' && _isFinance && (
            <Button size="small" type="primary" onClick={() => onOpenTransfer(record)}>
              标记转账
            </Button>
          )}
          {(record.status === 'pending_employee_confirmation' || record.status === 'pending_finance_approval') && (record.allocation_status === 'pending' || !record.allocation_status || record.allocation_status === 'requested') && (
            <Button size="small" onClick={() => onOpenAllocation(record)}>
              {record.allocation_status === 'requested' ? '修改币种分配' : '申请币种分配'}
            </Button>
          )}
          {record.status === 'pending_finance_approval' && record.allocation_status === 'requested' && _isFinance && (
            <Button size="small" type="primary" onClick={() => openAllocationApprove(record)}>
              审批币种分配
            </Button>
          )}
          {record.status === 'pending_payment_confirmation' && _isFinance && (
            <Button size="small" type="primary" onClick={() => openConfirm(record)}>
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
  ], [_isFinance, handleEmployeeConfirm, handleFinanceApprove])

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => ({
    value: y,
    label: `${y}年`,
  }))

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
    value: m,
    label: `${m}月`,
  }))

  return (
    <PageContainer
      title="薪资发放管理"
      breadcrumb={[{ title: '人事管理' }, { title: '薪资发放管理' }]}
    >
      <Card
        className="page-card"
        bordered={false}
      >
        <SearchFilters
          fields={[
            {
              name: 'year',
              label: '年份',
              type: 'select',
              placeholder: '请选择年份',
              options: yearOptions,
            },
            {
              name: 'month',
              label: '月份',
              type: 'select',
              placeholder: '请选择月份',
              options: [
                { label: '全部', value: '' },
                ...monthOptions,
              ],
            },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '请选择状态',
              options: [
                { label: '全部', value: '' },
                ...Object.entries(SALARY_PAYMENT_STATUS).map(([value, config]) => ({ value, label: config.text })),
              ],
            },
          ]}
          onSearch={(values) => {
            if (values.year) setYear(Number(values.year))
            if (values.month !== undefined) setMonth(values.month ? Number(values.month) : undefined)
            if (values.status !== undefined) setStatus(values.status ? String(values.status) : undefined)
          }}
          onReset={() => {
            setYear(new Date().getFullYear())
            setMonth(undefined)
            setStatus(undefined)
          }}
          initialValues={{ year, month: month || '', status: status || '' }}
        />

        <PageToolbar
          actions={[
            ...(_isFinance ? [{
              label: '生成薪资单',
              type: 'primary' as const,
              onClick: openGenerate
            }] : []),
            {
              label: '刷新',
              onClick: () => refetch()
            }
          ]}
          style={{ marginTop: 16 }}
        />

        <DataTable<SalaryPayment>
          columns={columns}
          data={payments}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 1200 } }}
        />

        <Modal
          title="生成薪资单"
          open={generateOpen}
          onOk={handleGenerate}
          onCancel={() => {
            closeGenerate()
            generateForm.resetFields()
          }}
          okText="生成"
          cancelText="取消"
          confirmLoading={generating}
        >
          <Form form={generateForm} layout="vertical">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="year" label="年份" rules={[{ required: true }]}>
                <Select style={{ width: 120 }} options={yearOptions} />
              </Form.Item>
              <Form.Item name="month" label="月份" rules={[{ required: true }]}>
                <Select style={{ width: 120 }} options={monthOptions} />
              </Form.Item>
            </Space>
          </Form>
        </Modal>

        <Modal
          title="标记转账 - 选择账户"
          open={transferOpen}
          onOk={handlePaymentTransferConfirm}
          onCancel={() => {
            closeTransfer()
            transferForm.resetFields()
          }}
          okText="确认"
          cancelText="取消"
          width={600}
          confirmLoading={submitting}
        >
          <Form form={transferForm} layout="vertical">
            <Form.Item label="员工姓名">
              <Input value={transferRow?.employeeName} disabled />
            </Form.Item>
            <Form.Item label="薪资">
              <Input value={transferRow ? formatAmountWithCurrency(transferRow.salary_cents, 'USDT') : ''} disabled />
            </Form.Item>
            {transferRow?.allocations && transferRow.allocations.length > 0 && transferRow.allocation_status === 'approved' && (
              <Form.Item label="币种分配">
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {transferRow.allocations.map((alloc, idx) => (
                    <div key={idx} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                      <div>{alloc.currencyName || currencies.find((c: any) => c.value === alloc.currencyId)?.label || alloc.currencyId}: {formatAmountWithCurrency(alloc.amountCents, alloc.currencyId || 'CNY')}</div>
                      {alloc.accountName && <div style={{ fontSize: 12, color: '#666' }}>账户: {alloc.accountName}</div>}
                    </div>
                  ))}
                </div>
              </Form.Item>
            )}
            <Form.Item
              name="accountId"
              label="转账账户"
              rules={[{ required: true, message: '请选择转账账户' }]}
            >
              <Select
                placeholder="请选择账户"
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={accounts}
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="申请币种分配"
          open={allocationOpen}
          onOk={handleAllocationRequest}
          onCancel={() => {
            closeAllocation()
            allocationForm.resetFields()
          }}
          okText="提交"
          cancelText="取消"
          width={700}
          confirmLoading={submitting || allocating}
        >
          <Form form={allocationForm} layout="vertical">
            <Form.Item label="员工姓名">
              <Input value={allocationRow?.employeeName} disabled />
            </Form.Item>
            <Form.Item label="总薪资（USDT）">
              <Input value={allocationRow ? formatAmountWithCurrency(allocationRow.salary_cents, 'USDT') : ''} disabled />
            </Form.Item>
            <Form.Item
              name="allocations"
              label="币种分配"
              rules={[
                { required: true, message: '请至少添加一种币种分配' },
              ]}
            >
              <Form.List name="allocations">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'currencyId']}
                          rules={[{ required: true, message: '请选择币种' }]}
                        >
                          <CurrencySelect placeholder="币种" style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'amountCents']}
                          rules={[{ required: true, message: '请输入金额' }]}
                        >
                          <AmountInput placeholder="金额" currency={allocationForm.getFieldValue(['allocations', name, 'currencyId'])} style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'accountId']}
                        >
                          <AccountSelect
                            placeholder="账户（可选）"
                            style={{ width: 200 }}
                            showCurrency
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
          onOk={handleAllocationApprove}
          onCancel={() => {
            closeAllocationApprove()
          }}
          okText="全部批准"
          cancelText="取消"
          width={700}
        >
          {allocationApproveRow?.allocations && allocationApproveRow.allocations.length > 0 ? (
            <div>
              <p>员工: {allocationApproveRow.employeeName}</p>
              <p>总薪资: <AmountDisplay cents={allocationApproveRow.salary_cents} currency="USDT" /></p>
              <Table
                columns={[
                  { title: '币种', dataIndex: 'currencyName', key: 'currencyName', render: (_: any, r: any) => r.currencyName || currencies.find((c: any) => c.value === r.currencyId)?.label || r.currencyId },
                  { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (c: number, r: any) => <AmountDisplay cents={c} currency={r.currencyId || 'CNY'} /> },
                  { title: '账户', dataIndex: 'accountName', key: 'accountName', render: (n: string) => <EmptyText value={n} /> },
                  {
                    title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} statusMap={SALARY_ALLOCATION_STATUS} />
                  },
                ]}
                dataSource={allocationApproveRow.allocations}
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
          open={confirmOpen}
          onOk={handlePaymentConfirm}
          onCancel={() => {
            closeConfirm()
            setFileList([])
            confirmForm.resetFields()
          }}
          okText="确认"
          cancelText="取消"
          width={600}
          confirmLoading={submitting}
        >
          <Form form={confirmForm} layout="vertical">
            <Form.Item label="员工姓名">
              <Input value={confirmRow?.employeeName} disabled />
            </Form.Item>
            <Form.Item label="薪资">
              <Input value={confirmRow ? formatAmountWithCurrency(confirmRow.salary_cents, 'USDT') : ''} disabled />
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
                  confirmForm.setFieldValue('payment_voucher_path', undefined)
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
    </PageContainer>
  )
}

