import { Card, Tabs, Tag, Typography, Spin, Empty } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMyAssets } from '../../../hooks'

const { Title } = Typography

interface Asset {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  specification: string
  brand: string
  model: string
  original_value_cents: number
  allocationDate: string
  returnDate: string | null
  memo: string
}

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn, AmountDisplay } from '../../../components/common'

export function MyAssets() {
  const { data, isLoading: loading } = useMyAssets()

  const current = data?.current || []
  const returned = data?.returned || []

  const columns: DataTableColumn<Asset>[] = [
    { title: '资产编号', dataIndex: 'assetCode' },
    { title: '资产名称', dataIndex: 'assetName' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '规格', dataIndex: 'specification', ellipsis: true },
    {
      title: '原值',
      dataIndex: 'original_value_cents',
      render: (v: number) => <AmountDisplay cents={v} currency="CNY" />
    },
    { title: '领用日期', dataIndex: 'allocationDate' },
    { title: '备注', dataIndex: 'memo', ellipsis: true },
  ]

  const returnedColumns: DataTableColumn<Asset>[] = [
    ...columns,
    { title: '归还日期', dataIndex: 'returnDate' },
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
        <Tabs type="card" defaultActiveKey="current" items={[
          {
            key: 'current',
            label: `当前持有 (${current.length})`,
            children: current.length > 0 ? (
              <DataTable<Asset>
                columns={columns}
                data={current}
                rowKey="id"
                pagination={false}
                tableProps={{ className: 'table-striped' }}
              />
            ) : <Empty description="暂无持有资产" />
          },
          {
            key: 'returned',
            label: `已归还 (${returned.length})`,
            children: returned.length > 0 ? (
              <DataTable<Asset>
                columns={returnedColumns}
                data={returned}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                tableProps={{ className: 'table-striped' }}
              />
            ) : <Empty description="暂无归还记录" />
          },
        ]} />
      </Card>
    </PageContainer>
  )
}

export default MyAssets
