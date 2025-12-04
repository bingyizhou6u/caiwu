import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Upload, Card, Alert } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { Dayjs } from 'dayjs'
import { api } from '../../../config/api'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { useAccountTransfers, useCreateAccountTransfer } from '../../../hooks'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createAccountTransferSchema } from '../../../validations/accountTransfer.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { AccountTransfer as AccountTransferType } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'

export function AccountTransfer() {
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  const { form, validateWithZod } = useZodForm(createAccountTransferSchema)

  const [uploading, setUploading] = useState(false)
  const [voucherUrls, setVoucherUrls] = useState<string[]>([])
  const [fromAccount, setFromAccount] = useState<string>()
  const [toAccount, setToAccount] = useState<string>()
  const [fromAmount, setFromAmount] = useState<number>()
  const [exchangeRate, setExchangeRate] = useState<number>()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  // Data Hooks
  const { data: accounts = [] } = useAccounts()
  const { data: transfers = [], isLoading: loading, refetch: load } = useAccountTransfers(
    dateRange ? [dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')] : undefined
  )
  const { mutateAsync: createTransfer, isPending: isCreating } = useCreateAccountTransfer()

  // Handlers
  const handleSubmit = withErrorHandler(
    async () => {
      if (!voucherUrls || voucherUrls.length === 0) {
        message.error('请上传转账凭证')
        return
      }

      const values = await validateWithZod()

      await createTransfer({
        transfer_date: values.transfer_date.format('YYYY-MM-DD'),
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        from_amount_cents: Math.round(values.from_amount * 100),
        to_amount_cents: Math.round(values.to_amount * 100),
        exchange_rate: values.exchange_rate,
        memo: values.memo,
        voucher_url: voucherUrls[0] // Use first voucher as per original logic
      })

      setOpen(false)
      form.resetFields()
      setVoucherUrls([])
      setFromAccount(undefined)
      setToAccount(undefined)
      setFromAmount(undefined)
      setExchangeRate(undefined)
      load()
    },
    { successMessage: '转账成功' }
  )

  const handleUpload = async (file: File) => {
    if (!isSupportedImageType(file)) {
      message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
      return false
    }

    setUploading(true)
    try {
      const url = await uploadImageAsWebP(file, api.upload.voucher)
      setVoucherUrls([...voucherUrls, url])
      message.success('凭证上传成功')
      setUploading(false)
      return false
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
      setUploading(false)
      return false
    }
  }

  const fromAccountInfo = accounts.find((a: any) => a.value === fromAccount)
  const toAccountInfo = accounts.find((a: any) => a.value === toAccount)
  const isSameCurrency = fromAccountInfo?.currency === toAccountInfo?.currency

  // Calculate to_amount
  useEffect(() => {
    if (fromAmount && exchangeRate) {
      const calculated = Math.round(fromAmount * exchangeRate * 100) / 100
      form.setFieldsValue({ to_amount: calculated })
    } else if (isSameCurrency && fromAmount) {
      form.setFieldsValue({ to_amount: fromAmount })
      setExchangeRate(1)
    }
  }, [fromAmount, exchangeRate, isSameCurrency, form])

  return (
    <PageContainer
      title="账户转账"
      breadcrumb={[{ title: '财务管理' }, { title: '账户转账' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => setOpen(true)}>新建转账</Button>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          <Button onClick={() => load()}>刷新</Button>
        </Space>

        <Table
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={transfers}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '转账日期', dataIndex: 'transfer_date', width: 110 },
            {
              title: '转出账户',
              width: 150,
              render: (_: any, r: AccountTransferType) => (
                <div>
                  <div>{r.from_account_name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{r.from_account_currency}</div>
                </div>
              )
            },
            {
              title: '转出金额',
              dataIndex: 'from_amount_cents',
              width: 120,
              align: 'right',
              render: (v: number) => (v / 100).toFixed(2)
            },
            {
              title: '转入账户',
              width: 150,
              render: (_: any, r: AccountTransferType) => (
                <div>
                  <div>{r.to_account_name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{r.to_account_currency}</div>
                </div>
              )
            },
            {
              title: '转入金额',
              dataIndex: 'to_amount_cents',
              width: 120,
              align: 'right',
              render: (v: number) => (v / 100).toFixed(2)
            },
            {
              title: '汇率',
              dataIndex: 'exchange_rate',
              width: 100,
              align: 'right',
              render: (v: number) => v ? v.toFixed(6) : '-'
            },
            { title: '备注', dataIndex: 'memo', ellipsis: true },
            {
              title: '凭证',
              dataIndex: 'voucher_url',
              width: 100,
              render: (v: string) => v ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => {
                  setPreviewUrl(v)
                  setPreviewOpen(true)
                }}>查看</Button>
              ) : '-'
            },
          ]}
        />

        <Modal
          title="新建转账"
          open={open}
          confirmLoading={isCreating}
          onCancel={() => {
            setOpen(false)
            form.resetFields()
            setVoucherUrls([])
            setFromAccount(undefined)
            setToAccount(undefined)
            setFromAmount(undefined)
            setExchangeRate(undefined)
          }}
          onOk={handleSubmit}
          width={800}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="transfer_date" label="转账日期" rules={[{ required: true, message: '请选择转账日期' }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item name="from_account_id" label="转出账户" rules={[{ required: true, message: '请选择转出账户' }]}>
              <Select
                style={{ width: '100%' }}
                options={accounts}
                placeholder="选择转出账户"
                onChange={(v) => {
                  setFromAccount(v)
                  form.setFieldsValue({ exchange_rate: undefined, to_amount: undefined })
                }}
              />
            </Form.Item>

            <Form.Item name="to_account_id" label="转入账户" rules={[{ required: true, message: '请选择转入账户' }]}>
              <Select
                style={{ width: '100%' }}
                options={accounts.filter((a: any) => a.value !== fromAccount)}
                placeholder="选择转入账户"
                onChange={(v) => {
                  setToAccount(v)
                  form.setFieldsValue({ exchange_rate: undefined, to_amount: undefined })
                }}
              />
            </Form.Item>

            {isSameCurrency && (
              <Alert
                message="同币种转账，转出金额和转入金额必须相等"
                type="info"
                style={{ marginBottom: 16 }}
              />
            )}

            {!isSameCurrency && (
              <Alert
                message="不同币种转账，需要提供实时汇率"
                type="warning"
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item name="from_amount" label={`转出金额${fromAccountInfo ? ` (${fromAccountInfo.currency})` : ''}`} rules={[{ required: true, message: '请输入转出金额' }]}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入转出金额"
                onChange={(v) => {
                  setFromAmount(v || undefined)
                  if (isSameCurrency) {
                    form.setFieldsValue({ to_amount: v })
                  }
                }}
              />
            </Form.Item>

            {!isSameCurrency && (
              <Form.Item
                name="exchange_rate"
                label={`汇率 (1 ${fromAccountInfo?.currency} = ? ${toAccountInfo?.currency})`}
                rules={[{ required: true, message: '请输入汇率' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={6}
                  placeholder="请输入汇率"
                  onChange={(v) => {
                    setExchangeRate(v || undefined)
                    if (fromAmount && v) {
                      form.setFieldsValue({ to_amount: Math.round(fromAmount * v * 100) / 100 })
                    }
                  }}
                />
              </Form.Item>
            )}

            <Form.Item name="to_amount" label={`转入金额${toAccountInfo ? ` (${toAccountInfo.currency})` : ''}`} rules={[{ required: true, message: '请输入转入金额' }]}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入转入金额"
                readOnly={isSameCurrency}
              />
            </Form.Item>

            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>

            <Form.Item label="转账凭证" required>
              <Upload
                beforeUpload={handleUpload}
                fileList={voucherUrls.map((url, index) => ({
                  uid: String(index),
                  name: `凭证${index + 1}`,
                  status: 'done',
                  url: api.vouchers(url.replace('/api/vouchers/', ''))
                })) as UploadFile[]}
                onRemove={(file) => {
                  const index = voucherUrls.findIndex((_, i) => String(i) === file.uid)
                  if (index !== -1) {
                    setVoucherUrls(voucherUrls.filter((_, i) => i !== index))
                  }
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>上传凭证</Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
