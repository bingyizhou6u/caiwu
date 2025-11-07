/**
 * 通用表单模态框组件
 * 减少重复的表单模态框代码
 */

import { Modal, Form, FormProps } from 'antd'
import { ReactNode } from 'react'

export interface FormModalProps {
  open: boolean
  title: string
  form: any
  onSubmit: () => Promise<void>
  onCancel: () => void
  children: ReactNode
  okText?: string
  cancelText?: string
  width?: number | string
  loading?: boolean
  formProps?: FormProps
}

export function FormModal({
  open,
  title,
  form,
  onSubmit,
  onCancel,
  children,
  okText = '确定',
  cancelText = '取消',
  width = 520,
  loading = false,
  formProps = {}
}: FormModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
      okText={okText}
      cancelText={cancelText}
      width={width}
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" {...formProps}>
        {children}
      </Form>
    </Modal>
  )
}

