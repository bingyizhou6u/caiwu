import React, { useState } from 'react'
import { Card, Button, Modal, Form, Input, Space, message, DatePicker, InputNumber, Upload, Tag, Tabs, Select } from 'antd'
import { AmountInput, CurrencySelect, AccountSelect } from '../../../components/form'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import type { FormInstance } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'
import type { RentalProperty, DormitoryAllocation, RentalPayment, RentalPropertyChange } from '../../../types/rental'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'
import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, EmptyText, PageToolbar, StatusTag, AmountDisplay } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { RENTAL_STATUS } from '../../../utils/status'
import { useRentalProperties, useRentalProperty, useCreateRentalProperty, useUpdateRentalProperty, useCreateRentalPayment, useAllocateDormitory } from '../../../hooks'
import { useCurrencies, useDepartments, useAccounts, useExpenseCategories, useEmployees } from '../../../hooks/useBusinessData'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { createRentalPropertySchema, updateRentalPropertySchema, createRentalPaymentSchema, allocateDormitorySchema, type CreateRentalPropertyFormData, type UpdateRentalPropertyFormData, type CreateRentalPaymentFormData, type AllocateDormitoryFormData } from '../../../validations/rental.schema'

// API 响应类型
interface UploadResponse {
  url: string
}

interface CreatePaymentResponse {
  id: string
  voucher_no?: string
}

interface CreatePropertyResponse {
  id: string
}

// 详情页面使用的扩展类型
interface DormitoryAllocationWithDetails extends DormitoryAllocation {
  employeeName?: string
  employee_departmentName?: string
  room_number?: string
  bed_number?: string
  // 兼容后端可能返回的下划线命名
  roomNumber?: string
  bedNumber?: string
}

// 变动记录类型（后端可能返回下划线命名）
interface RentalPropertyChangeWithSnakeCase extends RentalPropertyChange {
  change_date?: number
  change_type?: string
  from_lease_start?: string
  to_lease_start?: string
  from_lease_end?: string
  to_lease_end?: string
  from_monthlyRentCents?: number
  to_monthlyRentCents?: number
  from_status?: string
  to_status?: string
}

const { TextArea } = Input

const PROPERTY_TYPE_OPTIONS = [
  { value: 'office', label: '办公室' },
  { value: 'dormitory', label: '员工宿舍' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'cash', label: '现金' },
  { value: 'check', label: '支票' },
]

const RENT_TYPE_OPTIONS = [
  { value: 'monthly', label: '月租' },
  { value: 'yearly', label: '年租' },
]

const PAYMENT_PERIOD_OPTIONS = [
  { value: 1, label: '每月一付' },
  { value: 2, label: '每两月一付' },
  { value: 3, label: '每季度一付' },
  { value: 6, label: '每半年一付' },
  { value: 12, label: '每年一付' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: '租用中' },
  { value: 'expired', label: '已到期' },
  { value: 'terminated', label: '已终止' },
]

