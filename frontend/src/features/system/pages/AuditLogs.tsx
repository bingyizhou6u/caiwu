import { useState, useMemo } from 'react'
import { Card, Table, Button, Input, Select, DatePicker, Space, Row, Col, Tag, message } from 'antd'
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useAuditLogs, useAuditLogOptions, useExportAuditLogs } from '../../../hooks/business/useAuditLogs'
import type { AuditLogQueryParams } from '../../../hooks/business/useAuditLogs'

const { RangePicker } = DatePicker
const { Option } = Select

import { PageContainer } from '../../../components/PageContainer'

export function AuditLogs() {
  const [filters, setFilters] = useState<Omit<AuditLogQueryParams, 'limit' | 'offset'>>({})
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })

  const queryParams = useMemo(() => ({
    limit: pagination.pageSize,
    offset: (pagination.current - 1) * pagination.pageSize,
    ...filters
  }), [pagination, filters])

  const { data, isLoading, refetch } = useAuditLogs(queryParams)
  const { data: options } = useAuditLogOptions()
  const { mutateAsync: exportLogs, isPending: exporting } = useExportAuditLogs()

  const handleSearch = (newFilters: any) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleTableChange = (newPagination: any) => {
    setPagination(prev => ({
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 20
    }))
  }

  const handleExport = withErrorHandler(
    async () => {
      const blob = await exportLogs(filters)
      const url = window.URL.createObjectURL(blob as unknown as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${dayjs().format('YYYYMMDDHHmmss')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
    {
      successMessage: '导出成功',
      errorMessage: '导出失败'
    }
  )

  const columns = [
    {
      title: '时间',
      dataIndex: 'at',
      width: 180,
      render: (val: number) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作人',
      dataIndex: 'actorName',
      width: 120,
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <span>{text || '系统'}</span>
          {record.actorEmail && <span style={{ fontSize: 12, color: '#999' }}>{record.actorEmail}</span>}
        </Space>
      )
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 120,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '对象类型',
      dataIndex: 'entity',
      width: 120,
    },
    {
      title: '对象ID',
      dataIndex: 'entityId',
      width: 120,
      ellipsis: true,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      width: 140,
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <span>{text || '-'}</span>
          {record.ipLocation && <span style={{ fontSize: 12, color: '#999' }}>{record.ipLocation}</span>}
        </Space>
      )
    }
  ]

  return (
    <PageContainer
      title="审计日志"
      breadcrumb={[{ title: '系统设置' }, { title: '审计日志' }]}
    >
      <Card bordered={false} className="page-card">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="操作类型"
                allowClear
                onChange={(val) => handleSearch({ action: val })}
                options={options?.actions.map((a: string) => ({ label: a, value: a }))}
              />
            </Col>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="对象类型"
                allowClear
                onChange={(val) => handleSearch({ entity: val })}
                options={options?.entities.map((e: string) => ({ label: e, value: e }))}
              />
            </Col>
            <Col span={6}>
              <Input
                placeholder="搜索操作人..."
                prefix={<SearchOutlined />}
                onPressEnter={(e) => handleSearch({ actor_keyword: e.currentTarget.value })}
              />
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                showTime
                onChange={(dates) => {
                  handleSearch({
                    start_time: dates?.[0]?.valueOf(),
                    end_time: dates?.[1]?.valueOf()
                  })
                }}
              />
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出CSV</Button>
          </div>

          <Table
            className="table-striped"
            rowKey="id"
            columns={columns}
            dataSource={data?.results || []}
            loading={isLoading}
            pagination={{
              ...pagination,
              total: data?.total || 0,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`
            }}
            onChange={handleTableChange}
          />
        </Space>
      </Card>
    </PageContainer>
  )
}
