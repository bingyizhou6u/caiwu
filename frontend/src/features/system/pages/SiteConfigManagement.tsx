import React, { useEffect, useMemo } from 'react'
import { Card, Form, Input, Button, message, Space, Alert } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSiteConfig, useUpdateSiteConfig } from '../../../hooks/business/useSiteConfig'
import { withErrorHandler } from '../../../utils/errorHandler'
import type { SiteConfig } from '../../../hooks/business/useSiteConfig'

import { PageContainer } from '../../../components/PageContainer'

const SiteConfigManagement: React.FC = () => {
  const [form] = Form.useForm()
  const { data: configs = [], isLoading, refetch } = useSiteConfig()
  const { mutateAsync: updateConfig, isPending: saving } = useUpdateSiteConfig()

  useEffect(() => {
    if (configs.length > 0) {
      const formValues: Record<string, string> = {}
      configs.forEach((config: SiteConfig) => {
        formValues[config.config_key] = config.config_value || ''
      })
      form.setFieldsValue(formValues)
    }
  }, [configs, form])

  const handleSave = useMemo(() => withErrorHandler(
    async () => {
      const values = await form.validateFields()
      await updateConfig(values)
      message.success('配置保存成功')
      refetch()
    },
    {
      errorMessage: '保存失败'
    }
  ), [form, updateConfig, refetch])

  return (
    <PageContainer
      title="网站配置"
      breadcrumb={[{ title: '系统设置' }, { title: '网站配置' }]}
    >
      <Card
        title="网站配置"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              刷新
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Space>
        }
        className="page-card"
        bordered={false}
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
    </PageContainer>
  )
}

export default SiteConfigManagement

