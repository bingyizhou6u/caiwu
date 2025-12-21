import { useState, useMemo } from 'react'
import { Card, Space, Button, Tag, Popconfirm, message, Modal, Form, DatePicker, InputNumber, Input, Select, Tabs } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useFixedAssets, useCreateFixedAsset, useUpdateFixedAsset, useDeleteFixedAsset, useBatchDeleteFixedAsset, useTransferFixedAsset, useDepreciateFixedAsset } from '../../../hooks/business/useFixedAssets'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { useMultipleModals } from '../../../hooks/forms/useFormModal'
import { useDepartmentOptions, useSites, useVendors, useCurrencyOptions } from '../../../hooks'
import { VirtualTable } from '../../../components/common/VirtualTable'
import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, StatusTag, PageToolbar, BatchActionButton, AmountDisplay, EmptyText } from '../../../components/common'
import { DepartmentSelect, VendorSelect } from '../../../components/form'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { FIXED_ASSET_STATUS } from '../../../utils/status'
import type { FixedAsset } from '../../../types'

// 折旧记录类型
interface DepreciationRecord {
  id: string
  depreciationDate: string
  depreciationAmountCents?: number
  accumulatedDepreciationCents?: number
  remainingValueCents?: number
  memo?: string
}

// 变动记录类型
interface AssetChangeRecord {
  id: string
  changeDate: string
  changeType: string
  fromDeptName?: string
  toDeptName?: string
  fromSiteName?: string
  toSiteName?: string
  fromCustodian?: string
  toCustodian?: string
  fromStatus?: string
  toStatus?: string
  memo?: string
}

// 常量
const STATUS_OPTIONS = [
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'maintenance', label: '维修中' },
  { value: 'scrapped', label: '已报废' },
  { value: 'sold', label: '已出售' },
]

const CATEGORY_OPTIONS = [
  { value: 'electronic', label: '电子设备' },
  { value: 'furniture', label: '办公家具' },
  { value: 'vehicle', label: '交通工具' },
  { value: 'machinery', label: '机械设备' },
  { value: 'other', label: '其他' },
]

const DEPRECIATION_METHOD_OPTIONS = [
  { value: 'straight_line', label: '年限平均法' },
  { value: 'double_declining', label: '双倍余额递减法' },
  { value: 'sum_of_years', label: '年数总和法' },
  { value: 'none', label: '不折旧' },
]


