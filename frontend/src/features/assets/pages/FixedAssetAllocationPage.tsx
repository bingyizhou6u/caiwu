import React, { useState, useMemo } from 'react'
import { Card, Button, Modal, Form, Input, Select, Space, message, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useEmployees } from '../../../hooks/useBusinessData'
import { useFixedAssets, useFixedAssetAllocations, useAllocateFixedAsset, useReturnFixedAsset } from '../../../hooks'
import { usePermissions } from '../../../utils/permissions'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import type { FixedAsset, FixedAssetAllocation } from '../../../types/domain'
import type { SelectOption } from '../../../types/business'

const { TextArea } = Input

const ALLOCATION_TYPE_OPTIONS = [
  { value: 'employee_onboarding', label: '员工入职' },
  { value: 'transfer', label: '调拨' },
  { value: 'temporary', label: '临时借用' },
]

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, EmptyText } from '../../../components/common'

export function FixedAssetAllocation() {
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [currentAsset, setCurrentAsset] = useState<FixedAsset | null>(null)
  const [currentAllocation, setCurrentAllocation] = useState<FixedAssetAllocation | null>(null)
  const [allocateForm] = Form.useForm()
  const [returnForm] = Form.useForm()
  const [employeeFilter, setEmployeeFilter] = useState<string | undefined>()
  const [returnedFilter, setReturnedFilter] = useState<string | undefined>()

  const { hasPermission, isFinance: checkIsFinance, isHR } = usePermissions()
  const canManageAssets = checkIsFinance() || isHR()

  // Business data hooks
  const { data: employeesData = [] } = useEmployees()
  const employees = React.useMemo(() => employeesData.map((e: SelectOption) => ({
    id: e.value as string,
    name: e.label.split(' (')[0],
    active: 1
  })), [employeesData])

  const { data: allAssets = [] } = useFixedAssets()
  const assets = useMemo(() => {
    return allAssets.filter((a: FixedAsset) => a.status === 'in_use' || a.status === 'idle')
  }, [allAssets])

  const { data: allocations = [], isLoading } = useFixedAssetAllocations({
    employeeId: employeeFilter,
    returned: returnedFilter
  })
  const { mutateAsync: allocateAsset } = useAllocateFixedAsset()
  const { mutateAsync: returnAsset } = useReturnFixedAsset()

  const handleAllocate = (asset: FixedAsset) => {
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

  const handleReturn = (allocation: FixedAssetAllocation) => {
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

  const handleAllocateSubmit = withErrorHandler(
    async () => {
      if (!currentAsset) return

      const v = await allocateForm.validateFields()
      const payload = {
        ...v,
        allocationDate: v.allocationDate ? v.allocationDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      }

      await allocateAsset({ id: currentAsset.id, data: payload })
      setAllocateOpen(false)
      setCurrentAsset(null)
      allocateForm.resetFields()
    },
    {
      successMessage: '资产分配成功',
      errorMessage: '分配失败'
    }
  )

  const handleReturnSubmit = withErrorHandler(
    async () => {
      if (!currentAllocation) return

      const v = await returnForm.validateFields()
      const payload = {
        ...v,
        returnDate: v.returnDate ? v.returnDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      }

      await returnAsset({ id: currentAllocation.id, data: payload })
      setReturnOpen(false)
      setCurrentAllocation(null)
      returnForm.resetFields()
    },
    {
      successMessage: '资产归还成功',
      errorMessage: '归还失败'
    }
  )

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

        <DataTable<any>
          columns={[
            { title: '资产编号', dataIndex: 'assetCode', key: 'assetCode', width: 120 },
            { title: '资产名称', dataIndex: 'assetName', key: 'assetName', width: 200 },
            { title: '员工姓名', dataIndex: 'employeeName', key: 'employeeName', width: 120 },
            { title: '员工项目', dataIndex: 'employee_departmentName', key: 'employee_departmentName', width: 120 },
            {
              title: '分配类型',
              dataIndex: 'allocationType',
              key: 'allocationType',
              width: 120,
              render: (v: string) => {
                const option = ALLOCATION_TYPE_OPTIONS.find(o => o.value === v)
                return option?.label || v
              }
            },
            { title: '分配日期', dataIndex: 'allocationDate', key: 'allocationDate', width: 120 },
            {
              title: '归还日期',
              dataIndex: 'returnDate',
              key: 'returnDate',
              width: 120,
              render: (v: string) => <EmptyText value={v} />
            },
            {
              title: '状态',
              key: 'status',
              width: 100,
              render: (_: unknown, r: FixedAssetAllocation) => (
                <span style={{ color: r.returnDate ? '#999' : '#52c41a' }}>
                  {r.returnDate ? '已归还' : '使用中'}
                </span>
              )
            },
          ] as DataTableColumn<FixedAssetAllocation>[]}
          data={allocations}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{ className: 'table-striped', scroll: { x: 1100 } }}
          actions={(r: FixedAssetAllocation) => (
            <Button
              size="small"
              onClick={() => handleReturn(r)}
              disabled={!!r.returnDate || !checkIsFinance()}
            >
              归还
            </Button>
          )}
        />

        {currentAsset && (
          <FormModal
            title={`分配资产：${currentAsset.name}`}
            open={allocateOpen}
            form={allocateForm}
            onSubmit={handleAllocateSubmit}
            onCancel={() => { setAllocateOpen(false); setCurrentAsset(null); allocateForm.resetFields() }}
            width={600}
          >
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
          </FormModal>
        )}

        {currentAllocation && (
          <FormModal
            title={`归还资产：${currentAllocation.assetName}`}
            open={returnOpen}
            form={returnForm}
            onSubmit={handleReturnSubmit}
            onCancel={() => { setReturnOpen(false); setCurrentAllocation(null); returnForm.resetFields() }}
            width={600}
          >
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
          </FormModal>
        )}
      </Card>
    </PageContainer>
  )
}

