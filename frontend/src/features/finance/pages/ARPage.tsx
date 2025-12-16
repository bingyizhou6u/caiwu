import { useState, useMemo } from 'react'
import { Card, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Descriptions, Upload, Table } from 'antd'
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
import { DataTable, type DataTableColumn, AmountDisplay, EmptyText, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { FormModal } from '../../../components/FormModal'
import type { ARAP } from '../../../types/business'

import { PageContainer } from '../../../components/PageContainer'

export function AR() {
  // 模态框
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [searchParams, setSearchParams] = useState<{ siteName?: string; status?: string }>({})

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
        issueDate: values.issueDate.format('YYYY-MM-DD HH:mm:ss'),
        dueDate: values.dueDate?.format('YYYY-MM-DD HH:mm:ss'),
        amountCents: Math.round(values.amount * 100),
        memo: values.memo
      })
      setCreateOpen(false)
      createForm.form.resetFields()
      refetch()
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
        bizDate: values.bizDate.format('YYYY-MM-DD HH:mm:ss'),
        memo: values.memo,
        voucherUrl: voucherUrl
      })
      setConfirmOpen(false)
      setConfirmingDoc(null)
      setFileList([])
      setVoucherUrl(undefined)
      confirmForm.form.resetFields()
      refetch()
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
    confirmForm.form.setFieldValue('bizDate', dayjs(record.issueDate))
  }

  const openDetailModal = (record: ARAP) => {
    setDetailDocId(record.id)
    setDetailOpen(true)
    settleForm.form.resetFields()
  }

  // ARAP 扩展类型（包含可能的 siteName 字段）
  interface ARAPWithSiteName extends ARAP {
    siteName?: string
  }

  // 过滤数据
  const filteredDocs = useMemo(() => {
    return docs.list.filter((doc: ARAP) => {
      if (searchParams.siteName) {
        const search = searchParams.siteName.toLowerCase()
        // AR 单据使用 partyName 字段
        const name = (doc as ARAPWithSiteName).siteName || doc.partyName || ''
        if (!name.toLowerCase().includes(search)) {
          return false
        }
      }
      if (searchParams.status && doc.status !== searchParams.status) {
        return false
      }
      return true
    })
  }, [docs.list, searchParams])

  const columns: DataTableColumn<ARAPWithSiteName>[] = [
    { title: '单号', dataIndex: 'docNo', key: 'docNo' },
    { title: '客户（站点）', key: 'siteName', render: (_: unknown, r: ARAPWithSiteName) => <EmptyText value={r.siteName || r.partyName} /> },
    { title: '开立日期', dataIndex: 'issueDate', key: 'issueDate' },
    { title: '到期日', dataIndex: 'dueDate', key: 'dueDate' },
    { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} /> },
    { title: '已结', dataIndex: 'settledCents', key: 'settledCents', render: (v: number) => <AmountDisplay cents={v} /> },
    { title: '状态', dataIndex: 'status', key: 'status' },
  ]

  return (
    <PageContainer
      title="应收管理"
      breadcrumb={[{ title: '财务管理' }, { title: '应收管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'siteName', label: '客户（站点）', type: 'input', placeholder: '请输入客户或站点名称' },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '请选择状态',
              options: [
                { label: '全部', value: '' },
                { value: 'open', label: '未结' },
                { value: 'partial', label: '部分结算' },
                { value: 'settled', label: '已结清' },
                { value: 'pending', label: '待确认' },
              ],
            },
          ]}
          onSearch={setSearchParams}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <PageToolbar
          actions={[
            {
              label: '刷新',
              onClick: () => refetch(),
            },
            {
              label: '新建应收',
              type: 'primary',
              onClick: () => {
                setCreateOpen(true)
                createForm.form.resetFields()
                createForm.form.setFieldValue('issueDate', dayjs())
              }
            }
          ]}
          style={{ marginTop: 16 }}
        />

        <DataTable<ARAPWithSiteName>
          columns={columns}
          data={filteredDocs as ARAPWithSiteName[]}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: docs.total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          actions={(record) => (
            <Space>
              {(record.status === 'open' || record.status === 'pending') && (
                <Button size="small" type="primary" onClick={() => openConfirmModal(record)}>确认</Button>
              )}
              <Button size="small" onClick={() => openDetailModal(record)}>对账单</Button>
            </Space>
          )}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title="新建应收"
          open={createOpen}
          form={createForm.form}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={isCreating}
        >
          <Form.Item name="siteId" label="客户（站点）" rules={[{ required: true, message: '请选择站点' }]} className="form-full-width">
            <Select options={Array.isArray(sites) ? sites : []} placeholder="选择站点" showSearch />
          </Form.Item>
          <Form.Item name="issueDate" label="开立日期" rules={[{ required: true, message: '请选择开立日期' }]} className="form-full-width">
            <DatePicker className="form-full-width" showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="dueDate" label="到期日" className="form-full-width">
            <DatePicker className="form-full-width" showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]} className="form-full-width">
            <InputNumber min={0.01} step={0.01} className="form-full-width" precision={2} />
          </Form.Item>
          <Form.Item name="memo" label="备注" className="form-full-width">
            <Input />
          </Form.Item>
        </FormModal>

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
                <Descriptions.Item label="金额"><AmountDisplay cents={detail.doc?.amountCents} /></Descriptions.Item>
                <Descriptions.Item label="已结"><AmountDisplay cents={detail.settledCents} /></Descriptions.Item>
                <Descriptions.Item label="未结" span={2}><AmountDisplay cents={detail.remainingCents} /></Descriptions.Item>
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
                  { title: '核销金额', dataIndex: 'settleAmountCents', render: (v: number) => <AmountDisplay cents={v} currency={detail.doc?.currency} /> },
                ]}
              />
              <div style={{ height: 12 }} />
              <Form layout="inline" form={settleForm.form}>
                <Form.Item name="flowId" rules={[{ required: true, message: '请选择流水' }]}>
                  <Select style={{ width: 360 }} options={Array.isArray(flows) ? flows : []} placeholder="选择对应的收款流水" />
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

        {confirmingDoc && (
          <FormModal
            title="确认应收"
            open={confirmOpen}
            form={confirmForm.form}
            onSubmit={handleConfirm}
            onCancel={() => {
              setConfirmOpen(false)
              setConfirmingDoc(null)
              setFileList([])
              setVoucherUrl(undefined)
            }}
            loading={isConfirming}
          >
            <Form.Item label="金额"><AmountDisplay cents={confirmingDoc.amountCents} /></Form.Item>
            <Form.Item name="accountId" label="账户" rules={[{ required: true, message: '请选择账户' }]} className="form-full-width">
              <Select options={Array.isArray(accounts) ? accounts : []} placeholder="选择账户" showSearch />
            </Form.Item>
            <Form.Item name="categoryId" label="类别" rules={[{ required: true, message: '请选择类别' }]} className="form-full-width">
              <Select options={Array.isArray(categories) ? categories : []} placeholder="选择类别" />
            </Form.Item>
            <Form.Item name="bizDate" label="业务日期" rules={[{ required: true, message: '请选择业务日期' }]} className="form-full-width">
              <DatePicker className="form-full-width" showTime format="YYYY-MM-DD HH:mm:ss" />
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
          </FormModal>
        )}

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
