import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'
import { formatAmount } from '../../../utils/formatters'
import { loadCurrencies, loadDepartments, loadAccounts, loadExpenseCategories } from '../../../utils/loaders'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { usePermissions } from '../../../utils/permissions'

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

export function FixedAssetPurchase() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [currencies, setCurrencies] = useState<{ value: string, label: string }[]>([])
  const [departments, setDepartments] = useState<{ value: string, label: string }[]>([])
  const [sites, setSites] = useState<{ value: string, label: string }[]>([])
  const [vendors, setVendors] = useState<{ value: string, label: string }[]>([])
  const [accounts, setAccounts] = useState<{ value: string, label: string, currency?: string }[]>([])
  const [categories, setCategories] = useState<{ value: string, label: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const { hasPermission, isFinance: checkIsFinance } = usePermissions()
  const isFinance = checkIsFinance()

  const load = async () => {
    setLoading(true)
    try {
      const j = await apiClient.get<any>(`${api.fixedAssets}?status=in_use`)
      setData(j.results ?? [])
    } catch (error: any) {
      message.error(`查询失败: ${error.message || '网络错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadMasterData = async () => {
    try {
      const [currenciesData, departmentsData, accountsData, categoriesData, sitesData, vendorsData] = await Promise.all([
        loadCurrencies(),
        loadDepartments(),
        loadAccounts(),
        loadExpenseCategories(),
        apiClient.get<any[]>(api.sites).then(results => results.filter((r: any) => r.active === 1).map((r: any) => ({ value: r.id, label: r.name }))),
        apiClient.get<any[]>(api.vendors).then(results => results.map((r: any) => ({ value: r.id, label: r.name })))
      ])
      setCurrencies(currenciesData)
      setDepartments(departmentsData)
      setAccounts(accountsData)
      setCategories(categoriesData)
      setSites(sitesData)
      setVendors(vendorsData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    load()
    loadMasterData()
  }, [])

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
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
      setUploading(false)
      return false
    }
  }

  const handleSubmit = async () => {
    const v = await form.validateFields()
    const payload = {
      ...v,
      purchasePriceCents: Math.round((v.purchasePriceCents || 0) * 100),
      purchaseDate: v.purchaseDate ? v.purchaseDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }

    try {
      const result = await apiClient.post<any>(api.fixedAssetsPurchase, payload)
      message.success(`资产买入成功，凭证号：${result.voucher_no}`)
      setOpen(false)
      form.resetFields()
      setVoucherFile(null)
      setFileList([])
      load()
    } catch (error: any) {
      message.error('买入失败：' + (error.message || '网络错误'))
    }
  }

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
          <Button onClick={load}>刷新</Button>
        </Space>

        <Table
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: '资产编号', dataIndex: 'assetCode', width: 120 },
            { title: '资产名称', dataIndex: 'name', width: 200 },
            { title: '类别', dataIndex: 'category', width: 100 },
            {
              title: '购买价格',
              width: 120,
              render: (_: any, r: any) => {
                const price = r.purchasePriceCents ? formatAmount(r.purchasePriceCents) : '0.00'
                return `${price} ${r.currency || ''}`
              }
            },
            { title: '购买日期', dataIndex: 'purchaseDate', width: 120 },
            { title: '项目', dataIndex: 'departmentName', width: 120 },
            { title: '位置', dataIndex: 'siteName', width: 120 },
            { title: '责任人', dataIndex: 'custodian', width: 100 },
          ]}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20 }}
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
              <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
            </Form.Item>
            <Form.Item name="accountId" label="支出账户" rules={[{ required: true }]}>
              <Select
                options={accounts}
                showSearch
                optionFilterProp="label"
                placeholder="选择账户"
                onChange={(value) => {
                  const account = accounts.find(a => a.value === value)
                  if (account?.currency) {
                    form.setFieldsValue({ currency: account.currency })
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="categoryId" label="支出类别" rules={[{ required: true }]}>
              <Select options={categories} showSearch optionFilterProp="label" placeholder="选择类别" />
            </Form.Item>
            <Form.Item name="vendorId" label="供应商">
              <Select options={vendors} showSearch optionFilterProp="label" placeholder="选择供应商" allowClear />
            </Form.Item>
            <Form.Item name="departmentId" label="使用项目">
              <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
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

