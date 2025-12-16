import { useState, useMemo } from 'react'
import { Card, Button, Form, Input, DatePicker, InputNumber, Select, Space, message, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { uploadImageAsWebP, isSupportedImageType } from '../../../utils/image'
import { useAPDocs, useCreateAP, useConfirmAP } from '../../../hooks'
import { useAccounts, useExpenseCategories } from '../../../hooks/useBusinessData'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createAPSchema, confirmAPSchema } from '../../../validations/ap.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import { DataTable, type DataTableColumn, AmountDisplay, PageToolbar } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { FormModal } from '../../../components/FormModal'
import type { ARAP } from '../../../types/business'
import { PageContainer } from '../../../components/PageContainer'

export function AP() {
  // 模态框
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmingDoc, setConfirmingDoc] = useState<ARAP | null>(null)
  const [searchParams, setSearchParams] = useState<{ party?: string; status?: string }>({})

  // 表单
  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 表单
  const createForm = useZodForm(createAPSchema)
  const confirmForm = useZodForm(confirmAPSchema)

  // 上传状态
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrl, setVoucherUrl] = useState<string | undefined>()

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useExpenseCategories()
  const { data: docs = { total: 0, list: [] }, isLoading: loading, refetch } = useAPDocs(page, pageSize)
  const { mutateAsync: createAP, isPending: isCreating } = useCreateAP()
  const { mutateAsync: confirmAP, isPending: isConfirming } = useConfirmAP()

  // 处理函数
  const handleCreate = withErrorHandler(
    async () => {
      const values = await createForm.validateWithZod()
      await createAP({
        partyId: values.party, // 注意：Schema 使用 'party'，API 期望 'partyId'。旧代码使用 'partyId: v.party'。假定输入是名称但字段是 partyId。
        // 等等，旧代码：`partyId: v.party`。输入标签 "供应商"。
        // 如果是文本输入，可能就是名称。后端可能会处理它。
        // 让我们沿用旧逻辑：将 `party` 作为 `partyId` 传递。
        issueDate: values.issueDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
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
      await confirmAP({
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
      refetch()
    },
    { successMessage: '已确认并生成支出记录' }
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
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
    confirmForm.form.setFieldValue({ bizDate: dayjs(record.issueDate) })
  }

  // ARAP 扩展类型（包含可能的 party 字段）
  interface ARAPWithParty extends ARAP {
    party?: string
  }

  // 过滤数据
  const filteredDocs = useMemo(() => {
    return docs.list.filter((doc: ARAP) => {
      if (searchParams.party) {
        const search = searchParams.party.toLowerCase()
        // AP 单据可能没有 partyName 字段，需要检查实际字段名
        const partyName = (doc as ARAPWithParty).partyName || (doc as ARAPWithParty).party || ''
        if (!partyName.toLowerCase().includes(search)) {
          return false
        }
      }
      if (searchParams.status && doc.status !== searchParams.status) {
        return false
      }
      return true
    })
  }, [docs.list, searchParams])

  const columns: DataTableColumn<ARAPWithParty>[] = [
    { title: '单号', dataIndex: 'docNo', key: 'docNo' },
    { title: '开立日期', dataIndex: 'issueDate', key: 'issueDate' },
    { title: '到期日', dataIndex: 'dueDate', key: 'dueDate' },
    { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} /> },
    { title: '已结', dataIndex: 'settledCents', key: 'settledCents', render: (v: number) => <AmountDisplay cents={v} /> },
    { title: '状态', dataIndex: 'status', key: 'status' },
  ]

  return (
    <PageContainer
      title="应付管理"
      breadcrumb={[{ title: '财务管理' }, { title: '应付管理' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            { name: 'party', label: '供应商', type: 'input', placeholder: '请输入供应商名称' },
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
              label: '新建应付',
              type: 'primary',
              onClick: () => {
                setCreateOpen(true)
                createForm.form.resetFields()
                createForm.form.setFieldValue({ issueDate: dayjs() })
              }
            },
            {
              label: '刷新',
              onClick: () => refetch()
            }
          ]}
          style={{ marginTop: 16 }}
        />

        <DataTable<ARAPWithParty>
          columns={columns}
          data={filteredDocs as ARAPWithParty[]}
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
            </Space>
          )}
          tableProps={{ className: 'table-striped' }}
        />

        <FormModal
          title="新建应付"
          open={createOpen}
          form={createForm.form}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={isCreating}
        >
          <Form.Item name="party" label="供应商" rules={[{ required: true, message: '请输入供应商名称' }]} className="form-full-width">
            <Input />
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
        </FormModal>

        {confirmingDoc && (
          <FormModal
            title="确认应付"
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
            <Form.Item label="金额">
              {confirmingDoc.amountCents / 100}
              {confirmingDoc.settledCents !== undefined && (
                <>
                  {' '}
                  已结: {(confirmingDoc.settledCents / 100).toFixed(2)}
                </>
              )}
            </Form.Item>
            <Form.Item name="accountId" label="账户" rules={[{ required: true, message: '请选择账户' }]} className="form-full-width">
              <Select options={Array.isArray(accounts) ? accounts : []} placeholder="选择账户" showSearch />
            </Form.Item>
            <Form.Item name="categoryId" label="类别" rules={[{ required: true, message: '请选择类别' }]} className="form-full-width">
              <Select options={Array.isArray(categories) ? categories : []} placeholder="选择类别" />
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
          </FormModal>
        )}
      </Card>
    </PageContainer>
  )
}
