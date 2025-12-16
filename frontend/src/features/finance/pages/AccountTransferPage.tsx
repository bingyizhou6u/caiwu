import { useEffect, useState } from 'react'
import { Button, Form, Input, DatePicker, InputNumber, Select, Space, message, Upload, Card, Alert } from 'antd'
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
import { FormModal } from '../../../components/FormModal'
import type { AccountTransfer as AccountTransferType } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, PageToolbar, AmountDisplay } from '../../../components/common'

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

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: transfers = [], isLoading: loading, refetch } = useAccountTransfers(
    dateRange ? [dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')] : undefined
  )
  const { mutateAsync: createTransfer, isPending: isCreating } = useCreateAccountTransfer()

  // 处理函数
  const handleSubmit = withErrorHandler(
    async () => {
      if (!voucherUrls || voucherUrls.length === 0) {
        message.error('请上传转账凭证')
        return
      }

      const values = await validateWithZod()
      await createTransfer({
        transferDate: values.transferDate.format('YYYY-MM-DD'),
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        fromAmountCents: Math.round(values.fromAmount * 100),
        toAmountCents: Math.round(values.toAmount * 100),
        exchangeRate: values.exchangeRate,
        memo: values.memo,
        voucherUrl: voucherUrls[0] // 按照原有逻辑使用第一张凭证
      })

      setOpen(false)
      form.resetFields()
      setVoucherUrls([])
      setFromAccount(undefined)
      setToAccount(undefined)
      setFromAmount(undefined)
      setExchangeRate(undefined)
      refetch()
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
      setUploading(false)
      return false
    }
  }

  const fromAccountInfo = accounts.find((a) => a.value === fromAccount)
  const toAccountInfo = accounts.find((a) => a.value === toAccount)
  const isSameCurrency = fromAccountInfo?.currency === toAccountInfo?.currency

  // 计算转入金额
  useEffect(() => {
    if (fromAmount && exchangeRate) {
      const calculated = Math.round(fromAmount * exchangeRate * 100) / 100
      form.setFieldsValue({ toAmount: calculated })
    } else if (isSameCurrency && fromAmount) {
      form.setFieldsValue({ toAmount: fromAmount })
      setExchangeRate(1)
    }
  }, [fromAmount, exchangeRate, isSameCurrency, form])

  return (
    <PageContainer
      title="账户转账"
      breadcrumb={[{ title: '财务管理' }, { title: '账户转账' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            {
              label: '新建转账',
              type: 'primary',
              onClick: () => setOpen(true)
            },
            {
              label: '刷新',
              onClick: () => refetch()
            }
          ]}
          style={{ marginBottom: 16 }}
        >
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </PageToolbar>

        <DataTable<AccountTransferType>
          columns={[
            { title: '转账日期', dataIndex: 'transferDate', key: 'transferDate', width: 110 },
            {
              title: '转出账户',
              key: 'fromAccount',
              width: 150,
              render: (_: unknown, r: AccountTransferType) => (
                <div>
                  <div>{r.fromAccountName}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{r.fromAccountCurrency}</div>
                </div>
              )
            },
            {
              title: '转出金额',
              dataIndex: 'fromAmountCents',
              key: 'fromAmountCents',
              width: 120,
              align: 'right',
              render: (v: number, r: AccountTransferType) => <AmountDisplay cents={v} currency={r.fromAccountCurrency} />
            },
            {
              title: '转入账户',
              key: 'toAccount',
              width: 150,
              render: (_: unknown, r: AccountTransferType) => (
                <div>
                  <div>{r.toAccountName}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{r.toAccountCurrency}</div>
                </div>
              )
            },
            {
              title: '转入金额',
              dataIndex: 'toAmountCents',
              key: 'toAmountCents',
              width: 120,
              align: 'right',
              render: (v: number, r: AccountTransferType) => <AmountDisplay cents={v} currency={r.toAccountCurrency} />
            },
            {
              title: '汇率',
              dataIndex: 'exchangeRate',
              key: 'exchangeRate',
              width: 100,
              align: 'right',
              render: (v: number) => v ? v.toFixed(6) : '-'
            },
            { title: '备注', dataIndex: 'memo', key: 'memo', ellipsis: true },
            {
              title: '凭证',
              dataIndex: 'voucherUrl',
              key: 'voucherUrl',
              width: 100,
              render: (v: string) => v ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => {
                  setPreviewUrl(v)
                  setPreviewOpen(true)
                }}>查看</Button>
              ) : '-'
            },
          ] satisfies DataTableColumn<AccountTransferType>[]}
          data={transfers}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title="新建转账"
          open={open}
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => {
            setOpen(false)
            form.resetFields()
            setVoucherUrls([])
            setFromAccount(undefined)
            setToAccount(undefined)
            setFromAmount(undefined)
            setExchangeRate(undefined)
          }}
          loading={isCreating}
          width={800}
        >
          <Form.Item name="transferDate" label="转账日期" rules={[{ required: true, message: '请选择转账日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="fromAccountId" label="转出账户" rules={[{ required: true, message: '请选择转出账户' }]}>
            <Select
              style={{ width: '100%' }}
              options={Array.isArray(accounts) ? accounts : []}
              placeholder="选择转出账户"
              onChange={(v) => {
                setFromAccount(v)
                form.setFieldsValue({ exchangeRate: undefined, toAmount: undefined })
              }}
            />
          </Form.Item>

          <Form.Item name="toAccountId" label="转入账户" rules={[{ required: true, message: '请选择转入账户' }]}>
            <Select
              style={{ width: '100%' }}
              options={Array.isArray(accounts) ? accounts.filter((a: any) => a.value !== fromAccount) : []}
              placeholder="选择转入账户"
              onChange={(v) => {
                setToAccount(v)
                form.setFieldsValue({ exchangeRate: undefined, toAmount: undefined })
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

          <Form.Item name="fromAmount" label={`转出金额${fromAccountInfo ? ` (${fromAccountInfo.currency})` : ''}`} rules={[{ required: true, message: '请输入转出金额' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入转出金额"
              onChange={(v) => {
                setFromAmount(v || undefined)
                if (isSameCurrency) {
                  form.setFieldsValue({ toAmount: v })
                }
              }}
            />
          </Form.Item>

          {!isSameCurrency && (
            <Form.Item
              name="exchangeRate"
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
                    form.setFieldsValue({ toAmount: Math.round(fromAmount * v * 100) / 100 })
                  }
                }}
              />
            </Form.Item>
          )}

          <Form.Item name="toAmount" label={`转入金额${toAccountInfo ? ` (${toAccountInfo.currency})` : ''}`} rules={[{ required: true, message: '请输入转入金额' }]}>
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
        </FormModal>

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
