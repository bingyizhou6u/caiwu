import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../config/api'
import dayjs from 'dayjs'
import { formatAmount } from '../utils/formatters'
import { loadCurrencies, loadDepartments, loadAccounts, loadExpenseCategories } from '../utils/loaders'
import { apiGet } from '../utils/api'

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

export function FixedAssetPurchase({ userRole }: { userRole?: string }) {
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
  const isFinance = userRole === 'finance' || userRole === 'manager'

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${api.fixedAssets}?status=in_use`, { credentials: 'include' })
      const j = await res.json()
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
        apiGet(api.sites).then(results => results.filter((r: any) => r.active === 1).map((r: any) => ({ value: r.id, label: r.name }))),
        apiGet(api.vendors).then(results => results.map((r: any) => ({ value: r.id, label: r.name })))
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
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
        setUploading(false)
        return false
      }
      
      let fileToUpload: File | Blob = file
      
      if (file.type !== 'image/webp') {
        const img = new Image()
        const imageUrl = URL.createObjectURL(file)
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })
        
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          message.error('无法创建Canvas上下文')
          setUploading(false)
          URL.revokeObjectURL(imageUrl)
          return false
        }
        
        ctx.drawImage(img, 0, 0)
        
        const webpBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('转换失败'))
            }
          }, 'image/webp', 0.85)
        })
        
        fileToUpload = new File([webpBlob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
        URL.revokeObjectURL(imageUrl)
      }
      
      const formData = new FormData()
      formData.append('file', fileToUpload)
      
      const res = await fetch(api.upload.voucher, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      
      const data = await res.json()
      if (!res.ok) {
        message.error(data.error || '上传失败')
        setUploading(false)
        return false
      }
      
      setVoucherFile(fileToUpload as File)
      form.setFieldValue('voucher_url', data.url)
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
      purchase_price_cents: Math.round((v.purchase_price_cents || 0) * 100),
      purchase_date: v.purchase_date ? v.purchase_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }
    
    try {
      const res = await fetch(api.fixedAssetsPurchase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '买入失败')
        return
      }
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
    <Card title="资产买入">
      <Space style={{ marginBottom: 16 }}>
        {isFinance && (
          <Button type="primary" onClick={() => { setOpen(true); form.resetFields(); setVoucherFile(null); setFileList([]) }}>
            买入资产
          </Button>
        )}
        <Button onClick={load}>刷新</Button>
      </Space>
      
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={[
          { title: '资产编号', dataIndex: 'asset_code', width: 120 },
          { title: '资产名称', dataIndex: 'name', width: 200 },
          { title: '类别', dataIndex: 'category', width: 100 },
          {
            title: '购买价格',
            width: 120,
            render: (_: any, r: any) => {
              const price = r.purchase_price_cents ? formatAmount(r.purchase_price_cents) : '0.00'
              return `${price} ${r.currency || ''}`
            }
          },
          { title: '购买日期', dataIndex: 'purchase_date', width: 120 },
          { title: '项目', dataIndex: 'department_name', width: 120 },
          { title: '位置', dataIndex: 'site_name', width: 120 },
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
          <Form.Item name="asset_code" label="资产编号" rules={[{ required: true, message: '请输入资产编号' }]}>
            <Input placeholder="唯一标识，如：FA001" />
          </Form.Item>
          <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="资产类别">
            <Select options={CATEGORY_OPTIONS} placeholder="选择类别" allowClear showSearch />
          </Form.Item>
          <Form.Item name="purchase_date" label="购买日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="purchase_price_cents" label="购买价格" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入购买价格" />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
          </Form.Item>
          <Form.Item name="account_id" label="支出账户" rules={[{ required: true }]}>
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
          <Form.Item name="category_id" label="支出类别" rules={[{ required: true }]}>
            <Select options={categories} showSearch optionFilterProp="label" placeholder="选择类别" />
          </Form.Item>
          <Form.Item name="vendor_id" label="供应商">
            <Select options={vendors} showSearch optionFilterProp="label" placeholder="选择供应商" allowClear />
          </Form.Item>
          <Form.Item name="department_id" label="使用项目">
            <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
          </Form.Item>
          <Form.Item name="site_id" label="资产位置">
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
          <Form.Item name="voucher_url" label="购买凭证">
            <Upload
              fileList={fileList}
              beforeUpload={handleUpload}
              onRemove={() => {
                setVoucherFile(null)
                setFileList([])
                form.setFieldsValue({ voucher_url: undefined })
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
  )
}

