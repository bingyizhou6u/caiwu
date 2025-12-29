import React, { useState } from 'react'
import { Card, Button, Modal, Form, Space, message, Tag, Select, Upload, Input, DatePicker, Popconfirm } from 'antd'
import { CurrencySelect, AmountInput, EmployeeSelect } from '../../../components/form'
import { UploadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { api } from '../../../config/api'
import dayjs from 'dayjs'
import { useAccounts, useEmployees } from '../../../hooks/useBusinessData'
import { useCurrencyOptions } from '../../../hooks'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'
import { useAllowances, useCreateAllowance, useUpdateAllowance, useDeleteAllowance, useGenerateAllowances } from '../../../hooks/business/useAllowances'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { allowancePaymentSchema, allowancePaymentUpdateSchema, allowancePaymentGenerateSchema } from '../../../validations/allowance.schema'
import { DataTable, AmountDisplay, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import type { AllowancePayment } from '../../../hooks/business/useAllowances'

const { TextArea } = Input

const ALLOWANCE_TYPE_LABELS: Record<string, string> = {
  living: '生活补贴',
  housing: '住房补贴',
  transportation: '交通补贴',
  meal: '伙食补贴',
  birthday: '生日补贴',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
}

import { PageContainer } from '../../../components/PageContainer'
import styles from '../../../components/common/common.module.css'

export function AllowancePayments() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('finance', 'allowance-payment', 'create')

  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const [allowanceType, setAllowanceType] = useState<string | undefined>(undefined)
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined)

  const { data: allowances = [], isLoading, refetch } = useAllowances({ year, month, allowanceType: allowanceType, employeeId: employeeId })
  const { mutateAsync: createAllowance } = useCreateAllowance()
  const { mutateAsync: updateAllowance } = useUpdateAllowance()
  const { mutateAsync: deleteAllowance } = useDeleteAllowance()
  const { mutateAsync: generateAllowances } = useGenerateAllowances()


  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)

  const {
    isOpen: createOpen,
    openCreate,
    close: closeCreate,
  } = useFormModal<AllowancePayment>()

  const {
    isOpen: editOpen,
    data: editRow,
    openEdit,
    close: closeEdit,
  } = useFormModal<AllowancePayment>()

  const {
    isOpen: generateOpen,
    openCreate: openGenerate,
    close: closeGenerate,
  } = useFormModal<any>()

  const { form: createForm, validateWithZod: validateCreate } = useZodForm(allowancePaymentSchema)
  const { form: editForm, validateWithZod: validateEdit } = useZodForm(allowancePaymentUpdateSchema)
  const { form: generateForm, validateWithZod: validateGenerate } = useZodForm(allowancePaymentGenerateSchema)

  // Business data hooks
  const { data: currenciesData = [] } = useCurrencyOptions()
  const { data: accountsData = [] } = useAccounts()
  const { data: employeesData = [] } = useEmployees()

  // Transform data format
  const currencies = React.useMemo(() => canManage ? currenciesData.map((c: any) => ({
    value: c.value as string,
    label: c.label.split(' - ')[1] || c.label
  })) : [], [currenciesData, canManage])

  const accounts = React.useMemo(() => canManage ? accountsData.map((a: any) => ({
    value: a.value as string,
    label: `${a.label.split(' (')[0]} (${a.currency || ''})`,
    currency: a.currency
  })) : [], [accountsData, canManage])

  const employees = React.useMemo(() => canManage ? employeesData.map((e: any) => ({
    value: e.value as string,
    label: e.label.split(' (')[0]
  })) : [], [employeesData, canManage])

  const handleGenerate = withErrorHandler(
    async () => {
      setGenerateLoading(true)
      const values = await validateGenerate()
      const d = await generateAllowances({
        year: values.year,
        month: values.month,
        paymentDate: dayjs(values.paymentDate).format('YYYY-MM-DD'),
      })
      message.success(`成功生成 ${d.created} 条补贴发放记录`)
      closeGenerate()
      generateForm.resetFields()
    },
    {
      showSuccess: false, // 手动显示成功消息以显示动态数量
      onSuccess: () => {
        setGenerateLoading(false)
      },
      onError: () => {
        setGenerateLoading(false)
      }
    }
  )

  const handleCreate = withErrorHandler(
    async () => {
      const values = await validateCreate()
      await createAllowance({
        ...values,
        amountCents: Math.round(values.amount * 100),
        paymentDate: dayjs(values.paymentDate).format('YYYY-MM-DD'),
      })
      closeCreate()
      createForm.resetFields()
    },
    {
      successMessage: '创建成功',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleUpdate = withErrorHandler(
    async () => {
      if (!editRow) return
      const values = await validateEdit()
      await updateAllowance({
        id: editRow.id,
        data: {
          ...values,
          paymentDate: dayjs(values.paymentDate).format('YYYY-MM-DD'),
        }
      })
      closeEdit()
      editForm.resetFields()
      setVoucherFile(null)
      setFileList([])
    },
    {
      successMessage: '更新成功',
      onSuccess: () => {
        setSubmitting(false)
      },
      onError: () => {
        setSubmitting(false)
      }
    }
  )

  const handleDelete = withErrorHandler(
    async (id: string) => {
      await deleteAllowance(id)
    },
    { successMessage: '删除成功' }
  )

  const handleUpload = async (file: File): Promise<string> => {
    if (!isSupportedImageType(file)) {
      throw new Error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
    }
    return uploadImageAsWebP(file, api.upload.voucher)
  }

  const onEdit = (record: AllowancePayment) => {
    editForm.setFieldsValue({
      paymentDate: dayjs(record.paymentDate),
      paymentMethod: record.paymentMethod,
      memo: record.memo,
      voucherUrl: record.voucherUrl,
    })
    if (record.voucherUrl) {
      setFileList([{ uid: '-1', name: '凭证', status: 'done', url: api.vouchers(record.voucherUrl) }])
    } else {
      setFileList([])
    }
    openEdit(record)
  }

  const onGenerateOpen = () => {
    generateForm.setFieldsValue({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      paymentDate: dayjs(),
    })
    openGenerate()
  }

  const columns: ColumnsType<AllowancePayment> = [
    {
      title: '员工',
      dataIndex: 'employeeName',
      key: 'employeeName',
      fixed: 'left',
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 80,
    },
    {
      title: '补贴类型',
      dataIndex: 'allowanceType',
      key: 'allowanceType',
      width: 100,
      render: (type: string) => <Tag>{ALLOWANCE_TYPE_LABELS[type] || type}</Tag>,
    },
    {
      title: '币种',
      dataIndex: 'currencyName',
      key: 'currencyName',
      width: 80,
    },
    {
      title: '金额',
      dataIndex: 'amountCents',
      key: 'amountCents',
      width: 120,
      align: 'right',
      render: (cents: number, record: AllowancePayment) => <AmountDisplay cents={cents} currency={record.currencyId || 'CNY'} />,
    },
    {
      title: '发放日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
    },
    {
      title: '发放方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (method: string) => PAYMENT_METHOD_LABELS[method] || method,
    },
    {
      title: '凭证',
      dataIndex: 'voucherUrl',
      key: 'voucherUrl',
      width: 100,
      render: (url?: string) => {
        if (!url) return '-'
        return (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => window.open(api.vouchers(url), '_blank')}
          >
            查看
          </Button>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'memo',
      key: 'memo',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_: any, record: AllowancePayment) => (
        <Space>
          {canManage && (
            <>
              <Button type="link" size="small" onClick={() => onEdit(record)}>
                编辑
              </Button>
              <Popconfirm
                title="确定要删除这条补贴发放记录吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i
    return { value: y, label: `${y}年` }
  })

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}月`,
  }))

  return (
    <PageContainer
      title="补贴发放管理"
      breadcrumb={[{ title: '人事管理' }, { title: '补贴发放管理' }]}
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
              type: 'select' as const,
              placeholder: '请选择年份',
              options: yearOptions,
            },
            {
              name: 'month',
              label: '月份',
              type: 'select' as const,
              placeholder: '请选择月份',
              options: [
                { label: '全部', value: '' },
                ...monthOptions,
              ],
            },
            {
              name: 'allowanceType',
              label: '补贴类型',
              type: 'select' as const,
              placeholder: '请选择补贴类型',
              options: [
                { label: '全部', value: '' },
                ...Object.entries(ALLOWANCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
              ],
            },
            ...(canManage ? [{
              name: 'employeeId',
              label: '员工',
              type: 'select' as const,
              placeholder: '请选择员工',
              options: [
                { label: '全部', value: '' },
                ...employees,
              ],
            }] : []),
          ]}
          onSearch={(values) => {
            if (values.year) setYear(Number(values.year))
            if (values.month !== undefined) setMonth(values.month ? Number(values.month) : undefined)
            if (values.allowanceType !== undefined) setAllowanceType(values.allowanceType ? String(values.allowanceType) : undefined)
            if (values.employeeId !== undefined) setEmployeeId(values.employeeId ? String(values.employeeId) : undefined)
          }}
          onReset={() => {
            setYear(new Date().getFullYear())
            setMonth(undefined)
            setAllowanceType(undefined)
            setEmployeeId(undefined)
          }}
          initialValues={{ year, month: month || '', allowanceType: allowanceType || '', employeeId: employeeId || '' }}
        />

        <PageToolbar
          actions={[
            ...(canManage ? [
              {
                label: '生成补贴发放',
                onClick: onGenerateOpen
              },
              {
                label: '新建发放记录',
                type: 'primary' as const,
                onClick: openCreate
              }
            ] : []),
            {
              label: '刷新',
              icon: <ReloadOutlined />,
              onClick: () => refetch(),
              loading: isLoading
            }
          ]}
          className={styles.mtMd}
        />

        <DataTable<AllowancePayment>
          columns={columns}
          data={allowances}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 1400 } }}
        />

        <Modal
          title="生成补贴发放"
          open={generateOpen}
          onOk={handleGenerate}
          onCancel={() => {
            closeGenerate()
            generateForm.resetFields()
          }}
          confirmLoading={generateLoading}
        >
          <Form form={generateForm} layout="vertical">
            <Form.Item name="year" label="年份">
              <Select options={yearOptions} />
            </Form.Item>
            <Form.Item name="month" label="月份">
              <Select options={monthOptions} />
            </Form.Item>
            <Form.Item name="paymentDate" label="发放日期">
              <DatePicker
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="新建发放记录"
          open={createOpen}
          onOk={handleCreate}
          onCancel={() => {
            closeCreate()
            createForm.resetFields()
          }}
          confirmLoading={submitting}
          width={600}
        >
          <Form form={createForm} layout="vertical">
            <Form.Item name="employeeId" label="员工">
              <EmployeeSelect placeholder="请选择员工" />
            </Form.Item>
            <Form.Item name="year" label="年份">
              <Select placeholder="请选择年份" options={yearOptions} />
            </Form.Item>
            <Form.Item name="month" label="月份">
              <Select placeholder="请选择月份" options={monthOptions} />
            </Form.Item>
            <Form.Item name="allowanceType" label="补贴类型">
              <Select
                placeholder="请选择补贴类型"
                options={Object.entries(ALLOWANCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item name="currencyId" label="币种">
              <CurrencySelect placeholder="请选择币种" />
            </Form.Item>
            <Form.Item name="amount" label="金额">
              <AmountInput
                style={{ width: '100%' }}
                placeholder="请输入金额"
                currency={createForm.getFieldValue('currencyId')}
              />
            </Form.Item>
            <Form.Item name="paymentDate" label="发放日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="paymentMethod" label="发放方式" initialValue="cash">
              <Select
                options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="编辑发放记录"
          open={editOpen}
          onOk={handleUpdate}
          onCancel={() => {
            closeEdit()
            editForm.resetFields()
            setVoucherFile(null)
            setFileList([])
          }}
          confirmLoading={submitting}
          width={600}
        >
          <Form form={editForm} layout="vertical">
            <Form.Item name="paymentDate" label="发放日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="paymentMethod" label="发放方式">
              <Select
                options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item name="voucherUrl" label="凭证">
              <Upload
                fileList={fileList}
                beforeUpload={(file) => {
                  setVoucherFile(file)
                  setFileList([{ uid: '-1', name: file.name, status: 'uploading' }])
                  setUploading(true)
                  handleUpload(file)
                    .then((url) => {
                      editForm.setFieldsValue({ voucherUrl: url })
                      setFileList([{ uid: '-1', name: file.name, status: 'done', url: api.vouchers(url) }])
                      setUploading(false)
                    })
                    .catch((error: unknown) => {
                      const errorMessage = error instanceof Error ? error.message : '未知错误'
                      message.error('上传失败：' + errorMessage)
                      setFileList([])
                      setUploading(false)
                    })
                  return false
                }}
                onRemove={() => {
                  setVoucherFile(null)
                  setFileList([])
                  editForm.setFieldsValue({ voucherUrl: undefined })
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  上传凭证
                </Button>
              </Upload>
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}

