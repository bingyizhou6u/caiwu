import React, { useState } from 'react'
import { Card, Button, Modal, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../../../config/api'
import dayjs from 'dayjs'
import { formatAmount } from '../../../utils/formatters'
import { useCurrencies, useDepartments, useAccounts, useExpenseCategories, useSites } from '../../../hooks/useBusinessData'
import { useVendors, useFixedAssets, useFixedAssetPurchase } from '../../../hooks'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'
import { withErrorHandler } from '../../../utils/errorHandler'

const { TextArea } = Input

const CATEGORY_OPTIONS = [
  { value: '电脑', label: '电脑' },
  { value: '办公家具', label: '办公家具' },
  { value: '车辆', label: '车辆' },
  { value: '设备', label: '设备' },
  { value: '其他', label: '其他' },
]

const DEPRECIATION_METHOD_OPTIONS = [
  { value: 'straight_line', label: '直线法' },
  { value: 'accelerated', label: '加速折旧' },
]

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import type { FixedAsset } from '../../../types/domain'
import type { SelectOption } from '../../../types/business'

// 账户选项类型（包含 currency 字段）
type AccountOption = SelectOption & { currency?: string }

// 购买资产响应类型
interface PurchaseAssetResponse {
  id: string
  voucher_no?: string
}

export function FixedAssetPurchase() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const { hasPermission, isFinance: checkIsFinance } = usePermissions()
  const isFinance = checkIsFinance()

  // Business data hooks
  const { data: currencies = [] } = useCurrencies()
  const { data: departments = [] } = useDepartments()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useExpenseCategories()
  const { data: sitesData = [] } = useSites()
  const { data: vendorsData = [] } = useVendors()
  const { data: assets = [], isLoading } = useFixedAssets({ status: 'in_use' })
  const { mutateAsync: purchaseAsset } = useFixedAssetPurchase()

  // Transform data format (useSites 和 useVendors 已经返回了正确的格式)
  // 确保所有数据都是数组
  const sites = Array.isArray(sitesData) ? sitesData : []
  const vendors = Array.isArray(vendorsData) ? vendorsData : []
  const safeCurrencies = Array.isArray(currencies) ? currencies : []
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  const safeCategories = Array.isArray(categories) ? categories : []
  const safeDepartments = Array.isArray(departments) ? departments : []


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
      form.setFieldValue('voucherUrl', url)
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

  const handleSubmit = withErrorHandler(
    async () => {
      const v = await form.validateFields()
      const payload = {
        ...v,
        purchasePriceCents: Math.round((v.purchasePriceCents || 0) * 100),
        purchaseDate: v.purchaseDate ? v.purchaseDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      }

      const result = await purchaseAsset(payload) as PurchaseAssetResponse
      setOpen(false)
      form.resetFields()
      setVoucherFile(null)
      setFileList([])
      return `资产买入成功，凭证号：${result.voucher_no}`
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '买入失败'
    }
  )

  return (
    <PageContainer
      title="资产买入"
      breadcrumb={[{ title: '资产管理' }, { title: '资产买入' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 16 }}>
          {isFinance && (
            <Button type="primary" onClick={() => { setOpen(true); form.resetFields(); setVoucherFile(null); setFileList([]) }}>
              买入资产
            </Button>
          )}
        </Space>

        <DataTable<FixedAsset>
          columns={[
            { title: '资产编号', dataIndex: 'assetCode', key: 'assetCode', width: 120 },
            { title: '资产名称', dataIndex: 'name', key: 'name', width: 200 },
            { title: '类别', dataIndex: 'category', key: 'category', width: 100 },
            {
              title: '购买价格',
              key: 'purchasePrice',
              width: 120,
              render: (_: unknown, r: FixedAsset) => {
                const price = r.purchasePriceCents ? formatAmount(r.purchasePriceCents) : '0.00'
                return `${price} ${r.currency || ''}`
              }
            },
            { title: '购买日期', dataIndex: 'purchaseDate', key: 'purchaseDate', width: 120 },
            { title: '项目', dataIndex: 'departmentName', key: 'departmentName', width: 120 },
            { title: '位置', dataIndex: 'siteName', key: 'siteName', width: 120 },
            { title: '责任人', dataIndex: 'custodian', key: 'custodian', width: 100 },
          ] satisfies DataTableColumn<FixedAsset>[]}
          data={assets}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 900 } }}
        />

        <Modal
          title="买入资产"
          open={open}
          onCancel={() => { setOpen(false); form.resetFields(); setVoucherFile(null); setFileList([]) }}
          onOk={handleSubmit}
          width={800}
        >
          <Form form={form} layout="vertical" initialValues={{ currency: 'CNY' }}>
            <Form.Item name="assetCode" label="资产编号" rules={[{ required: true, message: '请输入资产编号' }]}>
              <Input placeholder="唯一标识，如：FA001" />
            </Form.Item>
            <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="资产类别">
              <Select options={CATEGORY_OPTIONS} placeholder="选择类别" allowClear showSearch />
            </Form.Item>
            <Form.Item name="purchaseDate" label="购买日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="purchasePriceCents" label="购买价格" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入购买价格" />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
              <Select options={safeCurrencies} showSearch optionFilterProp="label" placeholder="选择币种" />
            </Form.Item>
            <Form.Item name="accountId" label="支出账户" rules={[{ required: true }]}>
              <Select
                options={safeAccounts as AccountOption[]}
                showSearch
                optionFilterProp="label"
                placeholder="选择账户"
                onChange={(value) => {
                  const account = (safeAccounts as AccountOption[]).find((a) => a.value === value)
                  if (account?.currency) {
                    form.setFieldsValue({ currency: account.currency })
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="categoryId" label="支出类别" rules={[{ required: true }]}>
              <Select options={safeCategories} showSearch optionFilterProp="label" placeholder="选择类别" />
            </Form.Item>
            <Form.Item name="vendorId" label="供应商">
              <Select options={vendors} showSearch optionFilterProp="label" placeholder="选择供应商" allowClear />
            </Form.Item>
            <Form.Item name="departmentId" label="使用项目">
              <Select options={safeDepartments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
            </Form.Item>
            <Form.Item name="siteId" label="资产位置">
              <Select options={sites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
            </Form.Item>
            <Form.Item name="custodian" label="责任人">
              <Input placeholder="使用人/责任人姓名" />
            </Form.Item>
            <Form.Item name="depreciation_method" label="折旧方法">
              <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="useful_life_years" label="预计使用年限（年）">
              <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="年" />
            </Form.Item>
            <Form.Item name="voucherUrl" label="购买凭证">
              <Upload
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={() => {
                  setVoucherFile(null)
                  setFileList([])
                  form.setFieldsValue({ voucherUrl: undefined })
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
        </Modal>
      </Card>
    </PageContainer>
  )
}

