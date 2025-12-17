/**
 * 通用数据表格组件
 * 封装常用的表格功能：列定义、分页、加载状态、操作按钮、排序、筛选
 */

import { Table, TableProps, Button, Space, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { ReactNode, useMemo } from 'react'

export type DataTableColumn<T> = ColumnsType<T>[number]

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  loading?: boolean
  pagination?: {
    current?: number
    pageSize?: number
    total?: number
    onChange?: (page: number, pageSize: number) => void
    showSizeChanger?: boolean
    showTotal?: (total: number, range: [number, number]) => ReactNode
    pageSizeOptions?: string[]
  } | false
  onEdit?: (record: T) => void
  onDelete?: (record: T) => void
  onRefresh?: () => void
  /** 表格变化回调（排序、筛选、分页等） */
  onChange?: (
    pagination: { current?: number; pageSize?: number },
    filters: Record<string, any>,
    sorter: any
  ) => void
  rowKey?: string | ((record: T) => string)
  rowSelection?: TableProps<T>['rowSelection']
  actions?: (record: T) => ReactNode
  showActions?: boolean
  actionColumnTitle?: string
  actionColumnWidth?: number
  /** 是否启用虚拟滚动（大数据量时使用） */
  virtual?: boolean
  tableProps?: Omit<TableProps<T>, 'columns' | 'dataSource' | 'loading' | 'pagination' | 'rowSelection' | 'onChange'>
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onEdit,
  onDelete,
  onRefresh,
  onChange,
  rowKey = 'id',
  rowSelection,
  actions,
  showActions = true,
  actionColumnTitle = '操作',
  actionColumnWidth = 150,
  virtual = false,
  tableProps = {},
}: DataTableProps<T>) {
  // 构建操作列（使用 useMemo 缓存）
  const actionColumn: DataTableColumn<T> | null = useMemo(() => {
    if (!showActions || (!onEdit && !onDelete && !actions)) {
      return null
    }
    return {
      title: actionColumnTitle,
      key: 'actions',
      width: actionColumnWidth,
      fixed: 'right' as const,
      render: (_: unknown, record: T) => {
        return (
          <Space size="small">
            {onEdit && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
              >
                编辑
              </Button>
            )}
            {onDelete && (
              <Popconfirm
                title="确定要删除吗？"
                onConfirm={() => onDelete(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
            {actions && actions(record)}
          </Space>
        )
      },
    }
  }, [showActions, onEdit, onDelete, actions, actionColumnTitle, actionColumnWidth])

  // 缓存最终列定义，确保 columns 始终是数组
  const finalColumns = useMemo(() => {
    const safeColumns = Array.isArray(columns) ? columns : []
    return actionColumn ? [...safeColumns, actionColumn] : safeColumns
  }, [columns, actionColumn])

  // 缓存分页配置
  const paginationConfig = useMemo(
    () =>
      pagination
        ? {
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: pagination.showSizeChanger !== false,
          showTotal:
            pagination.showTotal ||
            ((total: number, range: [number, number]) => `共 ${total} 条，显示 ${range[0]}-${range[1]} 条`),
          onChange: pagination.onChange,
          onShowSizeChange: pagination.onChange,
          pageSizeOptions: pagination.pageSizeOptions || ['10', '20', '50', '100'],
        }
        : false,
    [pagination]
  )

  // 确保 dataSource 始终是数组，防止 Ant Design 内部调用 .some() 时出错
  const safeData = Array.isArray(data) ? data : []

  // 处理表格变化（排序、筛选、分页）
  const handleTableChange = (
    paginationInfo: any,
    filters: Record<string, any>,
    sorter: any
  ) => {
    if (onChange) {
      onChange(
        {
          current: paginationInfo.current,
          pageSize: paginationInfo.pageSize,
        },
        filters,
        sorter
      )
    }
  }

  // 虚拟滚动配置（大数据量优化）
  const scrollConfig = useMemo(() => {
    const baseScroll = { x: 'max-content' }
    if (virtual && safeData.length > 100) {
      return {
        ...baseScroll,
        y: 600, // 固定高度，启用虚拟滚动
      }
    }
    return baseScroll
  }, [virtual, safeData.length])

  return (
    <div>
      {onRefresh && (
        <div style={{ marginBottom: 12, textAlign: 'right' }}>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
        </div>
      )}
      <Table<T>
        columns={finalColumns}
        dataSource={safeData}
        loading={loading}
        rowKey={rowKey}
        rowSelection={rowSelection}
        pagination={paginationConfig}
        scroll={scrollConfig}
        onChange={onChange ? handleTableChange : undefined}
        {...tableProps}
      />
    </div>
  )
}

