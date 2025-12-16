/**
 * 通用数据表格组件
 * 封装常用的表格功能：列定义、分页、加载状态、操作按钮
 */

import { Table, TableProps, Button, Space, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
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
  }
  onEdit?: (record: T) => void
  onDelete?: (record: T) => void
  onRefresh?: () => void
  rowKey?: string | ((record: T) => string)
  rowSelection?: TableProps<T>['rowSelection']
  actions?: (record: T) => ReactNode
  tableProps?: Omit<TableProps<T>, 'columns' | 'dataSource' | 'loading' | 'pagination' | 'rowSelection'>
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onEdit,
  onDelete,
  onRefresh,
  rowKey = 'id',
  rowSelection,
  actions,
  tableProps = {},
}: DataTableProps<T>) {
  // 构建操作列（使用 useMemo 缓存）
  const actionColumn: DataTableColumn<T> | null = useMemo(() =>
    onEdit || onDelete || actions
      ? {
          title: '操作',
          key: 'actions',
          width: 150,
          fixed: 'right' as const,
          render: (_: any, record: T) => {
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
      : null,
    [onEdit, onDelete, actions]
  )

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
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: pagination.onChange,
            onShowSizeChange: pagination.onChange,
          }
        : false,
    [pagination]
  )

  // 确保 dataSource 始终是数组，防止 Ant Design 内部调用 .some() 时出错
  const safeData = Array.isArray(data) ? data : []

  return (
    <Table<T>
      columns={finalColumns}
      dataSource={safeData}
      loading={loading}
      rowKey={rowKey}
      rowSelection={rowSelection}
      pagination={paginationConfig}
      {...tableProps}
    />
  )
}

