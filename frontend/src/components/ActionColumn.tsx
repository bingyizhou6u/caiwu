/**
 * 通用操作列组件
 * 减少重复的操作列代码
 */

import { Space, Button, Popconfirm } from 'antd'
import { ReactNode } from 'react'

export interface ActionColumnProps {
  record: any
  canEdit?: boolean
  canDelete?: boolean
  onEdit?: (record: any) => void
  onDelete?: (id: string, name: string) => void
  editText?: string
  deleteText?: string
  deleteConfirm?: string | ((record: any) => string)
  deleteDescription?: string | ((record: any) => string)
  customActions?: ReactNode
}

export function ActionColumn({
  record,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  editText = '编辑',
  deleteText = '删除',
  deleteConfirm,
  deleteDescription,
  customActions
}: ActionColumnProps) {
  const getDeleteConfirm = () => {
    if (typeof deleteConfirm === 'function') {
      return deleteConfirm(record)
    }
    return deleteConfirm || `确定要删除"${record.name || record.id}"吗？`
  }

  const getDeleteDescription = () => {
    if (typeof deleteDescription === 'function') {
      return deleteDescription(record)
    }
    return deleteDescription
  }

  return (
    <Space>
      {customActions}
      {canEdit && onEdit && (
        <Button size="small" onClick={() => onEdit(record)}>
          {editText}
        </Button>
      )}
      {canDelete && onDelete && (
        <Popconfirm
          title={getDeleteConfirm()}
          description={getDeleteDescription()}
          onConfirm={() => onDelete(record.id, record.name || record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button size="small" danger>
            {deleteText}
          </Button>
        </Popconfirm>
      )}
    </Space>
  )
}