export function RentalManagement() {
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useState<{ propertyType?: string; status?: string }>({})
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [contractFileList, setContractFileList] = useState<UploadFile[]>([])
  const [contractUploading, setContractUploading] = useState(false)
  
  const canManageRental = hasPermission('asset', 'rental', 'create')
  const canAllocate = hasPermission('asset', 'rental', 'allocate') || canManageRental

  // React Query hooks for data
  const { data = [], isLoading: loading, refetch } = useRentalProperties({
    propertyType: searchParams.propertyType,
    status: searchParams.status
  })
  
  // Business data hooks
  const { data: currencies = [] } = useCurrencies()
  const { data: departments = [] } = useDepartments()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useExpenseCategories()
  const { data: employees = [] } = useEmployees()

  // Mutations
  const { mutateAsync: createProperty } = useCreateRentalProperty()
  const { mutateAsync: updateProperty } = useUpdateRentalProperty()
  const { mutateAsync: createPayment } = useCreateRentalPayment()
  const { mutateAsync: allocateDormitory } = useAllocateDormitory()

  // Form modals
  const {
    isOpen: createOpen,
    openCreate,
    close: closeCreate,
  } = useFormModal()

  const {
    isOpen: editOpen,
    data: editProperty,
    openEdit,
    close: closeEdit,
  } = useFormModal<RentalProperty>()

  const {
    isOpen: detailOpen,
    data: detailProperty,
    openEdit: openDetail,
    close: closeDetail,
  } = useFormModal<RentalProperty>()

  const {
    isOpen: paymentOpen,
    data: paymentProperty,
    openEdit: openPayment,
    close: closePayment,
  } = useFormModal<RentalProperty>()

  const {
    isOpen: allocateOpen,
    data: allocateProperty,
    openEdit: openAllocate,
    close: closeAllocate,
  } = useFormModal<RentalProperty>()

  // Forms with Zod validation
  const { form: createForm, validateWithZod: validateCreate } = useZodForm(createRentalPropertySchema)
  const { form: editForm, validateWithZod: validateEdit } = useZodForm(updateRentalPropertySchema)
  const { form: paymentForm, validateWithZod: validatePayment } = useZodForm(createRentalPaymentSchema)
  const { form: allocateForm, validateWithZod: validateAllocate } = useZodForm(allocateDormitorySchema)

  // Load property detail
  const detailId = detailProperty?.id || editProperty?.id || paymentProperty?.id || allocateProperty?.id || ''
  const { data: currentProperty } = useRentalProperty(detailId)

  // Initialize edit form when property is loaded
  React.useEffect(() => {
    if (editOpen && editProperty && currentProperty) {
      editForm.setFieldsValue({
        propertyCode: currentProperty.propertyCode,
        name: currentProperty.name,
        propertyType: currentProperty.propertyType,
        address: currentProperty.address,
        areaSqm: currentProperty.areaSqm,
        rentType: currentProperty.rentType || 'monthly',
        monthlyRentCents: currentProperty.monthlyRentCents ? currentProperty.monthlyRentCents / 100 : null,
        yearlyRentCents: currentProperty.yearlyRentCents ? currentProperty.yearlyRentCents / 100 : null,
        paymentPeriodMonths: currentProperty.paymentPeriodMonths || 1,
        currency: currentProperty.currency,
        landlordName: currentProperty.landlordName,
        landlordContact: currentProperty.landlordContact,
        leaseStartDate: currentProperty.leaseStartDate ? dayjs(currentProperty.leaseStartDate) : null,
        leaseEndDate: currentProperty.leaseEndDate ? dayjs(currentProperty.leaseEndDate) : null,
        depositCents: currentProperty.depositCents ? currentProperty.depositCents / 100 : null,
        paymentMethod: currentProperty.paymentMethod,
        paymentDay: currentProperty.paymentDay || 1,
        departmentId: currentProperty.departmentId,
        status: currentProperty.status,
        memo: currentProperty.memo,
        contractFileUrl: currentProperty.contractFileUrl,
      })
      setContractFileList(currentProperty.contractFileUrl ? [{ uid: '1', name: '合同文件', status: 'done', url: currentProperty.contractFileUrl }] : [])
    }
  }, [editOpen, editProperty, currentProperty, editForm])

  const handleContractUpload = async (file: File, form: FormInstance) => {
    setContractUploading(true)
    try {
      // 检查文件类型
      if (file.type !== 'application/pdf') {
        message.error('只允许上传PDF格式文件')
        setContractUploading(false)
        return false
      }

      // 检查文件大小（20MB）
      const maxSize = 20 * 1024 * 1024
      if (file.size > maxSize) {
        message.error('文件大小不能超过20MB')
        setContractUploading(false)
        return false
      }

      const formData = new FormData()
      formData.append('file', file)

      const data = await apiClient.post<UploadResponse>(api.upload.contract, formData)

      form.setFieldValue('contractFileUrl', data.url)
      setContractFileList([{ uid: '1', name: file.name, status: 'done', url: data.url }])
      message.success('合同上传成功')
      setContractUploading(false)
      return false
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
      setContractUploading(false)
      return false
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
      paymentForm.setFieldValue('voucherUrl', url)
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

  const handleCreate = withErrorHandler(
    async () => {
      const v = await validateCreate()
      const initialEmployees = v.initialEmployees || []
      
      const { initialEmployees: _, ...rest } = v
      const payload = {
        ...rest,
        monthlyRentCents: v.rentType === 'monthly' && v.monthlyRentCents ? Math.round(v.monthlyRentCents * 100) : null,
        yearlyRentCents: v.rentType === 'yearly' && v.yearlyRentCents ? Math.round(v.yearlyRentCents * 100) : null,
        depositCents: v.depositCents ? Math.round(v.depositCents * 100) : null,
        leaseStartDate: v.leaseStartDate ? v.leaseStartDate.format('YYYY-MM-DD') : null,
        leaseEndDate: v.leaseEndDate ? v.leaseEndDate.format('YYYY-MM-DD') : null,
      }

      const result = await createProperty(payload) as CreatePropertyResponse

      // 如果有初始员工分配，创建分配记录
      if (v.propertyType === 'dormitory' && initialEmployees.length > 0) {
        const propertyId = result.id
        for (const employeeId of initialEmployees) {
          try {
            await allocateDormitory({
              propertyId,
              data: {
                employeeId: employeeId,
                allocationDate: v.leaseStartDate ? v.leaseStartDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
              }
            })
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : '网络错误'
            console.error(`分配员工失败 (${employeeId}):`, errorMessage)
          }
        }
      }

      const employeeCount = initialEmployees.length
      if (employeeCount > 0) {
        message.success(`创建成功，已分配${employeeCount}名员工`)
      }
      return { employeeCount }
    },
    {
      successMessage: '创建成功',
      onSuccess: () => {
        closeCreate()
        createForm.resetFields()
        setContractFileList([])
        refetch()
      }
    }
  )

  const handleEdit = withErrorHandler(
    async () => {
      if (!editProperty) return

      const v = await validateEdit()
      const payload = {
        ...v,
        monthlyRentCents: v.monthlyRentCents !== undefined ? Math.round(v.monthlyRentCents * 100) : undefined,
        yearlyRentCents: v.yearlyRentCents !== undefined ? Math.round(v.yearlyRentCents * 100) : undefined,
        depositCents: v.depositCents !== undefined ? Math.round(v.depositCents * 100) : undefined,
        leaseStartDate: v.leaseStartDate ? v.leaseStartDate.format('YYYY-MM-DD') : undefined,
        leaseEndDate: v.leaseEndDate ? v.leaseEndDate.format('YYYY-MM-DD') : undefined,
      }

      await updateProperty({ id: editProperty.id, data: payload })
    },
    {
      successMessage: '更新成功',
      onSuccess: () => {
        closeEdit()
        editForm.resetFields()
        setContractFileList([])
        refetch()
      }
    }
  )

  const handlePayment = withErrorHandler(
    async () => {
      const v = await validatePayment()
      const paymentDate = v.paymentDate.format('YYYY-MM-DD')
      const paymentDateObj = v.paymentDate
      const year = paymentDateObj.year()
      const month = paymentDateObj.month() + 1

      const payload = {
        ...v,
        paymentDate: paymentDate,
        year,
        month,
        amountCents: Math.round(v.amountCents * 100),
      }

      const result = await createPayment(payload) as CreatePaymentResponse
      if (result?.voucher_no) {
        message.success(`付款记录成功，凭证号：${result.voucher_no}`)
      }
      return result
    },
    {
      successMessage: '付款记录成功',
      onSuccess: () => {
        closePayment()
        paymentForm.resetFields()
        setVoucherFile(null)
        setFileList([])
        refetch()
      }
    }
  )

  const handleAllocate = withErrorHandler(
    async () => {
      if (!allocateProperty) return

      const v = await validateAllocate()
      const payload = {
        ...v,
        allocationDate: v.allocationDate.format('YYYY-MM-DD'),
        monthlyRentCents: v.monthlyRentCents ? Math.round(v.monthlyRentCents * 100) : undefined,
      }

      await allocateDormitory({ propertyId: allocateProperty.id, data: payload })
    },
    {
      successMessage: '分配成功',
      onSuccess: () => {
        closeAllocate()
        allocateForm.resetFields()
        refetch()
      }
    }
  )

  return (
    <PageContainer
      title="租房管理"
      breadcrumb={[
        { title: '首页', path: '/' },
        { title: '资产管理' },
        { title: '租房管理' }
      ]}
      extra={
        <Space wrap>
          {canManageRental && (
            <Button type="primary" onClick={() => { openCreate(); createForm.resetFields() }}>
              新建租赁
            </Button>
          )}
          <Button onClick={() => refetch()}>刷新</Button>
        </Space>
      }
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            {
              name: 'propertyType',
              label: '类型',
              type: 'select',
              placeholder: '类型筛选',
              options: [
                { label: '全部', value: '' },
                ...PROPERTY_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.value }))
              ]
            },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '状态筛选',
              options: [
                { label: '全部', value: '' },
                ...STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }))
              ]
            }
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />
        <DataTable<RentalProperty>
          rowKey="id"
          loading={loading}
          data={data}
          tableProps={{ className: 'table-striped', scroll: { x: 1200 } }}
          columns={[
            { title: '房屋编号', dataIndex: 'propertyCode', key: 'propertyCode', width: 120 },
            { title: '房屋名称', dataIndex: 'name', key: 'name', width: 200 },
            {
              title: '类型',
              dataIndex: 'propertyType',
              key: 'propertyType',
              width: 100,
              render: (v: string) => {
                const option = PROPERTY_TYPE_OPTIONS.find(o => o.value === v)
                return option?.label || v
              }
            },
            {
              title: '租金',
              key: 'rent',
              width: 120,
              render: (_: unknown, r: RentalProperty) => {
                if (r.rentType === 'yearly') {
                  return (
                    <span>
                      <AmountDisplay cents={r.yearlyRentCents || 0} currency={r.currency || 'CNY'} /> /年
                    </span>
                  )
                } else {
                  return (
                    <span>
                      <AmountDisplay cents={r.monthlyRentCents || 0} currency={r.currency || 'CNY'} /> /月
                    </span>
                  )
                }
              }
            },
            {
              title: '付款周期',
              key: 'paymentPeriod',
              width: 100,
              render: (_: unknown, r: RentalProperty) => {
                const period = PAYMENT_PERIOD_OPTIONS.find(o => o.value === r.paymentPeriodMonths)
                return period?.label || `${r.paymentPeriodMonths || 1}月`
              }
            },
            { title: '租赁开始', dataIndex: 'leaseStartDate', key: 'leaseStartDate', width: 120 },
            { title: '租赁结束', dataIndex: 'leaseEndDate', key: 'leaseEndDate', width: 120 },
            {
              title: '使用项目/员工',
              key: 'usage',
              width: 200,
              render: (_: unknown, r: RentalProperty) => {
                if (r.propertyType === 'office') {
                  return r.departmentName || '-'
                } else {
                  // 住宅：显示分配的员工数量（需要从详情中获取）
                  return r.allocationsCount ? `${r.allocationsCount}人` : '-'
                }
              }
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: (v: string) => <StatusTag status={v} statusMap={RENTAL_STATUS} />
            },
            {
              title: '操作',
              key: 'actions',
              width: 250,
              fixed: 'right' as const,
              render: (_: unknown, r: RentalProperty) => (
                <Space>
                  <Button size="small" onClick={() => openDetail(r)}>详情</Button>
                  {canManageRental && (
                    <>
                      <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
                      <Button size="small" type="primary" onClick={() => {
                        openPayment(r)
                        paymentForm.resetFields()
                        // 计算本次付款金额（根据付款周期）
                        let amount = null
                        if (r.rentType === 'yearly') {
                          // 年租：根据付款周期计算
                          amount = r.yearlyRentCents ? (r.yearlyRentCents / 100 / (12 / (r.paymentPeriodMonths || 1))) : null
                        } else {
                          // 月租：根据付款周期计算
                          amount = r.monthlyRentCents ? (r.monthlyRentCents / 100 * (r.paymentPeriodMonths || 1)) : null
                        }
                        paymentForm.setFieldsValue({
                          propertyId: r.id,
                          paymentDate: dayjs(),
                          amountCents: amount,
                          currency: r.currency,
                          paymentMethod: r.paymentMethod,
                        })
                        setVoucherFile(null)
                        setFileList([])
                      }}>记录付款</Button>
                      {r.propertyType === 'dormitory' && canAllocate && (
                        <Button size="small" onClick={() => {
                          openAllocate(r)
                          allocateForm.resetFields()
                          allocateForm.setFieldsValue({
                            allocationDate: dayjs(),
                            monthlyRentCents: null,
                          })
                        }}>分配宿舍</Button>
                      )}
                    </>
                  )}
                </Space>
              )
            },
          ] satisfies DataTableColumn<RentalProperty>[]}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 新建租赁 */}
      <Modal
        title="新建租赁"
        open={createOpen}
        onCancel={() => { closeCreate(); createForm.resetFields() }}
        onOk={handleCreate}
        width={800}
      >
        <Form form={createForm} layout="vertical" initialValues={{ currency: 'CNY', propertyType: 'office', status: 'active', payment_day: 1, rentType: 'monthly', paymentPeriodMonths: 1 }}>
          <Form.Item name="propertyCode" label="房屋编号" rules={[{ required: true }]}>
            <Input placeholder="唯一标识，如：RP001" />
          </Form.Item>
          <Form.Item name="name" label="房屋名称/地址" rules={[{ required: true }]}>
            <Input placeholder="房屋名称或详细地址" />
          </Form.Item>
          <Form.Item name="propertyType" label="类型" rules={[{ required: true }]}>
            <Select options={PROPERTY_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item name="areaSqm" label="面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="面积" />
          </Form.Item>
          <Form.Item name="rentType" label="租金类型" rules={[{ required: true }]}>
            <Select options={RENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.rentType !== currentValues.rentType}
          >
            {({ getFieldValue }) => {
              const rentType = getFieldValue('rentType')
              return rentType === 'yearly' ? (
                <Form.Item name="yearlyRentCents" label="年租金" rules={[{ required: true }]}>
                  <AmountInput style={{ width: '100%' }} placeholder="年租金" currency={createForm.getFieldValue('currency')} />
                </Form.Item>
              ) : (
                <Form.Item name="monthlyRentCents" label="月租金" rules={[{ required: true }]}>
                  <AmountInput style={{ width: '100%' }} placeholder="月租金" currency={createForm.getFieldValue('currency')} />
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="paymentPeriodMonths" label="付款周期" rules={[{ required: true }]}>
            <Select options={PAYMENT_PERIOD_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <CurrencySelect />
          </Form.Item>

          <Form.Item name="employeeId" label="员工" required className="form-no-margin-bottom">
            <Select options={employees} showSearch optionFilterProp="label" placeholder="选择员工" allowClear />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期" required className="form-no-margin-bottom">
            <DatePicker className="form-full-width" format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期" className="form-no-margin-bottom">
            <DatePicker className="form-full-width" format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="monthlyAmountCents" label="月租金" required className="form-no-margin-bottom">
            <InputNumber className="form-full-width" min={0} precision={2} placeholder="员工月租金" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
          <Form.Item name="landlordName" label="房东姓名">
            <Input placeholder="房东姓名" />
          </Form.Item>
          <Form.Item name="landlordContact" label="房东联系方式">
            <Input placeholder="联系电话或邮箱" />
          </Form.Item>
          <Form.Item name="leaseStartDate" label="租赁开始日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="leaseEndDate" label="租赁结束日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="depositCents" label="押金">
            <AmountInput style={{ width: '100%' }} placeholder="押金" currency={createForm.getFieldValue('currency')} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="付款方式">
            <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="paymentDay" label="每月付款日期">
            <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} placeholder="1-31" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.propertyType !== currentValues.propertyType}
          >
            {({ getFieldValue }) => {
              const propertyType = getFieldValue('propertyType')
              return propertyType === 'office' ? (
                <Form.Item name="departmentId" label="使用项目">
                  <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
                </Form.Item>
              ) : propertyType === 'dormitory' ? (
                <Form.Item name="initialEmployees" label="初始分配员工（可选）">
                  <Select
                    mode="multiple"
                    options={employees}
                    showSearch
                    optionFilterProp="label"
                    placeholder="选择员工（可多选）"
                    allowClear
                  />
                </Form.Item>
              ) : null
            }}
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
          <Form.Item name="contractFileUrl" label="租房合同">
            <Upload
              accept=".pdf,application/pdf"
              maxCount={1}
              fileList={contractFileList}
              beforeUpload={(file) => handleContractUpload(file, createForm)}
              onRemove={() => {
                setContractFileList([])
                createForm.setFieldValue('contractFileUrl', null)
              }}
              disabled={contractUploading}
            >
              <Button icon={<UploadOutlined />} loading={contractUploading}>
                上传PDF合同
              </Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              支持PDF格式，最大20MB
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑租赁 */}
      <Modal
        title={`编辑租赁：${editProperty?.name || ''}`}
        open={editOpen}
        onCancel={() => { closeEdit(); editForm.resetFields() }}
        onOk={handleEdit}
        width={800}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="房屋名称/地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="propertyType" label="类型" rules={[{ required: true }]}>
            <Select options={PROPERTY_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input />
          </Form.Item>
          <Form.Item name="areaSqm" label="面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="rentType" label="租金类型" rules={[{ required: true }]}>
            <Select options={RENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.rentType !== currentValues.rentType}
          >
            {({ getFieldValue }) => {
              const rentType = getFieldValue('rentType')
              return rentType === 'yearly' ? (
                <Form.Item name="yearlyRentCents" label="年租金" rules={[{ required: true }]}>
                  <AmountInput style={{ width: '100%' }} currency={editForm.getFieldValue('currency')} />
                </Form.Item>
              ) : (
                <Form.Item name="monthlyRentCents" label="月租金" rules={[{ required: true }]}>
                  <AmountInput style={{ width: '100%' }} currency={editForm.getFieldValue('currency')} />
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="paymentPeriodMonths" label="付款周期" rules={[{ required: true }]}>
            <Select options={PAYMENT_PERIOD_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <CurrencySelect />
          </Form.Item>
          <Form.Item name="landlordName" label="房东姓名">
            <Input />
          </Form.Item>
          <Form.Item name="landlordContact" label="房东联系方式">
            <Input />
          </Form.Item>
          <Form.Item name="leaseStartDate" label="租赁开始日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="leaseEndDate" label="租赁结束日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="depositCents" label="押金">
            <AmountInput style={{ width: '100%' }} currency={editForm.getFieldValue('currency')} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="付款方式">
            <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="paymentDay" label="每月付款日期">
            <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.propertyType !== currentValues.propertyType}
          >
            {({ getFieldValue }) => {
              const propertyType = getFieldValue('propertyType')
              return propertyType === 'office' ? (
                <Form.Item name="departmentId" label="使用项目">
                  <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
                </Form.Item>
              ) : null
            }}
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="contractFileUrl" label="租房合同">
            <Upload
              accept=".pdf,application/pdf"
              maxCount={1}
              fileList={contractFileList}
              beforeUpload={(file) => handleContractUpload(file, editForm)}
              onRemove={() => {
                setContractFileList([])
                editForm.setFieldValue('contractFileUrl', null)
              }}
              disabled={contractUploading}
            >
              <Button icon={<UploadOutlined />} loading={contractUploading}>
                上传PDF合同
              </Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              支持PDF格式，最大20MB
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 租赁详情 */}
      <Modal
        title={`租赁详情：${currentProperty?.name || detailProperty?.name || ''}`}
        open={detailOpen}
        onCancel={() => { closeDetail() }}
        width={1000}
        footer={null}
      >
        {currentProperty && (
          <Tabs>
            <Tabs.TabPane tab="基本信息" key="basic">
              <div style={{ padding: '16px 0' }}>
                <p><strong>房屋编号：</strong>{currentProperty.propertyCode}</p>
                <p><strong>房屋名称：</strong>{currentProperty.name}</p>
                <p><strong>类型：</strong>{PROPERTY_TYPE_OPTIONS.find(o => o.value === currentProperty.propertyType)?.label || currentProperty.propertyType}</p>
                <p><strong>地址：</strong>{currentProperty.address || '-'}</p>
                <p><strong>面积：</strong>{currentProperty.areaSqm ? `${currentProperty.areaSqm} 平方米` : '-'}</p>
                <p><strong>租金类型：</strong>{RENT_TYPE_OPTIONS.find(o => o.value === currentProperty.rentType)?.label || currentProperty.rentType || '月租'}</p>
                {currentProperty.rentType === 'yearly' ? (
                  <p><strong>年租金：</strong><AmountDisplay cents={currentProperty.yearlyRentCents} currency={currentProperty.currency} /></p>
                ) : (
                  <p><strong>月租金：</strong><AmountDisplay cents={currentProperty.monthlyRentCents} currency={currentProperty.currency} /></p>
                )}
                <p><strong>付款周期：</strong>{PAYMENT_PERIOD_OPTIONS.find(o => o.value === currentProperty.paymentPeriodMonths)?.label || `${currentProperty.paymentPeriodMonths || 1}月`}</p>
                <p><strong>押金：</strong><AmountDisplay cents={currentProperty.depositCents} currency={currentProperty.currency} /></p>
                <p><strong>房东姓名：</strong>{currentProperty.landlordName || '-'}</p>
                <p><strong>房东联系方式：</strong>{currentProperty.landlordContact || '-'}</p>
                <p><strong>租赁开始：</strong>{currentProperty.leaseStartDate || '-'}</p>
                <p><strong>租赁结束：</strong>{currentProperty.leaseEndDate || '-'}</p>
                <p><strong>付款方式：</strong>{PAYMENT_METHOD_OPTIONS.find(o => o.value === currentProperty.paymentMethod)?.label || currentProperty.paymentMethod || '-'}</p>
                <p><strong>每月付款日期：</strong>{currentProperty.paymentDay || '-'}号</p>
                {currentProperty.propertyType === 'office' ? (
                  <p><strong>使用项目：</strong>{currentProperty.departmentName || '-'}</p>
                ) : (
                  <>
                    <p><strong>使用员工：</strong>{currentProperty.allocations && currentProperty.allocations.length > 0 ? currentProperty.allocations.filter((a) => !a.returnDate).map((a) => a.employeeName).join('、') : '-'}</p>
                  </>
                )}
                <p><strong>状态：</strong>{STATUS_OPTIONS.find(o => o.value === currentProperty.status)?.label || currentProperty.status}</p>
                <p><strong>备注：</strong>{currentProperty.memo || '-'}</p>
                {currentProperty.contractFileUrl && (
                  <p>
                    <strong>租房合同：</strong>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(currentProperty.contractFileUrl, '_blank')}
                    >
                      查看合同
                    </Button>
                  </p>
                )}
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="付款记录" key="payments">
              <DataTable<RentalPayment>
                columns={[
                  { title: '付款日期', dataIndex: 'paymentDate', key: 'paymentDate', width: 120 },
                  {
                    title: '年月',
                    key: 'yearMonth',
                    width: 100,
                    render: (_: unknown, r: RentalPayment) => `${r.year}年${r.month}月`
                  },
                  {
                    title: '金额',
                    key: 'amount',
                    width: 120,
                    render: (_: unknown, r: RentalPayment) => <AmountDisplay cents={r.amountCents} currency={r.currency || 'CNY'} />
                  },
                  { title: '付款账户', dataIndex: 'accountName', key: 'accountName', width: 150 },
                  { title: '付款方式', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 100 },
                  { title: '备注', dataIndex: 'memo', key: 'memo' },
                ] satisfies DataTableColumn<RentalPayment>[]}
                data={currentProperty.payments || []}
                rowKey="id"
                pagination={{ pageSize: 20 }}
              />
            </Tabs.TabPane>
            {currentProperty.propertyType === 'dormitory' && (
              <Tabs.TabPane tab="宿舍分配" key="allocations">
                <DataTable<DormitoryAllocationWithDetails>
                  columns={[
                    { title: '员工姓名', dataIndex: 'employeeName', key: 'employeeName', width: 120 },
                    { title: '员工项目', dataIndex: 'employee_departmentName', key: 'employee_departmentName', width: 120 },
                    { 
                      title: '房间号', 
                      key: 'room_number', 
                      width: 100,
                      render: (_: unknown, r: DormitoryAllocationWithDetails) => r.room_number || r.roomNumber || '-'
                    },
                    { 
                      title: '床位号', 
                      key: 'bed_number', 
                      width: 100,
                      render: (_: unknown, r: DormitoryAllocationWithDetails) => r.bed_number || r.bedNumber || '-'
                    },
                    { title: '分配日期', dataIndex: 'allocationDate', key: 'allocationDate', width: 120 },
                    {
                      title: '归还日期',
                      dataIndex: 'returnDate',
                      key: 'returnDate',
                      width: 120,
                      render: (v: string | undefined) => <EmptyText value={v} />
                    },
                    {
                      title: '员工月租金',
                      key: 'monthlyRent',
                      width: 120,
                      render: (_: unknown, r: DormitoryAllocationWithDetails) => r.monthlyRentCents ? <AmountDisplay cents={r.monthlyRentCents} currency={currentProperty.currency} /> : <EmptyText value={null} />
                    },
                    { title: '状态', key: 'status', width: 100, render: (_: unknown, r: DormitoryAllocationWithDetails) => r.returnDate ? '已归还' : '使用中' },
                  ] satisfies DataTableColumn<DormitoryAllocationWithDetails>[]}
                  data={(currentProperty.allocations || []) as DormitoryAllocationWithDetails[]}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
            )}
            <Tabs.TabPane tab="变动记录" key="changes">
              <DataTable<RentalPropertyChangeWithSnakeCase>
                columns={[
                  { 
                    title: '变动日期', 
                    key: 'changedAt', 
                    width: 120, 
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => {
                      const date = r.change_date || r.changedAt
                      return date ? dayjs(typeof date === 'number' ? date : date).format('YYYY-MM-DD') : '-'
                    }
                  },
                  {
                    title: '变动类型',
                    key: 'change_type',
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => {
                      if (r.change_type) {
                        const types: Record<string, string> = {
                          renew: '续签',
                          terminate: '终止',
                          modify: '修改',
                          transfer: '转租',
                        }
                        return types[r.change_type] || r.change_type
                      }
                      // 根据变更内容推断类型
                      if (r.fromStatus === 'active' && r.toStatus === 'expired') return '到期'
                      if (r.toStatus === 'terminated') return '终止'
                      const fromEnd = r.from_lease_end || r.fromLeaseEnd
                      const toEnd = r.to_lease_end || r.toLeaseEnd
                      if (fromEnd && toEnd && toEnd > fromEnd) return '续签'
                      return '修改'
                    }
                  },
                  { 
                    title: '原租赁开始', 
                    key: 'fromLeaseStart', 
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.from_lease_start || r.fromLeaseStart || '-'
                  },
                  { 
                    title: '新租赁开始', 
                    key: 'toLeaseStart', 
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.to_lease_start || r.toLeaseStart || '-'
                  },
                  { 
                    title: '原租赁结束', 
                    key: 'fromLeaseEnd', 
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.from_lease_end || r.fromLeaseEnd || '-'
                  },
                  { 
                    title: '新租赁结束', 
                    key: 'toLeaseEnd', 
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.to_lease_end || r.toLeaseEnd || '-'
                  },
                  {
                    title: '原月租金',
                    key: 'from_monthlyRent',
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => {
                      const amount = r.from_monthlyRentCents || r.fromMonthlyRentCents
                      return amount ? <AmountDisplay cents={amount} currency={currentProperty.currency} /> : <EmptyText value={null} />
                    }
                  },
                  {
                    title: '新月租金',
                    key: 'to_monthlyRent',
                    width: 120,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => {
                      const amount = r.to_monthlyRentCents || r.toMonthlyRentCents
                      return amount ? <AmountDisplay cents={amount} currency={currentProperty.currency} /> : <EmptyText value={null} />
                    }
                  },
                  { 
                    title: '原状态', 
                    key: 'fromStatus', 
                    width: 100,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.from_status || r.fromStatus || '-'
                  },
                  { 
                    title: '新状态', 
                    key: 'toStatus', 
                    width: 100,
                    render: (_: unknown, r: RentalPropertyChangeWithSnakeCase) => r.to_status || r.toStatus || '-'
                  },
                  { title: '备注', dataIndex: 'memo', key: 'memo' },
                ] satisfies DataTableColumn<RentalPropertyChangeWithSnakeCase>[]}
                data={(currentProperty.changes || []) as RentalPropertyChangeWithSnakeCase[]}
                rowKey="id"
                pagination={{ pageSize: 20 }}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 记录付款 */}
      <Modal
        title={`记录付款：${paymentProperty?.name || ''}`}
        open={paymentOpen}
        onCancel={() => { closePayment(); paymentForm.resetFields(); setVoucherFile(null); setFileList([]) }}
        onOk={handlePayment}
        width={700}
      >
        {paymentProperty && (
          <Form form={paymentForm} layout="vertical">
            <Form.Item name="propertyId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="paymentDate" label="付款日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
              <CurrencySelect />
            </Form.Item>
            <Form.Item 
              name="amountCents" 
              label="付款金额" 
              rules={[{ required: true }]}
              dependencies={['currency']}
            >
              {({ getFieldValue }) => (
                <AmountInput style={{ width: '100%' }} placeholder="付款金额" currency={getFieldValue('currency')} />
              )}
            </Form.Item>
            <Form.Item 
              name="accountId" 
              label="付款账户" 
              rules={[{ required: true }]}
              dependencies={['currency']}
            >
              {({ getFieldValue }) => (
                <AccountSelect
                  placeholder="选择付款账户"
                  filterByCurrency={getFieldValue('currency')}
                  showCurrency
                />
              )}
            </Form.Item>
                options={accounts.filter((a) => a.currency === paymentProperty.currency)}
                showSearch
                optionFilterProp="label"
                placeholder="选择账户"
              />
            </Form.Item>
            <Form.Item name="categoryId" label="支出类别">
              <Select options={categories} showSearch optionFilterProp="label" placeholder="选择类别" allowClear />
            </Form.Item>
            <Form.Item name="paymentMethod" label="付款方式">
              <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="voucherUrl" label="付款凭证">
              <Upload
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={() => {
                  setVoucherFile(null)
                  setFileList([])
                  paymentForm.setFieldsValue({ voucherUrl: undefined })
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  上传凭证
                </Button>
              </Upload>
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 分配宿舍 */}
      <Modal
        title={`分配宿舍：${allocateProperty?.name || ''}`}
        open={allocateOpen}
        onCancel={() => { closeAllocate(); allocateForm.resetFields() }}
        onOk={handleAllocate}
        width={600}
      >
        {allocateProperty && (
          <Form form={allocateForm} layout="vertical">
            <Form.Item name="employeeId" label="分配给员工" rules={[{ required: true }]}>
              <Select
                options={employees}
                showSearch
                optionFilterProp="label"
                placeholder="选择员工"
              />
            </Form.Item>
            <Form.Item name="room_number" label="房间号">
              <Input placeholder="房间号" />
            </Form.Item>
            <Form.Item name="bed_number" label="床位号">
              <Input placeholder="床位号" />
            </Form.Item>
            <Form.Item name="allocationDate" label="分配日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item 
              name="monthlyRentCents" 
              label="员工需支付月租金（如员工需要支付）"
              dependencies={['currency']}
            >
              {({ getFieldValue }) => (
                <AmountInput style={{ width: '100%' }} placeholder="员工月租金" currency={allocateForm.getFieldValue('currency')} />
              )}
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </PageContainer>
  )
}

