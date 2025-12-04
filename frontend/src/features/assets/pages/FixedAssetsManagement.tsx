import { useState, useMemo } from 'react'
import { Card, Space, Button, Input, Select, Tag, Popconfirm, message, Modal, Form, DatePicker, InputNumber, Tabs, Table } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../../utils/permissions'
import { useFixedAssets, useCreateFixedAsset, useUpdateFixedAsset, useDeleteFixedAsset, useBatchDeleteFixedAsset, useTransferFixedAsset, useDepreciateFixedAsset } from '../../../hooks/business/useFixedAssets'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { useMultipleModals } from '../../../hooks/forms/useFormModal'
import { useDepartments, useSites, useVendors, useCurrencies } from '../../../hooks'
import { VirtualTable } from '../../../components/VirtualTable'
import { PageContainer } from '../../../components/PageContainer'
import type { FixedAsset } from '../../../types'

// Constants
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
  // Permissions
  const { hasPermission, isManager: _isManager } = usePermissions()
  const isManager = _isManager()
  const canManageAssets = hasPermission('asset', 'fixed', 'create')
  const canDelete = isManager

  // Hooks
  const { data: departments = [] } = useDepartments()
  const { data: sites = [] } = useSites()
  const { data: vendors = [] } = useVendors()
  const { data: currencies = [] } = useCurrencies()

  // Forms
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  const [tForm] = Form.useForm()
  const [dForm] = Form.useForm()

  // Modals
  const modals = useMultipleModals(['create', 'edit', 'detail', 'transfer', 'depreciation'])
  const detailData = modals.getData('detail')

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [filterDepartment, setFilterDepartment] = useState<string | undefined>()
  const [filterCategory, setFilterCategory] = useState<string | undefined>()

  // Data
  const { data: assets = [], isLoading, refetch } = useFixedAssets({
    search,
    status: filterStatus,
    department_id: filterDepartment,
    category: filterCategory
  })

  // Mutations
  const { mutateAsync: createAsset } = useCreateFixedAsset()
  const { mutateAsync: updateAsset } = useUpdateFixedAsset()
  const { mutateAsync: deleteAssetMutation } = useDeleteFixedAsset()
  const { mutateAsync: batchDeleteAsset } = useBatchDeleteFixedAsset()
  const { mutateAsync: transferAsset } = useTransferFixedAsset()
  const { mutateAsync: depreciateAsset } = useDepreciateFixedAsset()

  // Handlers
  const handleCreate = async () => {
    try {
      const values = await cForm.validateFields()
      await createAsset({
        ...values,
        purchase_date: values.purchase_date?.format('YYYY-MM-DD'),
      })
      modals.close('create')
      cForm.resetFields()
      message.success('创建成功')
      refetch()
    } catch (e) {
      // Form validation error or API error handled by mutation
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
        purchase_date: values.purchase_date?.format('YYYY-MM-DD'),
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
        transfer_date: values.transfer_date?.format('YYYY-MM-DD'),
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
        depreciation_date: values.depreciation_date?.format('YYYY-MM-DD'),
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
      purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
    })
    modals.open('edit', record)
  }

  // Batch Operations
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
        <Space style={{ marginBottom: 12 }} wrap>
          {canManageAssets && (
            <Button type="primary" onClick={() => { modals.open('create'); cForm.resetFields(); cForm.setFieldsValue({ status: 'in_use', currency: 'CNY' }) }}>新建资产</Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
          {canDelete && (
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              loading={batchDeleting}
            >
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 项资产吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0}
              >
                <span>批量删除 ({selectedRowKeys.length})</span>
              </Popconfirm>
            </Button>
          )}
          <Input.Search
            placeholder="搜索资产编号、名称、责任人"
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => refetch()}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_OPTIONS}
          />
          <Select
            placeholder="项目筛选"
            allowClear
            style={{ width: 150 }}
            value={filterDepartment}
            onChange={setFilterDepartment}
            options={departments}
          />
          <Select
            placeholder="类别筛选"
            allowClear
            style={{ width: 150 }}
            value={filterCategory}
            onChange={setFilterCategory}
            options={CATEGORY_OPTIONS}
          />
        </Space>
        <VirtualTable
          className="table-striped"
          rowKey="id"
          loading={isLoading}
          dataSource={assets}
          rowSelection={canDelete ? rowSelection : undefined}
          columns={[
            { title: '资产编号', dataIndex: 'asset_code', width: 120 },
            { title: '资产名称', dataIndex: 'name', width: 200 },
            { title: '类别', dataIndex: 'category', width: 100 },
            {
              title: '购买价格',
              width: 120,
              render: (_: unknown, r: FixedAsset) => {
                const price = r.purchase_price_cents ? (r.purchase_price_cents / 100).toFixed(2) : '0.00'
                return `${price} ${r.currency || ''}`
              }
            },
            {
              title: '当前净值',
              width: 120,
              render: (_: unknown, r: FixedAsset) => {
                const value = r.current_value_cents ? (r.current_value_cents / 100).toFixed(2) : '0.00'
                return `${value} ${r.currency || ''}`
              }
            },
            { title: '项目', dataIndex: 'department_name', width: 120 },
            { title: '位置', dataIndex: 'site_name', width: 120 },
            { title: '责任人', dataIndex: 'custodian', width: 100 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (v: string) => {
                const option = STATUS_OPTIONS.find(o => o.value === v)
                const colors: Record<string, string> = {
                  in_use: 'green',
                  idle: 'orange',
                  scrapped: 'red',
                  maintenance: 'blue',
                }
                return <Tag color={colors[v] || 'default'}>{option?.label || v}</Tag>
              }
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
            <Form.Item name="asset_code" label="资产编号" required className="form-no-margin-bottom">
              <Input placeholder="唯一标识，如：FA001" />
            </Form.Item>
            <Form.Item name="name" label="资产名称" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="category" label="资产类别" className="form-no-margin-bottom">
              <Select options={CATEGORY_OPTIONS} placeholder="选择类别" allowClear showSearch />
            </Form.Item>
            <Form.Item name="purchase_date" label="购买日期" className="form-no-margin-bottom">
              <DatePicker className="form-full-width" format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="purchase_price_cents" label="购买价格" required className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} placeholder="请输入购买价格" />
            </Form.Item>
            <Form.Item name="currency" label="币种" required className="form-no-margin-bottom">
              <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
            </Form.Item>
            <Form.Item name="vendor_id" label="供应商" className="form-no-margin-bottom">
              <Select options={vendors} showSearch optionFilterProp="label" placeholder="选择供应商" allowClear />
            </Form.Item>
            <Form.Item name="department_id" label="使用项目" className="form-no-margin-bottom">
              <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
            </Form.Item>
            <Form.Item name="site_id" label="资产位置" className="form-no-margin-bottom">
              <Select options={sites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
            </Form.Item>
            <Form.Item name="custodian" label="责任人" className="form-no-margin-bottom">
              <Input placeholder="使用人/责任人姓名" />
            </Form.Item>
            <Form.Item name="status" label="状态" required className="form-no-margin-bottom">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="depreciation_method" label="折旧方法" className="form-no-margin-bottom">
              <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="useful_life_years" label="预计使用年限（年）" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={0} placeholder="年" />
            </Form.Item>
            <Form.Item name="current_value_cents" label="当前净值" className="form-no-margin-bottom">
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
            <Form.Item name="asset_code" label="资产编号" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="name" label="资产名称" required className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="category" label="资产类别" className="form-no-margin-bottom">
              <Select options={CATEGORY_OPTIONS} allowClear showSearch />
            </Form.Item>
            <Form.Item name="purchase_date" label="购买日期" className="form-no-margin-bottom">
              <DatePicker className="form-full-width" format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="purchase_price_cents" label="购买价格" required className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="currency" label="币种" required className="form-no-margin-bottom">
              <Select options={currencies} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="vendor_id" label="供应商" className="form-no-margin-bottom">
              <Select options={vendors} showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="department_id" label="使用项目" className="form-no-margin-bottom">
              <Select options={departments} showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="site_id" label="资产位置" className="form-no-margin-bottom">
              <Select options={sites} showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="custodian" label="责任人" className="form-no-margin-bottom">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态" required className="form-no-margin-bottom">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="depreciation_method" label="折旧方法" className="form-no-margin-bottom">
              <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="useful_life_years" label="预计使用年限（年）" className="form-no-margin-bottom">
              <InputNumber className="form-full-width" min={0} precision={0} />
            </Form.Item>
            <Form.Item name="current_value_cents" label="当前净值" className="form-no-margin-bottom">
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
                  <p><strong>资产编号：</strong>{detailData.asset_code}</p>
                  <p><strong>资产名称：</strong>{detailData.name}</p>
                  <p><strong>类别：</strong>{detailData.category || '-'}</p>
                  <p><strong>购买日期：</strong>{detailData.purchase_date || '-'}</p>
                  <p><strong>购买价格：</strong>{(detailData.purchase_price_cents / 100).toFixed(2)} {detailData.currency}</p>
                  <p><strong>当前净值：</strong>{(detailData.current_value_cents / 100).toFixed(2)} {detailData.currency}</p>
                  <p><strong>供应商：</strong>{detailData.vendor_name || '-'}</p>
                  <p><strong>使用项目：</strong>{detailData.department_name || '-'}</p>
                  <p><strong>资产位置：</strong>{detailData.site_name || '-'}</p>
                  <p><strong>责任人：</strong>{detailData.custodian || '-'}</p>
                  <p><strong>状态：</strong>{STATUS_OPTIONS.find(o => o.value === detailData.status)?.label || detailData.status}</p>
                  <p><strong>折旧方法：</strong>{DEPRECIATION_METHOD_OPTIONS.find(o => o.value === detailData.depreciation_method)?.label || detailData.depreciation_method || '-'}</p>
                  <p><strong>预计使用年限：</strong>{detailData.useful_life_years ? `${detailData.useful_life_years}年` : '-'}</p>
                  <p><strong>备注：</strong>{detailData.memo || '-'}</p>
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab="折旧记录" key="depreciations">
                <Table
                  rowKey="id"
                  dataSource={detailData.depreciations || []}
                  columns={[
                    { title: '折旧日期', dataIndex: 'depreciation_date', width: 120 },
                    { title: '折旧金额', render: (_, r: any) => `${((r.depreciation_amount_cents || 0) / 100).toFixed(2)} ${detailData.currency}`, width: 120 },
                    { title: '累计折旧', render: (_, r: any) => `${((r.accumulated_depreciation_cents || 0) / 100).toFixed(2)} ${detailData.currency}`, width: 120 },
                    { title: '剩余价值', render: (_, r: any) => `${((r.remaining_value_cents || 0) / 100).toFixed(2)} ${detailData.currency}`, width: 120 },
                    { title: '备注', dataIndex: 'memo' },
                  ]}
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane tab="变动记录" key="changes">
                <Table
                  rowKey="id"
                  dataSource={detailData.changes || []}
                  columns={[
                    { title: '变动日期', dataIndex: 'change_date', width: 120 },
                    { title: '变动类型', dataIndex: 'change_type', width: 120 },
                    { title: '原项目', dataIndex: 'from_dept_name', width: 120 },
                    { title: '新项目', dataIndex: 'to_dept_name', width: 120 },
                    { title: '原位置', dataIndex: 'from_site_name', width: 120 },
                    { title: '新位置', dataIndex: 'to_site_name', width: 120 },
                    { title: '原责任人', dataIndex: 'from_custodian', width: 100 },
                    { title: '新责任人', dataIndex: 'to_custodian', width: 100 },
                    { title: '原状态', dataIndex: 'from_status', width: 100 },
                    { title: '新状态', dataIndex: 'to_status', width: 100 },
                    { title: '备注', dataIndex: 'memo' },
                  ]}
                  pagination={{ pageSize: 20 }}
                />
              </Tabs.TabPane>
            </Tabs>
          )}
        </Modal>

        {/* 资产调拨 */}
        <Modal title={`调拨资产：${modals.getData('transfer')?.name || ''}`} open={modals.isOpen('transfer')} onCancel={() => modals.close('transfer')} onOk={handleTransfer}>
          <Form form={tForm} layout="vertical">
            <Form.Item name="transfer_date" label="调拨日期" required>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="to_department_id" label="调至项目">
              <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
            </Form.Item>
            <Form.Item name="to_site_id" label="调至位置">
              <Select options={sites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
            </Form.Item>
            <Form.Item name="to_custodian" label="调至责任人">
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
            <Form.Item name="depreciation_date" label="折旧日期" required>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="depreciation_amount_cents" label="折旧金额" required>
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
