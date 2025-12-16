/**
 * 通用表单模态框组件
 * 减少重复的表单模态框代码，支持表单验证和错误处理
 */

import { Modal, Form, FormProps, FormInstance, message } from 'antd'
import { ReactNode, useCallback } from 'react'

export interface FormModalProps {
  open: boolean
  title: string
  form: FormInstance
  onSubmit: () => Promise<void> | void
  onCancel: () => void
  children: ReactNode
  okText?: string
  cancelText?: string
  width?: number | string
  loading?: boolean
  formProps?: FormProps
  validateOnSubmit?: boolean
  onSuccess?: () => void
  onError?: (error: Error) => void
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
  formProps = {},
  validateOnSubmit = true,
  onSuccess,
  onError,
}: FormModalProps) {
  const handleSubmit = useCallback(async () => {
    try {
      // 表单验证
      if (validateOnSubmit) {
        await form.validateFields()
      }
      
      // 执行提交
      await onSubmit()
      
      // 成功回调
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: unknown) {
      // 如果是表单验证错误，不显示错误消息（Ant Design 会自动显示）
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return
      }
      
      // 其他错误
      const errorMessage = error instanceof Error ? error.message : '操作失败，请重试'
      message.error(errorMessage)
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage))
      }
    }
  }, [form, onSubmit, validateOnSubmit, onSuccess, onError])

  const handleCancel = useCallback(() => {
    form.resetFields()
    onCancel()
  }, [form, onCancel])

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={okText}
      cancelText={cancelText}
      width={width}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" {...formProps}>
        {children}
      </Form>
    </Modal>
  )
}

