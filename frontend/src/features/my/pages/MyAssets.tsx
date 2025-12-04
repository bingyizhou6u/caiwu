import { useState, useEffect } from 'react'
import { Card, Table, Tabs, Tag, Typography, Spin, Empty } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import dayjs from 'dayjs'

const { Title } = Typography

interface Asset {
  id: string
  asset_id: string
  asset_name: string
  asset_code: string
  specification: string
  brand: string
  model: string
  original_value_cents: number
  allocation_date: string
  return_date: string | null
  memo: string
}

import { PageContainer } from '../../../components/PageContainer'

export function MyAssets() {
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<Asset[]>([])
  const [returned, setReturned] = useState<Asset[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<any>(api.my.assets)
      setCurrent(result.current || [])
      setReturned(result.returned || [])
    } catch (error) {
      console.error('Failed to load assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '资产编号', dataIndex: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '规格', dataIndex: 'specification', ellipsis: true },
    {
      title: '原值',
      dataIndex: 'original_value_cents',
      render: (v: number) => v ? `¥${(v / 100).toFixed(2)}` : '-'
    },
    { title: '领用日期', dataIndex: 'allocation_date' },
    { title: '备注', dataIndex: 'memo', ellipsis: true },
  ]

  const returnedColumns = [
    ...columns,
    { title: '归还日期', dataIndex: 'return_date' },
  ]

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  return (
    <PageContainer
      title="我的资产"
      breadcrumb={[{ title: '个人中心' }, { title: '我的资产' }]}
    >
      <Card bordered={false} className="page-card">
        <Tabs defaultActiveKey="current" items={[
          {
            key: 'current',
            label: `当前持有 (${current.length})`,
            children: current.length > 0 ? (
              <Table
                className="table-striped"
                dataSource={current}
                columns={columns}
                rowKey="id"
                pagination={false}
              />
            ) : <Empty description="暂无持有资产" />
          },
          {
            key: 'returned',
            label: `已归还 (${returned.length})`,
            children: returned.length > 0 ? (
              <Table
                className="table-striped"
                dataSource={returned}
                columns={returnedColumns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            ) : <Empty description="暂无归还记录" />
          },
        ]} />
      </Card>
    </PageContainer>
  )
}

export default MyAssets
