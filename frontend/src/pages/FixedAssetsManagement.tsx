import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, DatePicker, InputNumber, Tabs, Tag } from 'antd'
import { api } from '../config/api'
import dayjs from 'dayjs'
import { loadCurrencies, loadDepartments } from '../utils/loaders'
import { apiGet } from '../utils/api'

const STATUS_OPTIONS = [
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'scrapped', label: '报废' },
  { value: 'maintenance', label: '维修中' },
]

const DEPRECIATION_METHOD_OPTIONS = [
  { value: 'straight_line', label: '直线法' },
  { value: 'accelerated', label: '加速折旧' },
]

const CATEGORY_OPTIONS = [
  { value: '电脑', label: '电脑' },
  { value: '办公家具', label: '办公家具' },
  { value: '车辆', label: '车辆' },
  { value: '设备', label: '设备' },
  { value: '其他', label: '其他' },
]

export function FixedAssetsManagement({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [depreciationOpen, setDepreciationOpen] = useState(false)
  const [editRow, setEditRow] = useState<any>(null)
  const [detailRow, setDetailRow] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [filterDepartment, setFilterDepartment] = useState<string | undefined>()
  const [filterCategory, setFilterCategory] = useState<string | undefined>()
  const [cForm] = Form.useForm()
  const [eForm] = Form.useForm()
  const [tForm] = Form.useForm()
  const [dForm] = Form.useForm()
  const [currencies, setCurrencies] = useState<{ value: string, label: string }[]>([])
  const [departments, setDepartments] = useState<{ value: string, label: string }[]>([])
  const [sites, setSites] = useState<{ value: string, label: string }[]>([])
  const [vendors, setVendors] = useState<{ value: string, label: string }[]>([])
  const [categories, setCategories] = useState<{ value: string, label: string }[]>([])
  const isManager = userRole === 'manager'
  const isFinance = userRole === 'finance' || isManager

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (filterStatus) params.append('status', filterStatus)
      if (filterDepartment) params.append('department_id', filterDepartment)
      if (filterCategory) params.append('category', filterCategory)
      
      const res = await fetch(`${api.fixedAssets}?${params.toString()}`, { credentials: 'include' })
      const j = await res.json()
      setData(j.results ?? [])
    } finally {
      setLoading(false)
    }
  }

  const loadMasterData = async () => {
    try {
      const [currenciesData, departmentsData, sitesData, vendorsData, categoriesData] = await Promise.all([
        loadCurrencies(),
        loadDepartments(),
        apiGet(api.sites).then(results => results.filter((r: any) => r.active === 1).map((r: any) => ({ value: r.id, label: r.name }))),
        apiGet(api.vendors).then(results => results.map((r: any) => ({ value: r.id, label: r.name }))),
        apiGet(api.fixedAssetsCategories).then(results => results.map((r: any) => ({ value: r.name, label: r.name })))
      ])
      setCurrencies(currenciesData)
      setDepartments(departmentsData)
      setSites(sitesData)
      setVendors(vendorsData)
      setCategories(categoriesData)
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(()=>{ 
    load(); 
    loadMasterData();
  }, [search, filterStatus, filterDepartment, filterCategory])

  const loadDetail = async (id: string) => {
    try {
      const res = await fetch(api.fixedAssetsById(id), { credentials: 'include' })
      const j = await res.json()
      setDetailRow(j)
    } catch (e) {
      message.error('加载详情失败')
    }
  }

  const deleteAsset = async (id: string, name: string) => {
    try {
      const res = await fetch(api.fixedAssetsById(id), { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        message.success('删除成功')
        load()
      } else {
        message.error(data.error || `删除失败: ${res.status}`)
      }
    } catch (error: any) {
      message.error(`删除失败: ${error.message || '未知错误'}`)
    }
  }

  return (
    <Card title="资产管理">
      <Space style={{ marginBottom: 12 }} wrap>
        {isFinance && (
          <Button type="primary" onClick={()=>{ setCreateOpen(true); cForm.resetFields() }}>新建资产</Button>
        )}
        <Button onClick={load}>刷新</Button>
        <Input.Search 
          id="fixed-assets-search"
          placeholder="搜索资产编号、名称、责任人" 
          style={{ width: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={load}
          allowClear
        />
        <Select
          id="fixed-assets-filter-status"
          placeholder="状态筛选"
          allowClear
          style={{ width: 150 }}
          value={filterStatus}
          onChange={setFilterStatus}
        >
          {STATUS_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
        </Select>
        <Select
          id="fixed-assets-filter-department"
          placeholder="项目筛选"
          allowClear
          style={{ width: 150 }}
          value={filterDepartment}
          onChange={setFilterDepartment}
        >
          {departments.map(d => <Select.Option key={d.value} value={d.value}>{d.label}</Select.Option>)}
        </Select>
        <Select
          id="fixed-assets-filter-category"
          placeholder="类别筛选"
          allowClear
          style={{ width: 150 }}
          value={filterCategory}
          onChange={setFilterCategory}
        >
          {categories.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
        </Select>
      </Space>
      <Table 
        rowKey="id" 
        loading={loading} 
        dataSource={data} 
        columns={[
          { title: '资产编号', dataIndex: 'asset_code', width: 120 },
          { title: '资产名称', dataIndex: 'name', width: 200 },
          { title: '类别', dataIndex: 'category', width: 100 },
          { 
            title: '购买价格', 
            width: 120,
            render: (_:any, r:any) => {
              const price = r.purchase_price_cents ? (r.purchase_price_cents / 100).toFixed(2) : '0.00'
              return `${price} ${r.currency || ''}`
            }
          },
          { 
            title: '当前净值', 
            width: 120,
            render: (_:any, r:any) => {
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
            render: (_:any, r:any)=> (
              <Space>
                <Button size="small" onClick={() => { setDetailRow(r); loadDetail(r.id); setDetailOpen(true) }}>详情</Button>
                {isFinance && (
                  <>
                    <Button size="small" onClick={()=>{
                      setEditRow(r); setEditOpen(true);
                      eForm.setFieldsValue({
                        asset_code: r.asset_code,
                        name: r.name,
                        category: r.category,
                        purchase_date: r.purchase_date ? dayjs(r.purchase_date) : null,
                        purchase_price_cents: r.purchase_price_cents ? r.purchase_price_cents / 100 : null,
                        currency: r.currency,
                        vendor_id: r.vendor_id,
                        department_id: r.department_id,
                        site_id: r.site_id,
                        custodian: r.custodian,
                        status: r.status,
                        depreciation_method: r.depreciation_method,
                        useful_life_years: r.useful_life_years,
                        current_value_cents: r.current_value_cents ? r.current_value_cents / 100 : null,
                        memo: r.memo,
                      })
                    }}>编辑</Button>
                    <Button size="small" onClick={() => { setEditRow(r); setTransferOpen(true); tForm.resetFields() }}>调拨</Button>
                    <Button size="small" onClick={() => { setEditRow(r); setDepreciationOpen(true); dForm.resetFields() }}>折旧</Button>
                  </>
                )}
                {isManager && (
                  <Popconfirm
                    title={`确定要删除资产"${r.name}"吗？`}
                    description="删除后该资产将被永久删除，如果有折旧记录，将无法删除。"
                    onConfirm={() => deleteAsset(r.id, r.name)}
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
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 20 }}
      />

      {/* 新建资产 */}
      <Modal title="新建资产" open={createOpen} onCancel={()=>setCreateOpen(false)} width={800} onOk={async()=>{
        const v = await cForm.validateFields()
        const payload = {
          ...v,
          purchase_price_cents: Math.round((v.purchase_price_cents || 0) * 100),
          current_value_cents: v.current_value_cents ? Math.round(v.current_value_cents * 100) : Math.round((v.purchase_price_cents || 0) * 100),
          purchase_date: v.purchase_date ? v.purchase_date.format('YYYY-MM-DD') : null,
        }
        const res = await fetch(api.fixedAssets, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        if (res.ok) { message.success('已创建'); setCreateOpen(false); cForm.resetFields(); load() } else { const e = await res.json(); message.error(e.error||'创建失败') }
      }}>
        <Form form={cForm} layout="vertical" initialValues={{ status: 'in_use', currency: 'CNY' }}>
          <Form.Item name="asset_code" label="资产编号" rules={[{ required: true, message: '请输入资产编号' }]}>
            <Input placeholder="唯一标识，如：FA001" />
          </Form.Item>
          <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="资产类别">
            <Select options={CATEGORY_OPTIONS} placeholder="选择类别" allowClear showSearch />
          </Form.Item>
          <Form.Item name="purchase_date" label="购买日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="purchase_price_cents" label="购买价格" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入购买价格" />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencies} showSearch optionFilterProp="label" placeholder="选择币种" />
          </Form.Item>
          <Form.Item name="vendor_id" label="供应商">
            <Select options={vendors} showSearch optionFilterProp="label" placeholder="选择供应商" allowClear />
          </Form.Item>
          <Form.Item name="department_id" label="使用项目">
            <Select options={departments} showSearch optionFilterProp="label" placeholder="选择项目" allowClear />
          </Form.Item>
          <Form.Item name="site_id" label="资产位置">
            <Select options={sites} showSearch optionFilterProp="label" placeholder="选择位置" allowClear />
          </Form.Item>
          <Form.Item name="custodian" label="责任人">
            <Input placeholder="使用人/责任人姓名" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="depreciation_method" label="折旧方法">
            <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="useful_life_years" label="预计使用年限（年）">
            <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="年" />
          </Form.Item>
          <Form.Item name="current_value_cents" label="当前净值">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="默认为购买价格" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑资产 */}
      <Modal title={`编辑：${editRow?.name || ''}`} open={editOpen} onCancel={()=>setEditOpen(false)} width={800} onOk={async()=>{
        const v = await eForm.validateFields()
        const payload = {
          ...v,
          purchase_price_cents: Math.round((v.purchase_price_cents || 0) * 100),
          current_value_cents: v.current_value_cents ? Math.round(v.current_value_cents * 100) : null,
          purchase_date: v.purchase_date ? v.purchase_date.format('YYYY-MM-DD') : null,
        }
        const res = await fetch(api.fixedAssetsById(editRow.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        if (res.ok) { message.success('已更新'); setEditOpen(false); load() } else { const e = await res.json(); message.error(e.error||'更新失败') }
      }}>
        <Form form={eForm} layout="vertical">
          <Form.Item name="asset_code" label="资产编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="资产类别">
            <Select options={CATEGORY_OPTIONS} allowClear showSearch />
          </Form.Item>
          <Form.Item name="purchase_date" label="购买日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="purchase_price_cents" label="购买价格" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencies} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="vendor_id" label="供应商">
            <Select options={vendors} showSearch optionFilterProp="label" allowClear />
          </Form.Item>
          <Form.Item name="department_id" label="使用项目">
            <Select options={departments} showSearch optionFilterProp="label" allowClear />
          </Form.Item>
          <Form.Item name="site_id" label="资产位置">
            <Select options={sites} showSearch optionFilterProp="label" allowClear />
          </Form.Item>
          <Form.Item name="custodian" label="责任人">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="depreciation_method" label="折旧方法">
            <Select options={DEPRECIATION_METHOD_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="useful_life_years" label="预计使用年限（年）">
            <InputNumber style={{ width: '100%' }} min={0} precision={0} />
          </Form.Item>
          <Form.Item name="current_value_cents" label="当前净值">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 资产详情 */}
      <Modal title={`资产详情：${detailRow?.name || ''}`} open={detailOpen} onCancel={()=>setDetailOpen(false)} width={1000} footer={null}>
        {detailRow && (
          <Tabs>
            <Tabs.TabPane tab="基本信息" key="basic">
              <div style={{ padding: '16px 0' }}>
                <p><strong>资产编号：</strong>{detailRow.asset_code}</p>
                <p><strong>资产名称：</strong>{detailRow.name}</p>
                <p><strong>类别：</strong>{detailRow.category || '-'}</p>
                <p><strong>购买日期：</strong>{detailRow.purchase_date || '-'}</p>
                <p><strong>购买价格：</strong>{(detailRow.purchase_price_cents / 100).toFixed(2)} {detailRow.currency}</p>
                <p><strong>当前净值：</strong>{(detailRow.current_value_cents / 100).toFixed(2)} {detailRow.currency}</p>
                <p><strong>供应商：</strong>{detailRow.vendor_name || '-'}</p>
                <p><strong>使用项目：</strong>{detailRow.department_name || '-'}</p>
                <p><strong>资产位置：</strong>{detailRow.site_name || '-'}</p>
                <p><strong>责任人：</strong>{detailRow.custodian || '-'}</p>
                <p><strong>状态：</strong>{STATUS_OPTIONS.find(o => o.value === detailRow.status)?.label || detailRow.status}</p>
                <p><strong>折旧方法：</strong>{DEPRECIATION_METHOD_OPTIONS.find(o => o.value === detailRow.depreciation_method)?.label || detailRow.depreciation_method || '-'}</p>
                <p><strong>预计使用年限：</strong>{detailRow.useful_life_years ? `${detailRow.useful_life_years}年` : '-'}</p>
                <p><strong>备注：</strong>{detailRow.memo || '-'}</p>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="折旧记录" key="depreciations">
              <Table
                rowKey="id"
                dataSource={detailRow.depreciations || []}
                columns={[
                  { title: '折旧日期', dataIndex: 'depreciation_date', width: 120 },
                  { title: '折旧金额', render: (_, r: any) => `${((r.depreciation_amount_cents || 0) / 100).toFixed(2)} ${detailRow.currency}`, width: 120 },
                  { title: '累计折旧', render: (_, r: any) => `${((r.accumulated_depreciation_cents || 0) / 100).toFixed(2)} ${detailRow.currency}`, width: 120 },
                  { title: '剩余价值', render: (_, r: any) => `${((r.remaining_value_cents || 0) / 100).toFixed(2)} ${detailRow.currency}`, width: 120 },
                  { title: '备注', dataIndex: 'memo' },
                ]}
                pagination={{ pageSize: 20 }}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab="变动记录" key="changes">
              <Table
                rowKey="id"
                dataSource={detailRow.changes || []}
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
      <Modal title={`调拨资产：${editRow?.name || ''}`} open={transferOpen} onCancel={()=>setTransferOpen(false)} onOk={async()=>{
        const v = await tForm.validateFields()
        const payload = {
          transfer_date: v.transfer_date.format('YYYY-MM-DD'),
          to_department_id: v.to_department_id || null,
          to_site_id: v.to_site_id || null,
          to_custodian: v.to_custodian || null,
          memo: v.memo || null,
        }
        const res = await fetch(api.fixedAssetsTransfer(editRow.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        if (res.ok) { message.success('调拨成功'); setTransferOpen(false); tForm.resetFields(); load() } else { const e = await res.json(); message.error(e.error||'调拨失败') }
      }}>
        <Form form={tForm} layout="vertical">
          <Form.Item name="transfer_date" label="调拨日期" rules={[{ required: true }]}>
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
      <Modal title={`记录折旧：${editRow?.name || ''}`} open={depreciationOpen} onCancel={()=>setDepreciationOpen(false)} onOk={async()=>{
        const v = await dForm.validateFields()
        const payload = {
          depreciation_date: v.depreciation_date.format('YYYY-MM-DD'),
          depreciation_amount_cents: Math.round((v.depreciation_amount_cents || 0) * 100),
          memo: v.memo || null,
        }
        const res = await fetch(api.fixedAssetsDepreciations(editRow.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        if (res.ok) { message.success('折旧记录已创建'); setDepreciationOpen(false); dForm.resetFields(); load() } else { const e = await res.json(); message.error(e.error||'创建失败') }
      }}>
        <Form form={dForm} layout="vertical">
          <Form.Item name="depreciation_date" label="折旧日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="depreciation_amount_cents" label="折旧金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入折旧金额" />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

