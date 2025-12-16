import { useState, useMemo } from 'react'
import { Card, Button, Space, Tag, message } from 'antd'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useAuditLogs, useAuditLogOptions, useExportAuditLogs, type AuditLog, type AuditLogQueryParams } from '../../../hooks/business/useAuditLogs'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { PageContainer } from '../../../components/PageContainer'
import { getActionLabel, getActionColor, getEntityLabel, formatAuditDetail, formatEntityId, ACTION_LABELS, ENTITY_LABELS } from '../../../config/auditLabels'

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

  const handleSearch = (newFilters: Partial<AuditLogQueryParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleTableChange = (newPagination: { current?: number; pageSize?: number }) => {
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

  const columns: DataTableColumn<AuditLog>[] = [
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
      render: (text: string, record: AuditLog) => (
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
      render: (text: string) => <Tag color={getActionColor(text)}>{getActionLabel(text)}</Tag>
    },
    {
      title: '对象类型',
      dataIndex: 'entity',
      width: 120,
      render: (text: string) => getEntityLabel(text)
    },
    {
      title: '对象ID',
      dataIndex: 'entityId',
      width: 120,
      ellipsis: true,
      render: (text: string) => (
        <span title={text}>{formatEntityId(text)}</span>
      )
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (text: string) => {
        const formatted = formatAuditDetail(text)
        return <span title={formatted}>{formatted}</span>
      }
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      width: 140,
      render: (text: string, record: AuditLog) => (
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
        <SearchFilters
          fields={[
            {
              name: 'action',
              label: '操作类型',
              type: 'select',
              placeholder: '请选择操作类型',
              options: options?.actions.map((a: string) => ({ 
                label: ACTION_LABELS[a] || a, 
                value: a 
              })),
            },
            {
              name: 'entity',
              label: '对象类型',
              type: 'select',
              placeholder: '请选择对象类型',
              options: options?.entities.map((e: string) => ({ 
                label: ENTITY_LABELS[e] || e, 
                value: e 
              })),
            },
            {
              name: 'actor_keyword',
              label: '操作人',
              type: 'input',
              placeholder: '搜索操作人...',
            },
            {
              name: 'timeRange',
              label: '时间范围',
              type: 'dateRange',
              placeholder: ['开始时间', '结束时间'],
            },
          ]}
          onSearch={(values) => {
            const searchParams: Partial<AuditLogQueryParams> = {}
            if (values.action) searchParams.action = values.action
            if (values.entity) searchParams.entity = values.entity
            if (values.actor_keyword) searchParams.actor_keyword = values.actor_keyword
            if (values.timeRangeStart) searchParams.start_time = dayjs(values.timeRangeStart).valueOf()
            if (values.timeRangeEnd) searchParams.end_time = dayjs(values.timeRangeEnd).valueOf()
            handleSearch(searchParams)
          }}
          onReset={() => handleSearch({})}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出CSV</Button>
        </div>

        <DataTable<AuditLog>
          columns={columns}
          data={data?.results || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: data?.total || 0,
            onChange: (page, pageSize) => handleTableChange({ current: page, pageSize }),
          }}
          tableProps={{ className: 'table-striped' }}
        />
      </Card>
    </PageContainer>
  )
}
