import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload, Tag } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'
import { formatAmount } from '../../../utils/formatters'
import { loadAccounts, loadIncomeCategories } from '../../../utils/loaders'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'

const { TextArea } = Input

const STATUS_OPTIONS = [
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'maintenance', label: '维修中' },
]

import { PageContainer } from '../../../components/PageContainer'

export function FixedAssetSale() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [currentAsset, setCurrentAsset] = useState<any>(null)
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<{ value: string, label: string, currency?: string }[]>([])
  const [categories, setCategories] = useState<{ value: string, label: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (search) params.append('search', search)

      const j = await apiClient.get<any>(`${api.fixedAssets}?${params.toString()}`)
      setData(j.results ?? [])
    } catch (error: any) {
      message.error(`查询失败: ${error.message || '网络错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadMasterData = async () => {
    try {
      const [accountsData, categoriesData] = await Promise.all([
        loadAccounts(),
        loadIncomeCategories()
      ])
      setAccounts(accountsData)
      setCategories(categoriesData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    load()
    loadMasterData()
  }, [])

  useEffect(() => {
    load()
  }, [statusFilter, search])

  const handleSale = (asset: any) => {
    if (asset.status === 'sold') {
      message.warning('该资产已卖出')
      return
    }
    setCurrentAsset(asset)
    form.resetFields()
    form.setFieldsValue({
      sale_date: dayjs(),
      currency: asset.currency
    })
    setVoucherFile(null)
    setFileList([])

    // 根据资产币种过滤账户
    const filteredAccounts = accounts.filter(a => a.currency === asset.currency)
    if (filteredAccounts.length === 0) {
      message.warning(`没有找到币种为${asset.currency}的账户`)
    }

    setOpen(true)
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
      form.setFieldsValue({ voucherUrl: url })
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
    if (!currentAsset) return

    const v = await form.validateFields()

    // 验证账户币种匹配
    const account = accounts.find(a => a.value === v.accountId)
    if (account?.currency !== currentAsset.currency) {
      message.error(`账户币种（${account?.currency}）与资产币种（${currentAsset.currency}）不匹配`)
      return
    }

    const payload = {
      ...v,
      sale_price_cents: Math.round((v.sale_price_cents || 0) * 100),
      sale_date: v.sale_date ? v.sale_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }

    try {
      const result = await apiClient.post<any>(api.fixedAssetsSale(currentAsset.id), payload)
      message.success(`资产卖出成功，凭证号：${result.voucher_no}`)
      setOpen(false)
      setCurrentAsset(null)
      form.resetFields()
      setVoucherFile(null)
      setFileList([])
      load()
    } catch (error: any) {
      message.error('卖出失败：' + (error.message || '网络错误'))
    }
  }

  return (
    <PageContainer
      title="资产卖出"
      breadcrumb={[{ title: '资产管理' }, { title: '资产卖出' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 16 }} wrap>
          <Button onClick={load}>刷新</Button>
          <Input.Search
            placeholder="搜索资产编号、名称"
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={load}
            allowClear
          />
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
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={data.filter(a => a.status !== 'sold' && a.status !== 'scrapped')}
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
            {
              title: '当前净值',
              width: 120,
              render: (_: any, r: any) => {
                const value = r.currentValueCents ? formatAmount(r.currentValueCents) : '0.00'
                return `${value} ${r.currency || ''}`
              }
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (v: string) => {
                const option = STATUS_OPTIONS.find(o => o.value === v)
                const colors: Record<string, string> = {
                  in_use: 'green',
                  idle: 'orange',
                  maintenance: 'blue',
                }
                return <Tag color={colors[v] || 'default'}>{option?.label || v}</Tag>
              }
            },
            {
              title: '操作',
              width: 100,
              render: (_: any, r: any) => (
                <Button size="small" type="primary" onClick={() => handleSale(r)} disabled={r.status === 'sold'}>
                  卖出
                </Button>
              )
            },
          ]}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20 }}
        />

        <Modal
          title={`卖出资产：${currentAsset?.name || ''}`}
          open={open}
          onCancel={() => { setOpen(false); setCurrentAsset(null); form.resetFields(); setVoucherFile(null); setFileList([]) }}
          onOk={handleSubmit}
          width={800}
        >
          {currentAsset && (
            <Form form={form} layout="vertical">
              <Form.Item label="资产信息">
                <div>
                  <p>资产编号：{currentAsset.assetCode}</p>
                  <p>资产名称：{currentAsset.name}</p>
                  <p>购买价格：{formatAmount(currentAsset.purchasePriceCents)} {currentAsset.currency}</p>
                  <p>当前净值：{formatAmount(currentAsset.currentValueCents)} {currentAsset.currency}</p>
                </div>
              </Form.Item>
              <Form.Item name="sale_date" label="卖出日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="sale_price_cents" label="卖出价格" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入卖出价格" />
              </Form.Item>
              <Form.Item name="accountId" label="收入账户" rules={[{ required: true }]}>
                <Select
                  options={accounts.filter(a => a.currency === currentAsset.currency)}
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择账户"
                />
              </Form.Item>
              <Form.Item name="categoryId" label="收入类别" rules={[{ required: true }]}>
                <Select options={categories} showSearch optionFilterProp="label" placeholder="选择类别" />
              </Form.Item>
              <Form.Item name="sale_buyer" label="买方信息">
                <Input placeholder="买方姓名或公司名称" />
              </Form.Item>
              <Form.Item name="voucherUrl" label="卖出凭证">
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
              <Form.Item name="sale_memo" label="备注">
                <TextArea rows={3} placeholder="备注信息" />
              </Form.Item>
            </Form>
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}

