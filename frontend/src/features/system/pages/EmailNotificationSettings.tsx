import { useEffect, useState } from 'react'
import { Card, Switch, Space, message, Typography, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { apiPut } from '../../../utils/api'

const { Title, Paragraph } = Typography

interface ConfigResponse {
  key: string
  value: string | boolean
  description?: string
}

export function EmailNotificationSettings() {
  const [enabled, setEnabled] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<ConfigResponse>(`${api.systemConfig}/email_notification_enabled`)
      setEnabled(data.value === true || data.value === 'true')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '获取配置失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    try {
      await apiPut(`${api.systemConfig}/email_notification_enabled`, {
        value: checked,
        description: '是否启用登录邮件提醒'
      })
      setEnabled(checked)
      message.success(checked ? '已启用邮件提醒' : '已停用邮件提醒')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '更新配置失败'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="邮件提醒设置"
      loading={loading}
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>刷新</Button>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4}>登录邮件提醒</Title>
          <Paragraph>
            当用户登录系统时，系统会向用户邮箱发送登录提醒邮件，包含登录时间、IP地址等信息。
          </Paragraph>
          <Space>
            <Switch
              checked={enabled}
              onChange={handleToggle}
              loading={saving}
              checkedChildren="已启用"
              unCheckedChildren="已停用"
            />
            <span>{enabled ? '邮件提醒已启用' : '邮件提醒已停用'}</span>
          </Space>
        </div>

        <div style={{ marginTop: 24 }}>
          <Title level={5}>说明</Title>
          <Paragraph>
            <ul>
              <li>启用后，每次用户登录都会发送邮件提醒</li>
              <li>停用后，用户登录时不会发送邮件提醒</li>
              <li>此设置立即生效，无需重启服务</li>
            </ul>
          </Paragraph>
        </div>
      </Space>
    </Card>
  )
}
