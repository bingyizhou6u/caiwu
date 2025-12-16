import { useState, useMemo } from 'react'
import { Card, Button, Form, Input, Select, Space, message, DatePicker, InputNumber, Upload, Tag } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../../../config/api'
import dayjs from 'dayjs'
import { formatAmount } from '../../../utils/formatters'
import { useAccounts, useIncomeCategories } from '../../../hooks/useBusinessData'
import { useFixedAssets, useFixedAssetSale } from '../../../hooks'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { SearchFilters } from '../../../components/common/SearchFilters'

const { TextArea } = Input

const STATUS_OPTIONS = [
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'maintenance', label: '维修中' },
]

import { PageContainer } from '../../../components/PageContainer'
import { DataTable } from '../../../components/common/DataTable'

export function FixedAssetSale() {
  const [open, setOpen] = useState(false)
  const [currentAsset, setCurrentAsset] = useState<FixedAsset | null>(null)
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [searchParams, setSearchParams] = useState<{ search?: string; status?: string }>({})

  // Business data hooks
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useIncomeCategories()
  const { data: allAssets = [], isLoading } = useFixedAssets({ 
    status: searchParams.status,
    search: searchParams.search || undefined
  })
  const { mutateAsync: saleAsset } = useFixedAssetSale()

  // Filter assets
  const data = useMemo(() => {
    return allAssets.filter((a: FixedAsset) => a.status !== 'sold' && a.status !== 'scrapped')
  }, [allAssets])

  const handleSale = (asset: FixedAsset) => {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
      setUploading(false)
      return false
    }
  }

  const handleSubmit = withErrorHandler(
    async () => {
      if (!currentAsset) return

      const v = await form.validateFields()

      // 验证账户币种匹配
      const account = accounts.find((a: SelectOption & { currency?: string }) => a.value === v.accountId)
      if (account?.currency !== currentAsset.currency) {
        throw new Error(`账户币种（${account?.currency}）与资产币种（currentAsset.currency}）不匹配`)
      }

      const payload = {
        ...v,
        sale_price_cents: Math.round((v.sale_price_cents || 0) * 100),
        sale_date: v.sale_date ? v.sale_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      }

      const result = await saleAsset({ id: currentAsset.id, data: payload })
      setOpen(false)
      setCurrentAsset(null)
      form.resetFields()
      setVoucherFile(null)
      setFileList([])
      return `资产卖出成功，凭证号：${result.voucher_no}`
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '卖出失败'
    }
  )

  return (
    <PageContainer
      title="资产卖出"
      breadcrumb={[{ title: '资产管理' }, { title: '资产卖出' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'search', label: '搜索', type: 'input', placeholder: '搜索资产编号、名称' },
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

        <DataTable<any>
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
            {
              title: '当前净值',
              key: 'currentValue',
              width: 120,
              render: (_: unknown, r: FixedAsset) => {
                const value = r.currentValueCents ? formatAmount(r.currentValueCents) : '0.00'
                return `${value} ${r.currency || ''}`
              }
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
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
          ] as DataTableColumn<FixedAsset>[]}
          data={data}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 900 } }}
          actions={(r: FixedAsset) => (
            <Button size="small" type="primary" onClick={() => handleSale(r)} disabled={r.status === 'sold'}>
              卖出
            </Button>
          )}
        />

        {currentAsset && (
          <FormModal
            title={`卖出资产：${currentAsset.name}`}
            open={open}
            form={form}
            onSubmit={handleSubmit}
            onCancel={() => { setOpen(false); setCurrentAsset(null); form.resetFields(); setVoucherFile(null); setFileList([]) }}
            width={800}
          >
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
          </FormModal>
        )}
      </Card>
    </PageContainer>
  )
}

