import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker } from 'antd'
import { api } from '../config/api'
import dayjs from 'dayjs'
import { loadEmployees } from '../utils/loaders'
import { apiGet } from '../utils/api'

const { TextArea } = Input

const ALLOCATION_TYPE_OPTIONS = [
  { value: 'employee_onboarding', label: '员工入职' },
  { value: 'transfer', label: '调拨' },
  { value: 'temporary', label: '临时借用' },
]

export function FixedAssetAllocation({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [currentAsset, setCurrentAsset] = useState<any>(null)
  const [currentAllocation, setCurrentAllocation] = useState<any>(null)
  const [allocateForm] = Form.useForm()
  const [returnForm] = Form.useForm()
  const [assets, setAssets] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [employeeFilter, setEmployeeFilter] = useState<string | undefined>()
  const [returnedFilter, setReturnedFilter] = useState<string | undefined>()
  const isFinance = userRole === 'finance' || userRole === 'manager' || userRole === 'hr'

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (employeeFilter) params.append('employee_id', employeeFilter)
      if (returnedFilter === 'true') params.append('returned', 'true')
      else if (returnedFilter === 'false') params.append('returned', 'false')
      
      const url = params.toString() 
        ? `${api.fixedAssetsAllocations}?${params.toString()}`
        : api.fixedAssetsAllocations
      
      const rows = await apiGet(url)
      setData(rows)
    } catch (error: any) {
      message.error(`查询失败: ${error.message || '网络错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadMasterData = async () => {
    try {
      const [assetsData, employeesData] = await Promise.all([
        apiGet(api.fixedAssets).then(results => results.filter((a: any) => a.status === 'in_use' || a.status === 'idle')),
        loadEmployees()
      ])
      setAssets(assetsData)
      setEmployees(employeesData.map(e => ({ 
        id: e.value as string, 
        name: e.label.split(' (')[0],
        active: 1
      })))
    } catch (error: any) {
      message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
    }
  }

  useEffect(() => {
    load()
    loadMasterData()
  }, [])

  useEffect(() => {
    load()
  }, [employeeFilter, returnedFilter])

  const handleAllocate = (asset: any) => {
    if (asset.status === 'sold' || asset.status === 'scrapped') {
      message.warning('该资产不能分配')
      return
    }
    setCurrentAsset(asset)
    allocateForm.resetFields()
    allocateForm.setFieldsValue({
      allocation_date: dayjs(),
      allocation_type: 'employee_onboarding'
    })
    setAllocateOpen(true)
  }

  const handleReturn = (allocation: any) => {
    if (allocation.return_date) {
      message.warning('该资产已归还')
      return
    }
    setCurrentAllocation(allocation)
    returnForm.resetFields()
    returnForm.setFieldsValue({
      return_date: dayjs()
    })
    setReturnOpen(true)
  }

  const handleAllocateSubmit = async () => {
    if (!currentAsset) return
    
    const v = await allocateForm.validateFields()
    const payload = {
      ...v,
      allocation_date: v.allocation_date ? v.allocation_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }
    
    try {
      const res = await fetch(api.fixedAssetsAllocate(currentAsset.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '分配失败')
        return
      }
      message.success('资产分配成功')
      setAllocateOpen(false)
      setCurrentAsset(null)
      allocateForm.resetFields()
      load()
      loadMasterData()
    } catch (error: any) {
      message.error('分配失败：' + (error.message || '网络错误'))
    }
  }

  const handleReturnSubmit = async () => {
    if (!currentAllocation) return
    
    const v = await returnForm.validateFields()
    const payload = {
      ...v,
      return_date: v.return_date ? v.return_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }
    
    try {
      const res = await fetch(api.fixedAssetsAllocationReturn(currentAllocation.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) {
        message.error(result.error || '归还失败')
        return
      }
      message.success('资产归还成功')
      setReturnOpen(false)
      setCurrentAllocation(null)
      returnForm.resetFields()
      load()
      loadMasterData()
    } catch (error: any) {
      message.error('归还失败：' + (error.message || '网络错误'))
    }
  }

  return (
    <Card title="资产分配（员工入职领取设备）">
      <Space style={{ marginBottom: 16 }} wrap>
          {isFinance && (
          <Button type="primary" onClick={() => {
            if (assets.length === 0) {
              message.warning('暂无可分配的资产')
              return
            }
            // 打开资产选择对话框
            Modal.confirm({
              title: '选择要分配的资产',
              content: (
                <Select
                  style={{ width: '100%', marginTop: 16 }}
                  showSearch
                  placeholder="搜索资产"
                  optionFilterProp="label"
                  options={assets
                    .filter(a => a.status === 'in_use' || a.status === 'idle')
                    .map(a => ({
                      value: a.id,
                      label: `${a.asset_code} - ${a.name} (${a.category || '其他'})`
                    }))}
                  onChange={(value) => {
                    const asset = assets.find(a => a.id === value)
                    if (asset) {
                      Modal.destroyAll()
                      handleAllocate(asset)
                    }
                  }}
                />
              ),
              onOk: () => {},
              okText: '取消',
              cancelButtonProps: { style: { display: 'none' } }
            })
          }}>
            分配资产
          </Button>
        )}
        <Button onClick={load}>刷新</Button>
        <Select
          placeholder="员工筛选"
          allowClear
          style={{ width: 200 }}
          value={employeeFilter}
          onChange={setEmployeeFilter}
          showSearch
          optionFilterProp="label"
        >
          {employees.map(e => (
            <Select.Option key={e.id} value={e.id}>
              {e.name}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="归还状态"
          allowClear
          style={{ width: 150 }}
          value={returnedFilter}
          onChange={setReturnedFilter}
        >
          <Select.Option value="false">未归还</Select.Option>
          <Select.Option value="true">已归还</Select.Option>
        </Select>
      </Space>
      
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={[
          { title: '资产编号', dataIndex: 'asset_code', width: 120 },
          { title: '资产名称', dataIndex: 'asset_name', width: 200 },
          { title: '员工姓名', dataIndex: 'employee_name', width: 120 },
          { title: '员工项目', dataIndex: 'employee_department_name', width: 120 },
          {
            title: '分配类型',
            dataIndex: 'allocation_type',
            width: 120,
            render: (v: string) => {
              const option = ALLOCATION_TYPE_OPTIONS.find(o => o.value === v)
              return option?.label || v
            }
          },
          { title: '分配日期', dataIndex: 'allocation_date', width: 120 },
          {
            title: '归还日期',
            dataIndex: 'return_date',
            width: 120,
            render: (v: string) => v || '-'
          },
          {
            title: '状态',
            width: 100,
            render: (_: any, r: any) => (
              <span style={{ color: r.return_date ? '#999' : '#52c41a' }}>
                {r.return_date ? '已归还' : '使用中'}
              </span>
            )
          },
          {
            title: '操作',
            width: 100,
            render: (_: any, r: any) => (
              <Button
                size="small"
                onClick={() => handleReturn(r)}
                disabled={!!r.return_date || !isFinance}
              >
                归还
              </Button>
            )
          },
        ]}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={`分配资产：${currentAsset?.name || ''}`}
        open={allocateOpen}
        onCancel={() => { setAllocateOpen(false); setCurrentAsset(null); allocateForm.resetFields() }}
        onOk={handleAllocateSubmit}
        width={600}
      >
        {currentAsset && (
          <Form form={allocateForm} layout="vertical">
            <Form.Item label="资产信息">
              <div>
                <p>资产编号：{currentAsset.asset_code}</p>
                <p>资产名称：{currentAsset.name}</p>
                <p>类别：{currentAsset.category || '-'}</p>
              </div>
            </Form.Item>
            <Form.Item name="employee_id" label="分配给员工" rules={[{ required: true }]}>
              <Select
                options={employees.map(e => ({
                  value: e.id,
                  label: `${e.name} (${e.department_name || '-'})`
                }))}
                showSearch
                optionFilterProp="label"
                placeholder="选择员工"
              />
            </Form.Item>
            <Form.Item name="allocation_date" label="分配日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="allocation_type" label="分配类型" rules={[{ required: true }]}>
              <Select options={ALLOCATION_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title={`归还资产：${currentAllocation?.asset_name || ''}`}
        open={returnOpen}
        onCancel={() => { setReturnOpen(false); setCurrentAllocation(null); returnForm.resetFields() }}
        onOk={handleReturnSubmit}
        width={600}
      >
        {currentAllocation && (
          <Form form={returnForm} layout="vertical">
            <Form.Item label="资产信息">
              <div>
                <p>资产编号：{currentAllocation.asset_code}</p>
                <p>资产名称：{currentAllocation.asset_name}</p>
              </div>
            </Form.Item>
            <Form.Item label="员工信息">
              <div>
                <p>员工姓名：{currentAllocation.employee_name}</p>
                <p>分配日期：{currentAllocation.allocation_date}</p>
              </div>
            </Form.Item>
            <Form.Item name="return_date" label="归还日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <TextArea rows={3} placeholder="备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Card>
  )
}

