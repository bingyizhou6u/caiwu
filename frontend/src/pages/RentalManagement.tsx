import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload, Tag, Tabs } from 'antd'
import { UploadOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../config/api'
import dayjs from 'dayjs'
import { formatAmount } from '../utils/formatters'
import { loadCurrencies, loadDepartments, loadAccounts, loadExpenseCategories, loadEmployees } from '../utils/loaders'
import { apiGet } from '../utils/api'
import type { RentalProperty, RentalPayableBill, DormitoryAllocation, SelectOption } from '../types/rental'
import { uploadImageAsWebP, isSupportedImageType } from '../utils/image'
import { usePermissions } from '../utils/permissions'

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
  const [data, setData] = useState<RentalProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [currentProperty, setCurrentProperty] = useState<RentalProperty | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const [allocateForm] = Form.useForm()
  const [currencies, setCurrencies] = useState<SelectOption[]>([])
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [accounts, setAccounts] = useState<SelectOption[]>([])
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [employees, setEmployees] = useState<SelectOption[]>([])
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [contractFileList, setContractFileList] = useState<UploadFile[]>([])
  const [contractUploading, setContractUploading] = useState(false)
  const [payableBills, setPayableBills] = useState<RentalPayableBill[]>([])
  const canManageRental = hasPermission('asset', 'rental', 'create')
  const canAllocate = hasPermission('asset', 'rental', 'allocate') || canManageRental

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (propertyTypeFilter) params.append('property_type', propertyTypeFilter)
      if (statusFilter) params.append('status', statusFilter)
      
      const rows = await apiGet(`${api.rentalProperties}?${params.toString()}`)
      setData(rows)
    } catch (error: any) {
      message.error(`查询失败: ${error.message || '网络错误'}`)
    } finally {
      setLoading(false)
    }
  }, [propertyTypeFilter, statusFilter])

  const loadMasterData = useCallback(async () => {
    try {
      const [currenciesData, departmentsData, accountsData, categoriesData, employeesData] = await Promise.all([
        loadCurrencies(),
        loadDepartments(),
        loadAccounts(),
        loadExpenseCategories(),
        loadEmployees()
      ])
      setCurrencies(currenciesData)
      setDepartments(departmentsData)
      setAccounts(accountsData)
      setCategories(categoriesData)
      setEmployees(employeesData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }, [])

  const loadPayableBills = useCallback(async () => {
    try {
      const rows = await apiGet(`${api.rentalPayableBills}?status=unpaid`)
      setPayableBills(rows)
    } catch (error: any) {
      message.error(`加载应付账单失败: ${error.message || '网络错误'}`)
    }
  }, [])

  useEffect(() => {
    load()
    loadMasterData()
    loadPayableBills()
  }, [load, loadMasterData, loadPayableBills])

  useEffect(() => {
    load()
  }, [load])

  const handleContractUpload = async (file: File, form: any) => {
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
      
      const res = await fetch(api.upload.contract, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      
      const data = await res.json()
      if (!res.ok) {
        message.error(data.error || '上传失败')
        setContractUploading(false)
        return false
      }
      
      form.setFieldValue('contract_file_url', data.url)
      setContractFileList([{ uid: '1', name: file.name, status: 'done', url: data.url }])
      message.success('合同上传成功')
      setContractUploading(false)
      return false
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
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
      paymentForm.setFieldValue('voucher_url', url)
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

  const handleCreate = async () => {
    const v = await createForm.validateFields()
    const payload = {
      ...v,
      monthly_rent_cents: v.rent_type === 'monthly' && v.monthly_rent_cents ? v.monthly_rent_cents * 100 : null,
      yearly_rent_cents: v.rent_type === 'yearly' && v.yearly_rent_cents ? v.yearly_rent_cents * 100 : null,
      deposit_cents: v.deposit_cents ? v.deposit_cents * 100 : null,
      lease_start_date: v.lease_start_date ? v.lease_start_date.format('YYYY-MM-DD') : null,
      lease_end_date: v.lease_end_date ? v.lease_end_date.format('YYYY-MM-DD') : null,
    }
    
    // 移除initial_employees，单独处理
    const initialEmployees = v.initial_employees || []
    delete payload.initial_employees
    
    try {
      const res = await fetch(api.rentalProperties, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '创建失败')
        return
      }
      
      // 如果有初始员工分配，创建分配记录
      if (v.property_type === 'dormitory' && initialEmployees.length > 0) {
        const propertyId = result.id
        for (const employeeId of initialEmployees) {
          try {
            const allocRes = await fetch(api.rentalPropertiesAllocateDormitory(propertyId), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employee_id: employeeId,
                allocation_date: v.lease_start_date ? v.lease_start_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
              }),
              credentials: 'include'
            })
            if (!allocRes.ok) {
              const allocError = await allocRes.json()
              console.error(`分配员工失败 (${employeeId}):`, allocError.error || '未知错误')
            }
          } catch (error: any) {
            console.error(`分配员工失败 (${employeeId}):`, error.message || '网络错误')
          }
        }
      }
      
      message.success('创建成功' + (initialEmployees.length > 0 ? `，已分配${initialEmployees.length}名员工` : ''))
      setCreateOpen(false)
      createForm.resetFields()
      setContractFileList([])
      load()
    } catch (error: any) {
      message.error('创建失败：' + (error.message || '网络错误'))
    }
  }

  const handleEdit = async () => {
    if (!currentProperty) return
    
    const v = await editForm.validateFields()
    const payload = {
      ...v,
      monthly_rent_cents: Math.round((v.monthly_rent_cents || 0) * 100),
      deposit_cents: v.deposit_cents ? Math.round(v.deposit_cents * 100) : null,
      lease_start_date: v.lease_start_date ? v.lease_start_date.format('YYYY-MM-DD') : null,
      lease_end_date: v.lease_end_date ? v.lease_end_date.format('YYYY-MM-DD') : null,
    }
    
    try {
      const res = await fetch(api.rentalPropertiesById(currentProperty.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '更新失败')
        return
      }
      message.success('更新成功')
      setEditOpen(false)
      setCurrentProperty(null)
      editForm.resetFields()
      setContractFileList([])
      load()
    } catch (error: any) {
      message.error('更新失败：' + (error.message || '网络错误'))
    }
  }

  const handlePayment = async () => {
    const v = await paymentForm.validateFields()
    const paymentDate = v.payment_date ? v.payment_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0]
    const paymentDateObj = v.payment_date ? v.payment_date : dayjs()
    const year = paymentDateObj.year()
    const month = paymentDateObj.month() + 1
    
    const payload = {
      ...v,
      payment_date: paymentDate,
      year,
      month,
      amount_cents: Math.round((v.amount_cents || 0) * 100),
    }
    
    try {
      const res = await fetch(api.rentalPayments, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '记录付款失败')
        return
      }
      message.success(`付款记录成功，凭证号：${result.voucher_no}`)
      setPaymentOpen(false)
      paymentForm.resetFields()
      setVoucherFile(null)
      setFileList([])
      load()
    } catch (error: any) {
      message.error('记录付款失败：' + (error.message || '网络错误'))
    }
  }

  const handleAllocate = async () => {
    if (!currentProperty) return
    
    const v = await allocateForm.validateFields()
    const payload = {
      ...v,
      allocation_date: v.allocation_date ? v.allocation_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      monthly_rent_cents: v.monthly_rent_cents ? Math.round(v.monthly_rent_cents * 100) : null,
    }
    
    try {
      const res = await fetch(api.rentalPropertiesAllocateDormitory(currentProperty.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '分配失败')
        return
      }
      message.success('分配成功')
      setAllocateOpen(false)
      allocateForm.resetFields()
      load()
    } catch (error: any) {
      message.error('分配失败：' + (error.message || '网络错误'))
    }
  }

  const loadDetail = async (id: string) => {
    try {
      const res = await fetch(api.rentalPropertiesById(id), { credentials: 'include' })
      const j = await res.json()
      setCurrentProperty(j)
      setDetailOpen(true)
    } catch (e) {
      message.error('加载详情失败')
    }
  }

  return (
    <Card title="租房管理">
      <Space style={{ marginBottom: 16 }} wrap>
        {canManageRental && (
          <Button type="primary" onClick={() => { setCreateOpen(true); createForm.resetFields() }}>
            新建租赁
          </Button>
        )}
        <Button onClick={load}>刷新</Button>
        <Select
          placeholder="类型筛选"
          allowClear
          style={{ width: 150 }}
          value={propertyTypeFilter}
          onChange={setPropertyTypeFilter}
        >
          {PROPERTY_TYPE_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
        </Select>
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 150 }}
          value={statusFilter}
          onChange={setStatusFilter}
        >
          {STATUS_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
        </Select>
      </Space>
      
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={[
          { title: '房屋编号', dataIndex: 'property_code', width: 120 },
          { title: '房屋名称', dataIndex: 'name', width: 200 },
          {
            title: '类型',
            dataIndex: 'property_type',
            width: 100,
            render: (v: string) => {
              const option = PROPERTY_TYPE_OPTIONS.find(o => o.value === v)
              return option?.label || v
            }
          },
          {
            title: '租金',
            width: 120,
            render: (_: any, r: any) => {
              if (r.rent_type === 'yearly') {
                const rent = r.yearly_rent_cents ? formatAmount(r.yearly_rent_cents) : '0.00'
                return `${rent} ${r.currency || ''}/年`
              } else {
                const rent = r.monthly_rent_cents ? formatAmount(r.monthly_rent_cents) : '0.00'
                return `${rent} ${r.currency || ''}/月`
              }
            }
          },
          {
            title: '付款周期',
            width: 100,
            render: (_: any, r: any) => {
              const period = PAYMENT_PERIOD_OPTIONS.find(o => o.value === r.payment_period_months)
              return period?.label || `${r.payment_period_months || 1}月`
            }
          },
          { title: '租赁开始', dataIndex: 'lease_start_date', width: 120 },
          { title: '租赁结束', dataIndex: 'lease_end_date', width: 120 },
          {
            title: '使用项目/员工',
            width: 200,
            render: (_: any, r: any) => {
              if (r.property_type === 'office') {
                return r.department_name || '-'
              } else {
                // 住宅：显示分配的员工数量（需要从详情中获取）
                return r.allocations_count ? `${r.allocations_count}人` : '-'
              }
            }
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => {
              const option = STATUS_OPTIONS.find(o => o.value === v)
              const colors: Record<string, string> = {
                active: 'green',
                expired: 'orange',
                terminated: 'red',
              }
              return <Tag color={colors[v] || 'default'}>{option?.label || v}</Tag>
            }
          },
          {
            title: '操作',
            width: 250,
            fixed: 'right',
            render: (_: any, r: any) => (
              <Space>
                <Button size="small" onClick={() => loadDetail(r.id)}>详情</Button>
                {canManageRental && (
                  <>
                    <Button size="small" onClick={() => {
                      setCurrentProperty(r)
                      editForm.setFieldsValue({
                        property_code: r.property_code,
                        name: r.name,
                        property_type: r.property_type,
                        address: r.address,
                        area_sqm: r.area_sqm,
                        rent_type: r.rent_type || 'monthly',
                        monthly_rent_cents: r.monthly_rent_cents ? r.monthly_rent_cents / 100 : null,
                        yearly_rent_cents: r.yearly_rent_cents ? r.yearly_rent_cents / 100 : null,
                        payment_period_months: r.payment_period_months || 1,
                        currency: r.currency,
                        landlord_name: r.landlord_name,
                        landlord_contact: r.landlord_contact,
                        lease_start_date: r.lease_start_date ? dayjs(r.lease_start_date) : null,
                        lease_end_date: r.lease_end_date ? dayjs(r.lease_end_date) : null,
                        deposit_cents: r.deposit_cents ? r.deposit_cents / 100 : null,
                        payment_method: r.payment_method,
                        payment_day: r.payment_day || 1,
                        department_id: r.department_id,
                        status: r.status,
                        memo: r.memo,
                        contract_file_url: r.contract_file_url,
                      })
                      setContractFileList(r.contract_file_url ? [{ uid: '1', name: '合同文件', status: 'done', url: r.contract_file_url }] : [])
                      setEditOpen(true)
                    }}>编辑</Button>
                    <Button size="small" type="primary" onClick={() => {
                      setCurrentProperty(r)
                      paymentForm.resetFields()
                      // 计算本次付款金额（根据付款周期）
                      let amount = null
                      if (r.rent_type === 'yearly') {
                        // 年租：根据付款周期计算
                        amount = r.yearly_rent_cents ? (r.yearly_rent_cents / 100 / (12 / (r.payment_period_months || 1))) : null
                      } else {
                        // 月租：根据付款周期计算
                        amount = r.monthly_rent_cents ? (r.monthly_rent_cents / 100 * (r.payment_period_months || 1)) : null
                      }
                      paymentForm.setFieldsValue({
                        property_id: r.id,
                        payment_date: dayjs(),
                        amount_cents: amount,
                        currency: r.currency,
                        payment_method: r.payment_method,
                      })
                      setVoucherFile(null)
                      setFileList([])
                      setPaymentOpen(true)
                    }}>记录付款</Button>
                    {r.property_type === 'dormitory' && canAllocate && (
                      <Button size="small" onClick={() => {
                        setCurrentProperty(r)
                        allocateForm.resetFields()
                        allocateForm.setFieldsValue({
                          allocation_date: dayjs(),
                          monthly_rent_cents: null,
                        })
                        setAllocateOpen(true)
                      }}>分配宿舍</Button>
                    )}
                  </>
                )}
              </Space>
            )
          },
        ]}
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 20 }}
      />

      {/* 新建租赁 */}
      <Modal
        title="新建租赁"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields() }}
        onOk={handleCreate}
        width={800}
      >
        <Form form={createForm} layout="vertical" initialValues={{ currency: 'CNY', property_type: 'office', status: 'active', payment_day: 1, rent_type: 'monthly', payment_period_months: 1 }}>
          <Form.Item name="property_code" label="房屋编号" rules={[{ required: true }]}>
            <Input placeholder="唯一标识，如：RP001" />
          </Form.Item>
          <Form.Item name="name" label="房屋名称/地址" rules={[{ required: true }]}>
            <Input placeholder="房屋名称或详细地址" />
          </Form.Item>
          <Form.Item name="property_type" label="类型" rules={[{ required: true }]}>
            <Select options={PROPERTY_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item name="area_sqm" label="面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="面积" />
          </Form.Item>
          <Form.Item name="rent_type" label="租金类型" rules={[{ required: true }]}>
            <Select options={RENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item 
            noStyle 
            shouldUpdate={(prevValues, currentValues) => prevValues.rent_type !== currentValues.rent_type}
          >
            {({ getFieldValue }) => {
              const rentType = getFieldValue('rent_type')
              return rentType === 'yearly' ? (
                <Form.Item name="yearly_rent_cents" label="年租金" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="年租金" />
                </Form.Item>
              ) : (
                <Form.Item name="monthly_rent_cents" label="月租金" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="月租金" />
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="payment_period_months" label="付款周期" rules={[{ required: true }]}>
            <Select options={PAYMENT_PERIOD_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencies} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="landlord_name" label="房东姓名">
            <Input placeholder="房东姓名" />
          </Form.Item>
          <Form.Item name="landlord_contact" label="房东联系方式">
            <Input placeholder="联系电话或邮箱" />
          </Form.Item>
          <Form.Item name="lease_start_date" label="租赁开始日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="lease_end_date" label="租赁结束日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="deposit_cents" label="押金">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="押金" />
          </Form.Item>
          <Form.Item name="payment_method" label="付款方式">
            <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="payment_day" label="每月付款日期">
            <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} placeholder="1-31" />
          </Form.Item>
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.property_type !== currentValues.property_type}
          >
            {({ getFieldValue }) => {
              const propertyType = getFieldValue('property_type')
              return propertyType === 'office' ? (
                <Form.Item name="department_id" label="使用项目">
                  <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
                </Form.Item>
              ) : propertyType === 'dormitory' ? (
                <Form.Item name="initial_employees" label="初始分配员工（可选）">
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
          <Form.Item name="contract_file_url" label="租房合同">
            <Upload
              accept=".pdf,application/pdf"
              maxCount={1}
              fileList={contractFileList}
              beforeUpload={(file) => handleContractUpload(file, createForm)}
              onRemove={() => {
                setContractFileList([])
                createForm.setFieldValue('contract_file_url', null)
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
        title={`编辑租赁：${currentProperty?.name || ''}`}
        open={editOpen}
        onCancel={() => { setEditOpen(false); setCurrentProperty(null); editForm.resetFields() }}
        onOk={handleEdit}
        width={800}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="房屋名称/地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="property_type" label="类型" rules={[{ required: true }]}>
            <Select options={PROPERTY_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input />
          </Form.Item>
          <Form.Item name="area_sqm" label="面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="rent_type" label="租金类型" rules={[{ required: true }]}>
            <Select options={RENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item 
            noStyle 
            shouldUpdate={(prevValues, currentValues) => prevValues.rent_type !== currentValues.rent_type}
          >
            {({ getFieldValue }) => {
              const rentType = getFieldValue('rent_type')
              return rentType === 'yearly' ? (
                <Form.Item name="yearly_rent_cents" label="年租金" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                </Form.Item>
              ) : (
                <Form.Item name="monthly_rent_cents" label="月租金" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="payment_period_months" label="付款周期" rules={[{ required: true }]}>
            <Select options={PAYMENT_PERIOD_OPTIONS} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencies} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="landlord_name" label="房东姓名">
            <Input />
          </Form.Item>
          <Form.Item name="landlord_contact" label="房东联系方式">
            <Input />
          </Form.Item>
          <Form.Item name="lease_start_date" label="租赁开始日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="lease_end_date" label="租赁结束日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="deposit_cents" label="押金">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="payment_method" label="付款方式">
            <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="payment_day" label="每月付款日期">
            <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} />
          </Form.Item>
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.property_type !== currentValues.property_type}
          >
            {({ getFieldValue }) => {
              const propertyType = getFieldValue('property_type')
              return propertyType === 'office' ? (
                <Form.Item name="department_id" label="使用项目">
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
          <Form.Item name="contract_file_url" label="租房合同">
            <Upload
              accept=".pdf,application/pdf"
              maxCount={1}
              fileList={contractFileList}
              beforeUpload={(file) => handleContractUpload(file, editForm)}
              onRemove={() => {
                setContractFileList([])
                editForm.setFieldValue('contract_file_url', null)
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
        title={`租赁详情：${currentProperty?.name || ''}`}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setCurrentProperty(null) }}
        width={1000}
        footer={null}
      >
        {currentProperty && (
          <Tabs>
            <Tabs.TabPane tab="基本信息" key="basic">
              <div style={{ padding: '16px 0' }}>
                <p><strong>房屋编号：</strong>{currentProperty.property_code}</p>
                <p><strong>房屋名称：</strong>{currentProperty.name}</p>
                <p><strong>类型：</strong>{PROPERTY_TYPE_OPTIONS.find(o => o.value === currentProperty.property_type)?.label || currentProperty.property_type}</p>
                <p><strong>地址：</strong>{currentProperty.address || '-'}</p>
                <p><strong>面积：</strong>{currentProperty.area_sqm ? `${currentProperty.area_sqm} 平方米` : '-'}</p>
                <p><strong>租金类型：</strong>{RENT_TYPE_OPTIONS.find(o => o.value === currentProperty.rent_type)?.label || currentProperty.rent_type || '月租'}</p>
                {currentProperty.rent_type === 'yearly' ? (
                  <p><strong>年租金：</strong>{currentProperty.yearly_rent_cents ? formatAmount(currentProperty.yearly_rent_cents) : '-'} {currentProperty.currency}</p>
                ) : (
                  <p><strong>月租金：</strong>{currentProperty.monthly_rent_cents ? formatAmount(currentProperty.monthly_rent_cents) : '-'} {currentProperty.currency}</p>
                )}
                <p><strong>付款周期：</strong>{PAYMENT_PERIOD_OPTIONS.find(o => o.value === currentProperty.payment_period_months)?.label || `${currentProperty.payment_period_months || 1}月`}</p>
                <p><strong>押金：</strong>{currentProperty.deposit_cents ? formatAmount(currentProperty.deposit_cents) : '-'} {currentProperty.currency}</p>
                <p><strong>房东姓名：</strong>{currentProperty.landlord_name || '-'}</p>
                <p><strong>房东联系方式：</strong>{currentProperty.landlord_contact || '-'}</p>
                <p><strong>租赁开始：</strong>{currentProperty.lease_start_date || '-'}</p>
                <p><strong>租赁结束：</strong>{currentProperty.lease_end_date || '-'}</p>
                <p><strong>付款方式：</strong>{PAYMENT_METHOD_OPTIONS.find(o => o.value === currentProperty.payment_method)?.label || currentProperty.payment_method || '-'}</p>
                <p><strong>每月付款日期：</strong>{currentProperty.payment_day || '-'}号</p>
                {currentProperty.property_type === 'office' ? (
                  <p><strong>使用项目：</strong>{currentProperty.department_name || '-'}</p>
                ) : (
                  <>
                    <p><strong>使用员工：</strong>{currentProperty.allocations && currentProperty.allocations.length > 0 ? currentProperty.allocations.filter((a: any) => !a.return_date).map((a: any) => a.employee_name).join('、') : '-'}</p>
                  </>
                )}
                <p><strong>状态：</strong>{STATUS_OPTIONS.find(o => o.value === currentProperty.status)?.label || currentProperty.status}</p>
                <p><strong>备注：</strong>{currentProperty.memo || '-'}</p>
                {currentProperty.contract_file_url && (
                  <p>
                    <strong>租房合同：</strong>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(currentProperty.contract_file_url, '_blank')}
                    >
                      查看合同
                    </Button>
                  </p>
                )}
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="付款记录" key="payments">
              <Table
                rowKey="id"
                dataSource={currentProperty.payments || []}
                columns={[
                  { title: '付款日期', dataIndex: 'payment_date', width: 120 },
                  {
                    title: '年月',
                    width: 100,
                    render: (_: any, r: any) => `${r.year}年${r.month}月`
                  },
                  {
                    title: '金额',
                    width: 120,
                    render: (_: any, r: any) => `${formatAmount(r.amount_cents)} ${r.currency || ''}`
                  },
                  { title: '付款账户', dataIndex: 'account_name', width: 150 },
                  { title: '付款方式', dataIndex: 'payment_method', width: 100 },
                  { title: '备注', dataIndex: 'memo' },
                ]}
                pagination={{ pageSize: 20 }}
              />
            </Tabs.TabPane>
            {currentProperty.property_type === 'dormitory' && (
              <Tabs.TabPane tab="宿舍分配" key="allocations">
                <Table
                  rowKey="id"
                  dataSource={currentProperty.allocations || []}
                  columns={[
                    { title: '员工姓名', dataIndex: 'employee_name', width: 120 },
                    { title: '员工项目', dataIndex: 'employee_department_name', width: 120 },
                    { title: '房间号', dataIndex: 'room_number', width: 100 },
                    { title: '床位号', dataIndex: 'bed_number', width: 100 },
                    { title: '分配日期', dataIndex: 'allocation_date', width: 120 },
                    {
                      title: '归还日期',
                      dataIndex: 'return_date',
                      width: 120,
                      render: (v: string) => v || '-'
                    },
                    {
                      title: '员工月租金',
                      width: 120,
                      render: (_: any, r: any) => r.monthly_rent_cents ? `${formatAmount(r.monthly_rent_cents)} ${currentProperty.currency}` : '-'
                    },
                    { title: '状态', width: 100, render: (_: any, r: any) => r.return_date ? '已归还' : '使用中' },
                  ]}
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
            )}
            <Tabs.TabPane tab="变动记录" key="changes">
              <Table
                rowKey="id"
                dataSource={currentProperty.changes || []}
                columns={[
                  { title: '变动日期', dataIndex: 'change_date', width: 120 },
                  {
                    title: '变动类型',
                    dataIndex: 'change_type',
                    width: 120,
                    render: (v: string) => {
                      const types: Record<string, string> = {
                        renew: '续签',
                        terminate: '终止',
                        modify: '修改',
                        transfer: '转租',
                      }
                      return types[v] || v
                    }
                  },
                  { title: '原租赁开始', dataIndex: 'from_lease_start', width: 120 },
                  { title: '新租赁开始', dataIndex: 'to_lease_start', width: 120 },
                  { title: '原租赁结束', dataIndex: 'from_lease_end', width: 120 },
                  { title: '新租赁结束', dataIndex: 'to_lease_end', width: 120 },
                  {
                    title: '原月租金',
                    width: 120,
                    render: (_: any, r: any) => r.from_monthly_rent_cents ? formatAmount(r.from_monthly_rent_cents) : '-'
                  },
                  {
                    title: '新月租金',
                    width: 120,
                    render: (_: any, r: any) => r.to_monthly_rent_cents ? formatAmount(r.to_monthly_rent_cents) : '-'
                  },
                  { title: '原状态', dataIndex: 'from_status', width: 100 },
                  { title: '新状态', dataIndex: 'to_status', width: 100 },
                  { title: '备注', dataIndex: 'memo' },
                ]}
                pagination={{ pageSize: 20 }}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 记录付款 */}
      <Modal
        title={`记录付款：${currentProperty?.name || ''}`}
        open={paymentOpen}
        onCancel={() => { setPaymentOpen(false); setCurrentProperty(null); paymentForm.resetFields(); setVoucherFile(null); setFileList([]) }}
        onOk={handlePayment}
        width={700}
      >
        {currentProperty && (
          <Form form={paymentForm} layout="vertical">
            <Form.Item name="property_id" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="payment_date" label="付款日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="amount_cents" label="付款金额" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="付款金额" />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
              <Select options={currencies} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="account_id" label="付款账户" rules={[{ required: true }]}>
              <Select
                options={accounts.filter(a => a.currency === currentProperty.currency)}
                showSearch
                optionFilterProp="label"
                placeholder="选择账户"
              />
            </Form.Item>
            <Form.Item name="category_id" label="支出类别">
              <Select options={categories} showSearch optionFilterProp="label" placeholder="选择类别" allowClear />
            </Form.Item>
            <Form.Item name="payment_method" label="付款方式">
              <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="voucher_url" label="付款凭证">
              <Upload
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={() => {
                  setVoucherFile(null)
                  setFileList([])
                  paymentForm.setFieldsValue({ voucher_url: undefined })
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
        title={`分配宿舍：${currentProperty?.name || ''}`}
        open={allocateOpen}
        onCancel={() => { setAllocateOpen(false); setCurrentProperty(null); allocateForm.resetFields() }}
        onOk={handleAllocate}
        width={600}
      >
        {currentProperty && (
          <Form form={allocateForm} layout="vertical">
            <Form.Item name="employee_id" label="分配给员工" rules={[{ required: true }]}>
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
            <Form.Item name="allocation_date" label="分配日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="monthly_rent_cents" label="员工需支付月租金（如员工需要支付）">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="员工月租金" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Card>
  )
}

