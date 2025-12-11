import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, DatePicker } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'
import { loadEmployees } from '../../../utils/loaders'
import { usePermissions } from '../../../utils/permissions'

const { TextArea } = Input

const ALLOCATION_TYPE_OPTIONS = [
  { value: 'employee_onboarding', label: '员工入职' },
  { value: 'transfer', label: '调拨' },
  { value: 'temporary', label: '临时借用' },
]

import { PageContainer } from '../../../components/PageContainer'

export function FixedAssetAllocation() {
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

  const { hasPermission, isFinance: checkIsFinance, isHR } = usePermissions()
  const canManageAssets = checkIsFinance() || isHR()

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (employeeFilter) params.append('employeeId', employeeFilter)
      if (returnedFilter === 'true') params.append('returned', 'true')
      else if (returnedFilter === 'false') params.append('returned', 'false')

      const url = params.toString()
        ? `${api.fixedAssetsAllocations}?${params.toString()}`
        : api.fixedAssetsAllocations

      const rows = await apiClient.get<any[]>(url)
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
        apiClient.get<any[]>(api.fixedAssets).then(results => results.filter((a: any) => a.status === 'in_use' || a.status === 'idle')),
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
      allocationDate: dayjs(),
      allocationType: 'employee_onboarding'
    })
    setAllocateOpen(true)
  }

  const handleReturn = (allocation: any) => {
    if (allocation.returnDate) {
      message.warning('该资产已归还')
      return
    }
    setCurrentAllocation(allocation)
    returnForm.resetFields()
    returnForm.setFieldsValue({
      returnDate: dayjs()
    })
    setReturnOpen(true)
  }

  const handleAllocateSubmit = async () => {
    if (!currentAsset) return

    const v = await allocateForm.validateFields()
    const payload = {
      ...v,
      allocationDate: v.allocationDate ? v.allocationDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }

    try {
      await apiClient.post(api.fixedAssetsAllocate(currentAsset.id), payload)
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
      returnDate: v.returnDate ? v.returnDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
    }

    try {
      await apiClient.post(api.fixedAssetsAllocationReturn(currentAllocation.id), payload)
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
    <PageContainer
      title="资产分配"
      breadcrumb={[{ title: '资产管理' }, { title: '资产分配' }]}
    >
      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 16 }} wrap>
          {canManageAssets && (
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
                        label: `${a.assetCode} - ${a.name} (${a.category || '其他'})`
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
                onOk: () => { },
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
          className="table-striped"
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: '资产编号', dataIndex: 'assetCode', width: 120 },
            { title: '资产名称', dataIndex: 'assetName', width: 200 },
            { title: '员工姓名', dataIndex: 'employeeName', width: 120 },
            { title: '员工项目', dataIndex: 'employee_departmentName', width: 120 },
            {
              title: '分配类型',
              dataIndex: 'allocationType',
              width: 120,
              render: (v: string) => {
                const option = ALLOCATION_TYPE_OPTIONS.find(o => o.value === v)
                return option?.label || v
              }
            },
            { title: '分配日期', dataIndex: 'allocationDate', width: 120 },
            {
              title: '归还日期',
              dataIndex: 'returnDate',
              width: 120,
              render: (v: string) => v || '-'
            },
            {
              title: '状态',
              width: 100,
              render: (_: any, r: any) => (
                <span style={{ color: r.returnDate ? '#999' : '#52c41a' }}>
                  {r.returnDate ? '已归还' : '使用中'}
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
                  disabled={!!r.returnDate || !checkIsFinance()}
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
                  <p>资产编号：{currentAsset.assetCode}</p>
                  <p>资产名称：{currentAsset.name}</p>
                  <p>类别：{currentAsset.category || '-'}</p>
                </div>
              </Form.Item>
              <Form.Item name="employeeId" label="分配给员工" rules={[{ required: true }]}>
                <Select
                  options={employees.map(e => ({
                    value: e.id,
                    label: `${e.name} (${e.departmentName || '-'})`
                  }))}
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择员工"
                />
              </Form.Item>
              <Form.Item name="allocationDate" label="分配日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="allocationType" label="分配类型" rules={[{ required: true }]}>
                <Select options={ALLOCATION_TYPE_OPTIONS} />
              </Form.Item>
              <Form.Item name="memo" label="备注">
                <TextArea rows={3} placeholder="备注信息" />
              </Form.Item>
            </Form>
          )}
        </Modal>

        <Modal
          title={`归还资产：${currentAllocation?.assetName || ''}`}
          open={returnOpen}
          onCancel={() => { setReturnOpen(false); setCurrentAllocation(null); returnForm.resetFields() }}
          onOk={handleReturnSubmit}
          width={600}
        >
          {currentAllocation && (
            <Form form={returnForm} layout="vertical">
              <Form.Item label="资产信息">
                <div>
                  <p>资产编号：{currentAllocation.assetCode}</p>
                  <p>资产名称：{currentAllocation.assetName}</p>
                </div>
              </Form.Item>
              <Form.Item label="员工信息">
                <div>
                  <p>员工姓名：{currentAllocation.employeeName}</p>
                  <p>分配日期：{currentAllocation.allocationDate}</p>
                </div>
              </Form.Item>
              <Form.Item name="returnDate" label="归还日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="memo" label="备注">
                <TextArea rows={3} placeholder="备注信息" />
              </Form.Item>
            </Form>
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}

