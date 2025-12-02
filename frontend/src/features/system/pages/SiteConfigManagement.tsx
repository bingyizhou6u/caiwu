import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Space, Alert } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { apiGet, apiPut } from '../../../utils/api'

interface SiteConfig {
  id: string
  config_key: string
  config_value: string
  description: string | null
  is_encrypted: boolean
  created_at: number
  updated_at: number
}

const SiteConfigManagement: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<SiteConfig[]>([])

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const data = await apiGet(api.siteConfig)
      setConfigs(data || [])
      
      // 设置表单值
      const formValues: Record<string, string> = {}
      data.forEach((config: SiteConfig) => {
        formValues[config.config_key] = config.config_value || ''
      })
      form.setFieldsValue(formValues)
    } catch (error: any) {
      message.error(error.message || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      
      // 批量更新
      await apiPut(api.siteConfig, values)
      
      message.success('配置保存成功')
      loadConfigs()
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return
      }
      message.error(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="网站配置"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Space>
        }
      >
        <Alert
          message="配置说明"
          description="以下配置用于调用 Cloudflare API。优先使用数据库配置，如果数据库配置为空，则使用环境变量。"
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form form={form} layout="vertical">
          <Card size="small" title="Cloudflare 认证配置" style={{ marginBottom: '16px' }}>
            <Form.Item
              label="Cloudflare API Token"
              name="cloudflare_api_token"
              tooltip="优先使用 API Token，如果填写了此字段，将忽略下面的 Global API Key 和邮箱配置"
              rules={[{ required: false }]}
            >
              <Input.Password
                placeholder="输入 Cloudflare API Token（优先使用）"
                autoComplete="off"
              />
            </Form.Item>

            <Form.Item
              label="Cloudflare Global API Key"
              name="cloudflare_global_api_key"
              tooltip="备选方案1：Global API Key（需要配合邮箱使用）"
              rules={[{ required: false }]}
            >
              <Input.Password
                placeholder="输入 Cloudflare Global API Key"
                autoComplete="off"
              />
            </Form.Item>

            <Form.Item
              label="Cloudflare 账户邮箱"
              name="cloudflare_auth_email"
              tooltip="配合 Global API Key 使用"
              rules={[{ required: false }]}
            >
              <Input placeholder="输入 Cloudflare 账户邮箱" />
            </Form.Item>
          </Card>

          <Card size="small" title="Cloudflare 账户和区域配置" style={{ marginBottom: '16px' }}>
            <Form.Item
              label="Cloudflare Account ID"
              name="cloudflare_account_id"
              tooltip="Cloudflare 账户 ID（用于 IP List 操作）"
              rules={[{ required: false }]}
            >
              <Input placeholder="输入 Cloudflare Account ID" />
            </Form.Item>

            <Form.Item
              label="Cloudflare Zone ID"
              name="cloudflare_zone_id"
              tooltip="Cloudflare Zone ID（用于自定义规则）"
              rules={[{ required: false }]}
            >
              <Input placeholder="输入 Cloudflare Zone ID" />
            </Form.Item>

            <Form.Item
              label="Cloudflare IP List ID"
              name="cloudflare_ip_list_id"
              tooltip="可选，如果已创建 IP List，可指定其 ID，否则系统会自动创建"
              rules={[{ required: false }]}
            >
              <Input placeholder="输入 Cloudflare IP List ID（可选）" />
            </Form.Item>
          </Card>
        </Form>
      </Card>
    </div>
  )
}

export default SiteConfigManagement

