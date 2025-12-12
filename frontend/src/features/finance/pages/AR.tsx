import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Descriptions, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { useARDocs, useCreateAR, useConfirmAR, useSettleAR, useARStatement, useSettlementFlowOptions } from '../../../hooks'
import { useAccounts, useIncomeCategories, useSites } from '../../../hooks/useBusinessData'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createARSchema, confirmARSchema, settleARSchema } from '../../../validations/ar.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { ARAP } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'

export function AR() {
  // 模态框
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // 状态
  const [confirmingDoc, setConfirmingDoc] = useState<ARAP | null>(null)
  const [detailDocId, setDetailDocId] = useState<string | undefined>()
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  // 表单
  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 表单
  const createForm = useZodForm(createARSchema)
  const confirmForm = useZodForm(confirmARSchema)
  const settleForm = useZodForm(settleARSchema)

  // 上传状态
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrl, setVoucherUrl] = useState<string | undefined>()

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useIncomeCategories()
  const { data: sites = [] } = useSites()
  const { data: docs = { total: 0, list: [] }, isLoading: loading, refetch: load } = useARDocs(page, pageSize)
  const { data: flows = [] } = useSettlementFlowOptions()
  const { data: detail } = useARStatement(detailDocId)

  // 变更操作
  const { mutateAsync: createAR, isPending: isCreating } = useCreateAR()
  const { mutateAsync: confirmAR, isPending: isConfirming } = useConfirmAR()
  const { mutateAsync: settleAR, isPending: isSettling } = useSettleAR()

  // 处理函数
  const handleCreate = withErrorHandler(
    async () => {
      const values = await createForm.validateWithZod()
      await createAR({
        siteId: values.siteId,
        issueDate: values.issueDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        amountCents: Math.round(values.amount * 100),
        memo: values.memo
      })
      setCreateOpen(false)
      createForm.form.resetFields()
      load()
    },
    { successMessage: '已新增' }
  )

  const handleConfirm = withErrorHandler(
    async () => {
      if (!voucherUrl) {
        message.error('请先上传凭证')
        return
      }
      if (!confirmingDoc) return

      const values = await confirmForm.validateWithZod()
      await confirmAR({
        docId: confirmingDoc.id,
        accountId: values.accountId,
        categoryId: values.categoryId,
        bizDate: values.bizDate.format('YYYY-MM-DD'),
        memo: values.memo,
        voucherUrl: voucherUrl
      })
      setConfirmOpen(false)
      setConfirmingDoc(null)
      setFileList([])
      setVoucherUrl(undefined)
      confirmForm.form.resetFields()
      load()
    },
    { successMessage: '已确认并生成收入记录' }
  )

  const handleSettle = withErrorHandler(
    async () => {
      if (!detailDocId) return
      const values = await settleForm.validateWithZod()
      await settleAR({
        docId: detailDocId,
        flowId: values.flowId,
        settleAmountCents: Math.round(values.settle_amount * 100)
      })
      settleForm.form.resetFields()
      // 注意：useSettleAR 会使 'ar-statement' 失效，因此明细应会自动更新
    },
    { successMessage: '已核销' }
  )

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

  const openConfirmModal = (record: ARAP) => {
    setConfirmingDoc(record)
    setConfirmOpen(true)
    setFileList([])
    setVoucherUrl(undefined)
    confirmForm.form.resetFields()
    confirmForm.form.setFieldsValue({ bizDate: dayjs(record.issueDate) })
  }

  const openDetailModal = (record: ARAP) => {
    setDetailDocId(record.id)
    setDetailOpen(true)
    settleForm.form.resetFields()
  }

  return (
    <PageContainer
      title="应收管理"
      breadcrumb={[{ title: '财务管理' }, { title: '应收管理' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => {
            setCreateOpen(true)
            createForm.form.resetFields()
            createForm.form.setFieldsValue({ issueDate: dayjs() })
          }}>新建应收</Button>
          <Button onClick={() => load()}>刷新</Button>
        </Space>
        <Table
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={docs.list}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: docs.total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          columns={[
            { title: '单号', dataIndex: 'docNo' },
            { title: '客户（站点）', dataIndex: 'siteName', render: (v: string) => v || '-' },
            { title: '开立日期', dataIndex: 'issueDate' },
            { title: '到期日', dataIndex: 'dueDate' },
            { title: '金额', dataIndex: 'amountCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '已结', dataIndex: 'settledCents', render: (v: number) => (v / 100).toFixed(2) },
            { title: '状态', dataIndex: 'status' },
            {
              title: '操作',
              render: (_: any, r: ARAP) => (
                <Space>
                  {(r.status === 'open' || r.status === 'pending') && (
                    <Button size="small" type="primary" onClick={() => openConfirmModal(r)}>确认</Button>
                  )}
                  <Button size="small" onClick={() => openDetailModal(r)}>对账单</Button>
                </Space>
              )
            }
          ]}
        />

        <Modal
          title="新建应收"
          open={createOpen}
          onOk={handleCreate}
          confirmLoading={isCreating}
          onCancel={() => setCreateOpen(false)}
          destroyOnClose
        >
          <Form form={createForm.form} layout="vertical">
            <Form.Item name="siteId" label="客户（站点）" rules={[{ required: true, message: '请选择站点' }]} className="form-full-width">
              <Select options={sites} placeholder="选择站点" showSearch />
            </Form.Item>
            <Form.Item name="issueDate" label="开立日期" rules={[{ required: true, message: '请选择开立日期' }]} className="form-full-width">
              <DatePicker className="form-full-width" />
            </Form.Item>
            <Form.Item name="dueDate" label="到期日" className="form-full-width">
              <DatePicker className="form-full-width" />
            </Form.Item>
            <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]} className="form-full-width">
              <InputNumber min={0.01} step={0.01} className="form-full-width" precision={2} />
            </Form.Item>
            <Form.Item name="memo" label="备注" className="form-full-width">
              <Input />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          width={720}
          title="对账单/核销"
          open={detailOpen}
          onCancel={() => {
            setDetailOpen(false)
            setDetailDocId(undefined)
          }}
          footer={null}
          destroyOnClose
        >
          {detail && (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="单号">{detail.doc?.docNo}</Descriptions.Item>
                <Descriptions.Item label="状态">{detail.doc?.status}</Descriptions.Item>
                <Descriptions.Item label="开立">{detail.doc?.issueDate}</Descriptions.Item>
                <Descriptions.Item label="到期">{detail.doc?.dueDate || '-'}</Descriptions.Item>
                <Descriptions.Item label="金额">{(detail.doc?.amountCents / 100).toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="已结">{(detail.settledCents / 100).toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="未结" span={2}>{(detail.remainingCents / 100).toFixed(2)}</Descriptions.Item>
              </Descriptions>
              <div style={{ height: 8 }} />
              <Table
                className="table-striped"
                rowKey="id"
                size="small"
                dataSource={detail.settlements}
                pagination={false}
                columns={[
                  { title: '日期', dataIndex: 'settle_date' },
                  { title: '流水ID', dataIndex: 'flowId', render: (v: string) => v ? v.slice(0, 8) + '...' : '-' },
                  { title: '核销金额', dataIndex: 'settleAmountCents', render: (v: number) => (v / 100).toFixed(2) },
                ]}
              />
              <div style={{ height: 12 }} />
              <Form layout="inline" form={settleForm.form}>
                <Form.Item name="flowId" rules={[{ required: true, message: '请选择流水' }]}>
                  <Select style={{ width: 360 }} options={flows} placeholder="选择对应的收款流水" />
                </Form.Item>
                <Form.Item name="settle_amount" rules={[{ required: true, message: '请输入核销金额' }]}>
                  <InputNumber min={0.01} step={0.01} placeholder="核销金额" />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" loading={isSettling} onClick={handleSettle}>登记核销</Button>
                  </Space>
                </Form.Item>
              </Form>
            </>
          )}
        </Modal>

        <Modal
          title="确认应收"
          open={confirmOpen}
          onCancel={() => {
            setConfirmOpen(false)
            setConfirmingDoc(null)
            setFileList([])
            setVoucherUrl(undefined)
          }}
          footer={null}
          destroyOnClose
        >
          {confirmingDoc && (
            <Form form={confirmForm.form} layout="vertical" onFinish={handleConfirm}>
              <Form.Item label="金额">{(confirmingDoc.amountCents / 100).toFixed(2)}</Form.Item>
              <Form.Item name="accountId" label="账户" rules={[{ required: true, message: '请选择账户' }]} className="form-full-width">
                <Select options={accounts} placeholder="选择账户" showSearch />
              </Form.Item>
              <Form.Item name="categoryId" label="类别" rules={[{ required: true, message: '请选择类别' }]} className="form-full-width">
                <Select options={categories} placeholder="选择类别" />
              </Form.Item>
              <Form.Item name="bizDate" label="业务日期" rules={[{ required: true, message: '请选择业务日期' }]} className="form-full-width">
                <DatePicker className="form-full-width" />
              </Form.Item>
              <Form.Item name="memo" label="备注" className="form-full-width">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item label="凭证" required className="form-full-width">
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
                {voucherUrl && <div className="form-extra-info" style={{ color: 'var(--color-success)' }}>✓ 凭证已上传</div>}
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={isConfirming}>确认</Button>
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
    </PageContainer>
  )
}
