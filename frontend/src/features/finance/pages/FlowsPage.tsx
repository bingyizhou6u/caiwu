import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, Space, message, Upload, Card } from 'antd'
import { UploadOutlined, EyeOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { isSupportedImageType, uploadImageAsWebP } from '../../../utils/image'
import { useFlows, useUpdateFlowVoucher } from '../../../hooks'
import { useBatchDeleteFlow } from '../../../hooks/business/useFlows'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { useAccounts, useAllCategories } from '../../../hooks/useBusinessData'
import { useMultipleModals } from '../../../hooks/forms/useFormModal'
import { DataTable, type DataTableColumn, AmountDisplay, EmptyText, PageToolbar, BatchActionButton } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import type { Flow } from '../../../types/business'
import { PageContainer } from '../../../components/PageContainer'
import { usePermissions } from '../../../utils/permissions'

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

export function Flows() {
  const navigate = useNavigate()
  
  // 权限
  const { hasPermission, isManager: _isManager } = usePermissions()
  const canCreate = hasPermission('finance', 'flow', 'create')
  const canDelete = hasPermission('finance', 'flow', 'delete') || _isManager()

  // 模态框
  const modals = useMultipleModals(['voucherUpload', 'preview'])
  const [searchParams, setSearchParams] = useState<{ type?: string; accountId?: string; categoryId?: string; dateRangeStart?: string; dateRangeEnd?: string }>({})

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: allCategories = [] } = useAllCategories()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: flowsData, isLoading: loading, refetch } = useFlows(page, pageSize)
  const flows = flowsData?.list || []
  const total = flowsData?.total || 0

  const { mutateAsync: updateVoucher, isPending: isUpdatingVoucher } = useUpdateFlowVoucher()
  const { mutateAsync: batchDeleteFlow } = useBatchDeleteFlow()

  const tableActions = useTableActions<Flow>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteFlow,
    tableActions,
    {
      onSuccess: () => {
        refetch()
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  // 预览状态
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // 凭证上传状态
  const [voucherUploadFileList, setVoucherUploadFileList] = useState<UploadFile[]>([])
  const [voucherUploadUrls, setVoucherUploadUrls] = useState<string[]>([])
  const [voucherUploading, setVoucherUploading] = useState(false)

  const onUpdateVoucher = async () => {
    if (voucherUploadUrls.length === 0) {
      message.error('请至少上传一张凭证')
      return
    }
    const currentFlow = modals.getData('voucherUpload')
    if (!currentFlow) return

    try {
      await updateVoucher({
        id: currentFlow.id,
        voucherUrls: voucherUploadUrls
      })
      message.success('凭证更新成功')
      modals.close('voucherUpload')
      setVoucherUploadUrls([])
      setVoucherUploadFileList([])
      refetch()
    } catch (error: any) {
      message.error('凭证更新失败: ' + (error.message || '未知错误'))
    }
  }

  const showPreview = (urls: string[], index: number = 0) => {
    setPreviewUrls(urls)
    setPreviewIndex(index)
    modals.open('preview')
  }

  return (
    <PageContainer
      title="收支明细"
      breadcrumb={[{ title: '财务管理' }, { title: '收支明细' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            {
              name: 'type',
              label: '类型',
              type: 'select',
              placeholder: '请选择类型',
              options: [
                { label: '全部', value: '' },
                { value: 'income', label: '收入' },
                { value: 'expense', label: '支出' },
                { value: 'transfer', label: '转账' },
                { value: 'adjust', label: '调整' },
              ],
            },
            {
              name: 'accountId',
              label: '账户',
              type: 'select',
              placeholder: '请选择账户',
              options: [
                { label: '全部', value: '' },
                ...accounts.map((a: any) => ({ value: a.value, label: a.label })),
              ],
            },
            {
              name: 'categoryId',
              label: '类别',
              type: 'select',
              placeholder: '请选择类别',
              options: [
                { label: '全部', value: '' },
                ...allCategories.map((c: any) => ({ value: c.value, label: c.label })),
              ],
            },
            {
              name: 'dateRange',
              label: '日期范围',
              type: 'dateRange',
            },
          ]}
          onSearch={(values) => {
            const params: any = {}
            if (values.type) params.type = values.type
            if (values.accountId) params.accountId = values.accountId
            if (values.categoryId) params.categoryId = values.categoryId
            if (values.dateRangeStart) params.dateRangeStart = values.dateRangeStart
            if (values.dateRangeEnd) params.dateRangeEnd = values.dateRangeEnd
            setSearchParams(params)
          }}
          onReset={() => setSearchParams({})}
          initialValues={searchParams}
        />

        <PageToolbar
          actions={[
            ...(canCreate ? [{
              label: '新建记账',
              type: 'primary' as const,
              icon: <PlusOutlined />,
              onClick: () => navigate('/finance/flows/create')
            }] : []),
            {
              label: '刷新',
              onClick: () => refetch()
            },
            ...(canDelete ? [{
              label: '批量删除',
              component: (
                <BatchActionButton
                  label="批量删除"
                  selectedCount={selectedRowKeys.length}
                  onConfirm={handleBatchDelete}
                  icon={<DeleteOutlined />}
                  loading={batchDeleting}
                  confirmTitle={(count) => `确定要删除选中的 ${count} 条记录吗？`}
                />
              )
            }] : [])
          ]}
          style={{ marginTop: 16 }}
        />

        {(() => {
          // 过滤数据
          const filteredFlows = useMemo(() => {
            let result = flows
            if (searchParams.type) {
              result = result.filter((f: Flow) => f.type === searchParams.type)
            }
            if (searchParams.accountId) {
              result = result.filter((f: Flow) => f.accountId === searchParams.accountId)
            }
            if (searchParams.categoryId) {
              result = result.filter((f: Flow) => f.categoryId === searchParams.categoryId)
            }
            if (searchParams.dateRangeStart) {
              const start = dayjs(searchParams.dateRangeStart).startOf('day')
              result = result.filter((f: Flow) => dayjs(f.bizDate).isAfter(start) || dayjs(f.bizDate).isSame(start))
            }
            if (searchParams.dateRangeEnd) {
              const end = dayjs(searchParams.dateRangeEnd).endOf('day')
              result = result.filter((f: Flow) => dayjs(f.bizDate).isBefore(end) || dayjs(f.bizDate).isSame(end))
            }
            return result
          }, [flows, searchParams])

          const columns: DataTableColumn<Flow>[] = [
            { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo' },
            { title: '日期', dataIndex: 'bizDate', key: 'bizDate', render: (v: string) => <EmptyText value={v} /> },
            { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => TYPE_LABELS[v] || v },
            { title: '金额', dataIndex: 'amountCents', key: 'amountCents', render: (v: number) => <AmountDisplay cents={v} currency="CNY" /> },
            { title: '归属', key: 'owner', render: (_: unknown, r: Flow) => r.departmentId ? '项目' : '总部' },
            { title: '账户', dataIndex: 'accountName', key: 'accountName' },
            { title: '类别', dataIndex: 'categoryName', key: 'categoryName' },
            { title: '对方', dataIndex: 'counterparty', key: 'counterparty', render: (v: string) => <EmptyText value={v} /> },
            { title: '备注', dataIndex: 'memo', key: 'memo', render: (v: string) => <EmptyText value={v} /> },
          ]

          return (
            <DataTable<Flow>
              columns={columns}
              data={filteredFlows}
              loading={loading}
              rowKey="id"
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                onChange: (p, ps) => {
                  setPage(p)
                  setPageSize(ps)
                },
              }}
              actions={(record) => {
                const voucherUrls = record.voucherUrls || (record.voucherUrl ? [record.voucherUrl] : [])
                return (
                  <Space>
                    {voucherUrls.length > 0 ? (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showPreview(voucherUrls, 0)}
                      >
                        查看 ({voucherUrls.length})
                      </Button>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                    <Button
                      size="small"
                      type={voucherUrls.length > 0 ? 'default' : 'primary'}
                      onClick={() => {
                        setVoucherUploadUrls(voucherUrls)
                        setVoucherUploadFileList([])
                        modals.open('voucherUpload', record)
                      }}
                    >
                      {voucherUrls.length > 0 ? '重新上传' : '补充凭证'}
                    </Button>
                  </Space>
                )
              }}
              rowSelection={rowSelection}
              tableProps={{ className: 'table-striped' }}
            />
          )
        })()}

        {/* 补充/重新上传凭证模态框 */}
        <Modal
          title={modals.getData('voucherUpload')?.voucherUrls && modals.getData('voucherUpload').voucherUrls.length > 0 ? '重新上传凭证' : '补充凭证'}
          open={modals.isOpen('voucherUpload')}
          confirmLoading={isUpdatingVoucher}
          onOk={onUpdateVoucher}
          onCancel={() => {
            modals.close('voucherUpload')
            setVoucherUploadUrls([])
            setVoucherUploadFileList([])
          }}
          okText="确认"
          cancelText="取消"
          destroyOnClose
        >
          {modals.getData('voucherUpload') && (
            <div style={{ marginBottom: 16 }}>
              <p><strong>凭证号：</strong>{modals.getData('voucherUpload').voucherNo || '-'}</p>
              <p><strong>日期：</strong>{modals.getData('voucherUpload').bizDate}</p>
              <p><strong>金额：</strong><AmountDisplay cents={modals.getData('voucherUpload').amountCents} currency={modals.getData('voucherUpload').currency} /></p>
            </div>
          )}
          {voucherUploadUrls.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                {voucherUploadUrls.map((url, index) => (
                  <span key={index} style={{ marginRight: 8 }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => showPreview(voucherUploadUrls, index)}
                    >
                      查看 {index + 1}
                    </Button>
                    <Button
                      size="small"
                      danger
                      style={{ marginLeft: 4 }}
                      onClick={() => {
                        setVoucherUploadUrls(voucherUploadUrls.filter((_, i) => i !== index))
                        setVoucherUploadFileList(voucherUploadFileList.filter((_, i) => i !== index))
                      }}
                    >
                      删除
                    </Button>
                  </span>
                ))}
              </div>
              <Button size="small" onClick={() => showPreview(voucherUploadUrls, 0)}>
                查看所有凭证 ({voucherUploadUrls.length})
              </Button>
            </div>
          )}
          <Upload
            beforeUpload={async (file: File) => {
              setVoucherUploading(true)
              try {
                if (!isSupportedImageType(file)) {
                  message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
                  setVoucherUploading(false)
                  return false
                }

                const url = await uploadImageAsWebP(file, api.upload.voucher)
                setVoucherUploadUrls([...voucherUploadUrls, url])
                message.success('凭证上传成功（已转换为WebP格式）')
                setVoucherUploading(false)
                return false
              } catch (error: any) {
                message.error('上传失败: ' + (error.message || '未知错误'))
                setVoucherUploading(false)
                return false
              }
            }}
            fileList={voucherUploadFileList}
            onChange={({ fileList }) => setVoucherUploadFileList(fileList)}
            multiple
            accept="image/*"
          >
            <Button icon={<UploadOutlined />} loading={voucherUploading}>上传凭证</Button>
          </Upload>
          <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
            请上传图片文件（JPEG、PNG、GIF），系统会自动转换为WebP格式，可上传多张
          </div>
        </Modal>

        {/* 凭证预览模态框 */}
        <Modal
          title={`凭证预览 (${previewIndex + 1}/${previewUrls.length})`}
          open={modals.isOpen('preview')}
          onCancel={() => {
            modals.close('preview')
            setPreviewUrls([])
            setPreviewIndex(0)
          }}
          footer={
            previewUrls.length > 1 ? (
              <Space>
                <Button
                  disabled={previewIndex === 0}
                  onClick={() => setPreviewIndex(previewIndex - 1)}
                >
                  上一张
                </Button>
                <span>{previewIndex + 1} / {previewUrls.length}</span>
                <Button
                  disabled={previewIndex === previewUrls.length - 1}
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                >
                  下一张
                </Button>
              </Space>
            ) : null
          }
          width={800}
          style={{ top: 20 }}
          bodyStyle={{ padding: 0, textAlign: 'center', maxHeight: '80vh', overflow: 'auto' }}
        >
          {previewUrls.length > 0 && previewUrls[previewIndex] && (
            <div style={{ padding: 16 }}>
              <img
                src={previewUrls[previewIndex]}
                alt={`凭证预览 ${previewIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          )}
        </Modal>

      </Card>
    </PageContainer >
  )
}
