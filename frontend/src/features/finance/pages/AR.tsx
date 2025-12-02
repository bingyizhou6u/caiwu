import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Descriptions, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { useApiQuery, useApiMutation } from '../../../utils/useApiQuery'
import { useAccounts, useIncomeCategories, useSites } from '../../../hooks/useBusinessData'
import { ARAP } from '../../../types/business'

export function AR() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [settleForm] = Form.useForm()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmForm] = Form.useForm()
  const [confirmingDoc, setConfirmingDoc] = useState<any | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrl, setVoucherUrl] = useState<string | undefined>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  // 加载基础数据
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useIncomeCategories()
  const { data: sites = [] } = useSites()

  // 加载应收列表
  const { data: docs = [], isPending: loading, refetch: load } = useApiQuery<ARAP[]>(
    ['ar-docs'],
    `${api.ar.docs}?kind=AR`,
    {
      select: (data: any) => data.results ?? []
    }
  )

  // 加载流水列表（用于核销）
  const { data: flows = [] } = useApiQuery<{ value: string, label: string }[]>(
    ['flows'],
    api.flows,
    {
      select: (data: any) => (data.results ?? []).map((r: any) => ({
        value: r.id,
        label: `${r.biz_date} ${r.voucher_no ?? ''} ${(r.amount_cents / 100).toFixed(2)} ${r.type}`
      }))
    }
  )

  // 创建应收 Mutation
  const createMutation = useApiMutation(
    () => {
      message.success('已新增')
      setOpen(false)
      form.resetFields()
      load()
    }
  )

  // 确认应收 Mutation
  const confirmMutation = useApiMutation(
    () => {
      message.success('已确认并生成收入记录')
      setConfirmOpen(false)
      setConfirmingDoc(null)
      setFileList([])
      setVoucherUrl(undefined)
      load()
    }
  )

  // 核销 Mutation
  const settleMutation = useApiMutation(
    async () => {
      message.success('已核销')
      // 刷新对账单详情
      if (detail?.doc?.id) {
        const j = await apiClient.get(`${api.ar.statement}?doc_id=${detail.doc.id}`)
        setDetail(j)
      }
      settleForm.resetFields()
      load()
    }
  )

  const createDoc = async () => {
    try {
      const v = await form.validateFields()
      createMutation.mutate({
        url: api.ar.docs,
        method: 'POST',
        body: {
          kind: 'AR',
          site_id: v.site_id,
          issue_date: v.issue_date.format('YYYY-MM-DD'),
          due_date: v.due_date?.format('YYYY-MM-DD'),
          amount_cents: Math.round(Number(v.amount) * 100),
          memo: v.memo
        }
      })
    } catch (e) { }
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
      setVoucherUrl(url)
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

  return (
    <Card title="应收">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>新建应收</Button>
        <Button onClick={() => load()}>刷新</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={docs} columns={[
        { title: '单号', dataIndex: 'doc_no' },
        { title: '客户（站点）', dataIndex: 'site_name', render: (v: string) => v || '-' },
        { title: '开立日期', dataIndex: 'issue_date' },
        { title: '到期日', dataIndex: 'due_date' },
        { title: '金额', dataIndex: 'amount_cents', render: (v: number) => (v / 100).toFixed(2) },
        { title: '已结', dataIndex: 'settled_cents', render: (v: number) => (v / 100).toFixed(2) },
        { title: '状态', dataIndex: 'status' },
        {
          title: '操作', render: (_: any, r: any) => <Space>
            {r.status === 'open' && (
              <Button size="small" type="primary" onClick={() => {
                setConfirmingDoc(r)
                setConfirmOpen(true)
                confirmForm.resetFields()
                setFileList([])
                setVoucherUrl(undefined)
                confirmForm.setFieldsValue({ biz_date: dayjs(r.issue_date) })
              }}>确认</Button>
            )}
            <Button size="small" onClick={async () => {
              const j = await apiClient.get(`${api.ar.statement}?doc_id=${r.id}`)
              setDetail(j)
              setDetailOpen(true)
            }}>对账单</Button>
          </Space>
        }
      ]} />

      <Modal title="新建应收" open={open} onOk={createDoc} confirmLoading={createMutation.isPending} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ issue_date: dayjs() }}>
          <Form.Item name="site_id" label="客户（站点）" rules={[{ required: true, message: '请选择站点' }]}>
            <Select options={sites} placeholder="选择站点" showSearch />
          </Form.Item>
          <Form.Item name="issue_date" label="开立日期" rules={[{ required: true }]}>
            <DatePicker />
          </Form.Item>
          <Form.Item name="due_date" label="到期日">
            <DatePicker />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal width={720} title="对账单/核销" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} destroyOnClose>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="单号">{detail.doc?.doc_no}</Descriptions.Item>
              <Descriptions.Item label="状态">{detail.doc?.status}</Descriptions.Item>
              <Descriptions.Item label="开立">{detail.doc?.issue_date}</Descriptions.Item>
              <Descriptions.Item label="到期">{detail.doc?.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="金额">{(detail.doc?.amount_cents / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="已结">{(detail.settled_cents / 100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="未结" span={2}>{(detail.remaining_cents / 100).toFixed(2)}</Descriptions.Item>
            </Descriptions>
            <div style={{ height: 8 }} />
            <Table rowKey="id" size="small" dataSource={detail.settlements} pagination={false} columns={[
              { title: '日期', dataIndex: 'settle_date' },
              { title: '流水ID', dataIndex: 'flow_id', render: (v: string) => v ? v.slice(0, 8) + '...' : '-' },
              { title: '核销金额', dataIndex: 'settle_amount_cents', render: (v: number) => (v / 100).toFixed(2) },
            ]} />
            <div style={{ height: 12 }} />
            <Form layout="inline" form={settleForm}>
              <Form.Item name="flow_id" rules={[{ required: true }]}>
                <Select style={{ width: 360 }} options={flows} placeholder="选择对应的收款流水" />
              </Form.Item>
              <Form.Item name="settle_amount" rules={[{ required: true }]}>
                <InputNumber min={0.01} step={0.01} placeholder="核销金额" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" loading={settleMutation.isPending} onClick={async () => {
                    try {
                      const v = await settleForm.validateFields()
                      settleMutation.mutate({
                        url: api.ar.settlements,
                        method: 'POST',
                        body: {
                          doc_id: detail.doc.id,
                          flow_id: v.flow_id,
                          settle_amount_cents: Math.round(Number(v.settle_amount) * 100)
                        }
                      })
                    } catch (e) { }
                  }}>登记核销</Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal title="确认应收" open={confirmOpen} onCancel={() => {
        setConfirmOpen(false)
        setConfirmingDoc(null)
        setFileList([])
        setVoucherUrl(undefined)
      }} footer={null} destroyOnClose>
        {confirmingDoc && (
          <Form form={confirmForm} layout="vertical" onFinish={async () => {
            if (!voucherUrl) {
              message.error('请先上传凭证')
              return
            }
            try {
              const v = await confirmForm.validateFields()
              confirmMutation.mutate({
                url: api.ar.confirm,
                method: 'POST',
                body: {
                  doc_id: confirmingDoc.id,
                  account_id: v.account_id,
                  category_id: v.category_id,
                  biz_date: v.biz_date.format('YYYY-MM-DD'),
                  memo: v.memo,
                  voucher_url: voucherUrl
                }
              })
            } catch (e) { }
          }}>
            <Form.Item label="金额">{(confirmingDoc.amount_cents / 100).toFixed(2)}</Form.Item>
            <Form.Item name="account_id" label="账户" rules={[{ required: true }]}>
              <Select options={accounts} placeholder="选择账户" showSearch />
            </Form.Item>
            <Form.Item name="category_id" label="类别" rules={[{ required: true }]}>
              <Select options={categories} placeholder="选择类别" />
            </Form.Item>
            <Form.Item name="biz_date" label="业务日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="凭证" required>
              <Upload
                fileList={fileList}
                beforeUpload={(file) => {
                  handleUpload(file)
                  return false
                }}
                onRemove={() => {
                  setFileList([])
                  setVoucherUrl(undefined)
                }}
                accept="image/*"
                maxCount={1}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>上传凭证</Button>
              </Upload>
              {voucherUrl && <div style={{ marginTop: 8, color: '#52c41a' }}>✓ 凭证已上传</div>}
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={confirmMutation.isPending}>确认</Button>
                <Button onClick={() => {
                  setConfirmOpen(false)
                  setConfirmingDoc(null)
                  setFileList([])
                  setVoucherUrl(undefined)
                }}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
        {previewUrl && (
          <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
        )}
      </Modal>
    </Card>
  )
}