export function FixedAssetsManagement() {
  // 权限
  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canManageAssets = hasPermission('asset', 'fixed', 'create')
  const canDelete = isManager

  // Hooks
  const { data: departments = [] } = useDepartmentOptions()
  const { data: sites = [] } = useSites()
  const { data: vendors = [] } = useVendors()
  const { data: currencyOptions = [] } = useCurrencyOptions()

  // 确保所有数据都是数组
  const safeDepartments = Array.isArray(departments) ? departments : []
  const safeSites = Array.isArray(sites) ? sites : []
  const safeVendors = Array.isArray(vendors) ? vendors : []

  // 表单
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  const [tForm] = Form.useForm()
  const [dForm] = Form.useForm()

  // 模态框
  const modals = useMultipleModals(['create', 'edit', 'detail', 'transfer', 'depreciation'])
  const detailData = modals.getData('detail')

  // 筛选
  const [searchParams, setSearchParams] = useState<{ search?: string; status?: string; department?: string; category?: string }>({})

  // 数据
  const { data: assets = [], isLoading, refetch } = useFixedAssets({
    search: searchParams.search,
    status: searchParams.status,
    departmentId: searchParams.department,
    category: searchParams.category
  })

  // 变更操作
  const { mutateAsync: createAsset } = useCreateFixedAsset()
  const { mutateAsync: updateAsset } = useUpdateFixedAsset()
  const { mutateAsync: deleteAssetMutation } = useDeleteFixedAsset()
  const { mutateAsync: batchDeleteAsset } = useBatchDeleteFixedAsset()
  const { mutateAsync: transferAsset } = useTransferFixedAsset()
  const { mutateAsync: depreciateAsset } = useDepreciateFixedAsset()

  // 处理函数
  const handleCreate = async () => {
    try {
      const values = await cForm.validateFields()
      await createAsset({
        ...values,
        purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
      })
      modals.close('create')
      cForm.resetFields()
      message.success('创建成功')
      refetch()
    } catch (e) {
      // 表单验证错误或API错误由mutation处理
    }
  }

  const handleUpdate = async () => {
    try {
      const values = await eForm.validateFields()
      const record = modals.getData('edit')
      if (!record) return
      await updateAsset({
        id: record.id,
        ...values,
        purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
      })
      modals.close('edit')
      message.success('更新成功')
      refetch()
    } catch (e) { }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAssetMutation(id)
      message.success('删除成功')
      refetch()
    } catch (e) { }
  }

  const handleTransfer = async () => {
    try {
      const values = await tForm.validateFields()
      const record = modals.getData('transfer')
      if (!record) return
      await transferAsset({
        id: record.id,
        ...values,
        transferDate: values.transferDate?.format('YYYY-MM-DD'),
      })
      modals.close('transfer')
      tForm.resetFields()
      message.success('调拨成功')
      refetch()
    } catch (e) { }
  }

  const handleDepreciate = async () => {
    try {
      const values = await dForm.validateFields()
      const record = modals.getData('depreciation')
      if (!record) return
      await depreciateAsset({
        id: record.id,
        ...values,
        depreciationDate: values.depreciationDate?.format('YYYY-MM-DD'),
      })
      modals.close('depreciation')
      dForm.resetFields()
      message.success('折旧记录成功')
      refetch()
    } catch (e) { }
  }

  const openEdit = (record: FixedAsset) => {
    eForm.setFieldsValue({
      ...record,
      purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : undefined,
    })
    modals.open('edit', record)
  }

  // 批量操作
  const tableActions = useTableActions<FixedAsset>()
  const { selectedRowKeys, rowSelection } = tableActions

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteAsset,
    tableActions,
    {
      onSuccess: () => {
        refetch()
        message.success('批量删除成功')
      },
      errorMessage: '批量删除失败'
    }
  )

  return (
    <PageContainer
      title="资产管理"
      breadcrumb={[{ title: '资产管理' }, { title: '资产管理' }]}
    >
      <Card bordered={false} className="page-card">
        <PageToolbar
          actions={[
            ...(canManageAssets ? [{
              label: '新建资产',
              type: 'primary' as const,
              onClick: () => { modals.open('create'); cForm.resetFields(); cForm.setFieldsValue({ status: 'in_use', currency: 'CNY' }) }
            }] : []),
            {
              label: '刷新',
              icon: <ReloadOutlined />,
              onClick: () => refetch()
            },
            ...(canDelete ? [{
              component: (
                <BatchActionButton
                  label="批量删除"
                  selectedCount={selectedRowKeys.length}
                  onConfirm={handleBatchDelete}
                  icon={<DeleteOutlined />}
                  loading={batchDeleting}
                />
              )
            }] : [])
          ]}
          wrap
        />
        <SearchFilters
          fields={[
            { name: 'search', label: '搜索', type: 'input', placeholder: '搜索资产编号、名称、责任人' },
            {
              name: 'status',
              label: '状态',
              type: 'select',
              placeholder: '状态筛选',
              options: [
                { label: '全部', value: '' },
                ...STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }))
              ]
            },
            {
              name: 'department',
              label: '项目',
              type: 'select',
              placeholder: '项目筛选',
              options: [
                { label: '全部', value: '' },
                ...safeDepartments.map((d: any) => ({ label: d.label || d.name, value: d.value || d.id }))
              ]
            },
            {
              name: 'category',
              label: '类别',
              type: 'select',
              placeholder: '类别筛选',
              options: [
                { label: '全部', value: '' },
                ...CATEGORY_OPTIONS.map(o => ({ label: o.label, value: o.value }))
              ]
            }
          ]}
          onSearch={(values) => {
            setSearchParams(values)
            refetch()
          }}
          onReset={() => {
            setSearchParams({})
            refetch()
          }}
          initialValues={searchParams}
        />
        <VirtualTable
          className="table-striped"
          rowKey="id"
          loading={isLoading}
          dataSource={assets}
          rowSelection={canDelete ? rowSelection : undefined}
          columns={[
            { title: '资产编号', dataIndex: 'assetCode', width: 120 },
            { title: '资产名称', dataIndex: 'name', width: 200 },
            { title: '类别', dataIndex: 'category', width: 100 },
            {
              title: '购买价格',
              width: 120,
              render: (_: unknown, r: FixedAsset) => (
                <span>
                  <AmountDisplay cents={r.purchasePriceCents || 0} currency={r.currency || 'CNY'} showSymbol={false} /> {r.currency || ''}
                </span>
              )
            },
            {
              title: '当前净值',
              width: 120,
              render: (_: unknown, r: FixedAsset) => (
                <span>
                  <AmountDisplay cents={r.currentValueCents || 0} currency={r.currency || 'CNY'} showSymbol={false} /> {r.currency || ''}
                </span>
              )
            },
            { title: '项目', dataIndex: 'departmentName', width: 120 },
            { title: '位置', dataIndex: 'siteName', width: 120 },
            { title: '责任人', dataIndex: 'custodian', width: 100 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (v: string) => <StatusTag status={v} statusMap={FIXED_ASSET_STATUS} />
            },
            {
              title: '操作',
              width: 200,
              fixed: 'right',
              render: (_: unknown, r: FixedAsset) => (
                <Space>
                  <Button size="small" onClick={() => modals.open('detail', r)}>详情</Button>
                  {canManageAssets && (
                    <>
                      <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
                      <Button size="small" onClick={() => modals.open('transfer', r)}>调拨</Button>
                      <Button size="small" onClick={() => modals.open('depreciation', r)}>折旧</Button>
                    </>
                  )}
                  {isManager && (
                    <Popconfirm
                      title={`确定要删除资产"${r.name}"吗？`}
                      description="删除后该资产将被永久删除，如果有折旧记录，将无法删除。"
                      onConfirm={() => handleDelete(r.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              )
            },
          ]}
          scroll={{ x: 1400, y: 600 }}
        />

        {/* 新建资产 */}
        <Modal title="新建资产" open={modals.isOpen('create')} onCancel={() => modals.close('create')} width={800} onOk={handleCreate}>
          <Form form={cForm} layout="vertical">
            <Form.Item name="assetCode" label="资产编号" required className="form-no-margin-bottom">
              <Input placeholder="唯一标识，如：FA001" />
            </Form.Item>
            <Form.Item name="name" label="资产名称" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="category" label="资产类别" className="form-no-margin-bottom">
              <Select options={CATEGORY_OPTIONS} placeholder="选择类别" allowClear showSearch />
            </Form.Item>
            <Form.Item name="purchaseDate" label="购买日期" className="form-no-margin-bottom">
              <DatePicker className="form-full-width" format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="purchasePriceCents" label="购买价格" required className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} placeholder="请输入购买价格" />
            </Form.Item>
            <Form.Item name="currency" label="币种" required className="form-no-margin-bottom">
              <Select options={currencyOptions} showSearch optionFilterProp="label" placeholder="选择币种" />
            </Form.Item>
            <Form.Item name="vendorId" label="供应商" className="form-no-margin-bottom">
              <VendorSelect placeholder="选择供应商" allowClear />
            </Form.Item>
            <Form.Item name="departmentId" label="使用项目" className="form-no-margin-bottom">
              <DepartmentSelect placeholder="选择项目" allowClear />
            </Form.Item>
            <Form.Item name="siteId" label="资产位置" className="form-no-margin-bottom">
              <Select options={safeSites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
            </Form.Item>
            <Form.Item name="custodian" label="责任人" className="form-no-margin-bottom">
              <Input placeholder="使用人/责任人姓名" />
            </Form.Item>
            <Form.Item name="status" label="状态" required className="form-no-margin-bottom">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="depreciationMethod" label="折旧方法" className="form-no-margin-bottom">
              <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="usefulLifeYears" label="预计使用年限（年）" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={0} placeholder="年" />
            </Form.Item>
            <Form.Item name="currentValueCents" label="当前净值" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} placeholder="默认为购买价格" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑资产 */}
        <Modal title={`编辑：${modals.getData('edit')?.name || ''}`} open={modals.isOpen('edit')} onCancel={() => modals.close('edit')} width={800} onOk={handleUpdate}>
          <Form form={eForm} layout="vertical">
            <Form.Item name="assetCode" label="资产编号" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="name" label="资产名称" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="category" label="资产类别" className="form-no-margin-bottom">
              <Select options={CATEGORY_OPTIONS} allowClear showSearch />
            </Form.Item>
            <Form.Item name="purchaseDate" label="购买日期" className="form-no-margin-bottom">
              <DatePicker className="form-full-width" format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="purchasePriceCents" label="购买价格" required className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="currency" label="币种" required className="form-no-margin-bottom">
              <Select options={currencyOptions} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="vendorId" label="供应商" className="form-no-margin-bottom">
              <VendorSelect allowClear />
            </Form.Item>
            <Form.Item name="departmentId" label="使用项目" className="form-no-margin-bottom">
              <Select options={departments} showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="siteId" label="资产位置" className="form-no-margin-bottom">
              <Select options={sites} showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="custodian" label="责任人" className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态" required className="form-no-margin-bottom">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="depreciationMethod" label="折旧方法" className="form-no-margin-bottom">
              <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="usefulLifeYears" label="预计使用年限（年）" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={0} />
            </Form.Item>
            <Form.Item name="currentValueCents" label="当前净值" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 资产详情 */}
        <Modal title={`资产详情：${detailData?.name || ''}`} open={modals.isOpen('detail')} onCancel={() => modals.close('detail')} width={1000} footer={null}>
          {detailData && (
            <Tabs>
              <Tabs.TabPane tab="基本信息" key="basic">
                <div style={{ padding: '16px 0' }}>
                  <p><strong>资产编号：</strong>{detailData.assetCode}</p>
                  <p><strong>资产名称：</strong>{detailData.name}</p>
                  <p><strong>类别：</strong><EmptyText value={detailData.category} /></p>
                  <p><strong>购买日期：</strong><EmptyText value={detailData.purchaseDate} /></p>
                  <p><strong>购买价格：</strong><AmountDisplay cents={detailData.purchasePriceCents} currency={detailData.currency} /> {detailData.currency}</p>
                  <p><strong>当前净值：</strong><AmountDisplay cents={detailData.currentValueCents} currency={detailData.currency} /> {detailData.currency}</p>
                  <p><strong>供应商：</strong><EmptyText value={detailData.vendorName} /></p>
                  <p><strong>使用项目：</strong><EmptyText value={detailData.departmentName} /></p>
                  <p><strong>资产位置：</strong><EmptyText value={detailData.siteName} /></p>
                  <p><strong>责任人：</strong><EmptyText value={detailData.custodian} /></p>
                  <p><strong>状态：</strong>{STATUS_OPTIONS.find(o => o.value === detailData.status)?.label || detailData.status}</p>
                  <p><strong>折旧方法：</strong><EmptyText value={DEPRECIATION_METHOD_OPTIONS.find(o => o.value === detailData.depreciationMethod)?.label || detailData.depreciationMethod} /></p>
                  <p><strong>预计使用年限：</strong>{detailData.usefulLifeYears ? `${detailData.usefulLifeYears}年` : <EmptyText value={null} />}</p>
                  <p><strong>备注：</strong><EmptyText value={detailData.memo} /></p>
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab="折旧记录" key="depreciations">
                <DataTable<DepreciationRecord>
                  columns={[
                    { title: '折旧日期', dataIndex: 'depreciationDate', key: 'depreciationDate', width: 120 },
                    { title: '折旧金额', key: 'depreciationAmount', render: (_: unknown, r: DepreciationRecord) => <span><AmountDisplay cents={r.depreciationAmountCents || 0} currency={detailData.currency} showSymbol={false} /> {detailData.currency}</span>, width: 120 },
                    { title: '累计折旧', key: 'accumulatedDepreciation', render: (_: unknown, r: DepreciationRecord) => <span><AmountDisplay cents={r.accumulatedDepreciationCents || 0} currency={detailData.currency} showSymbol={false} /> {detailData.currency}</span>, width: 120 },
                    { title: '剩余价值', key: 'remainingValue', render: (_: unknown, r: DepreciationRecord) => <span><AmountDisplay cents={r.remainingValueCents || 0} currency={detailData.currency} showSymbol={false} /> {detailData.currency}</span>, width: 120 },
                    { title: '备注', dataIndex: 'memo', key: 'memo' },
                  ] satisfies DataTableColumn<DepreciationRecord>[]}
                  data={(detailData.depreciations || []) as DepreciationRecord[]}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane tab="变动记录" key="changes">
                <DataTable<AssetChangeRecord>
                  columns={[
                    { title: '变动日期', dataIndex: 'changeDate', key: 'changeDate', width: 120 },
                    { title: '变动类型', dataIndex: 'changeType', key: 'changeType', width: 120 },
                    { title: '原项目', dataIndex: 'fromDeptName', key: 'fromDeptName', width: 120 },
                    { title: '新项目', dataIndex: 'toDeptName', key: 'toDeptName', width: 120 },
                    { title: '原位置', dataIndex: 'fromSiteName', key: 'fromSiteName', width: 120 },
                    { title: '新位置', dataIndex: 'toSiteName', key: 'toSiteName', width: 120 },
                    { title: '原责任人', dataIndex: 'fromCustodian', key: 'fromCustodian', width: 100 },
                    { title: '新责任人', dataIndex: 'toCustodian', key: 'toCustodian', width: 100 },
                    { title: '原状态', dataIndex: 'fromStatus', key: 'fromStatus', width: 100 },
                    { title: '新状态', dataIndex: 'toStatus', key: 'toStatus', width: 100 },
                    { title: '备注', dataIndex: 'memo', key: 'memo' },
                  ] satisfies DataTableColumn<AssetChangeRecord>[]}
                  data={(detailData.changes || []) as AssetChangeRecord[]}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
            </Tabs>
          )}
        </Modal>

        {/* 资产调拨 */}
        <Modal title={`调拨资产：${modals.getData('transfer')?.name || ''}`} open={modals.isOpen('transfer')} onCancel={() => modals.close('transfer')} onOk={handleTransfer}>
          <Form form={tForm} layout="vertical">
            <Form.Item name="transferDate" label="调拨日期" required>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="toDepartmentId" label="调至项目">
              <DepartmentSelect placeholder="选择项目" allowClear />
            </Form.Item>
            <Form.Item name="toSiteId" label="调至位置">
              <Select options={safeSites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
            </Form.Item>
            <Form.Item name="toCustodian" label="调至责任人">
              <Input placeholder="新责任人姓名" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} placeholder="调拨原因等" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 折旧记录 */}
        <Modal title={`记录折旧：${modals.getData('depreciation')?.name || ''}`} open={modals.isOpen('depreciation')} onCancel={() => modals.close('depreciation')} onOk={handleDepreciate}>
          <Form form={dForm} layout="vertical">
            <Form.Item name="depreciationDate" label="折旧日期" required>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="depreciationAmountCents" label="折旧金额" required>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入折旧金额" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}
