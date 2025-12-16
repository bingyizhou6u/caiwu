import { Card, Switch, Space, message, Typography, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useSystemConfig, useUpdateSystemConfig } from '../../../hooks/business/useSystemConfig'
import { withErrorHandler } from '../../../utils/errorHandler'

const { Title, Paragraph } = Typography

import { PageContainer } from '../../../components/PageContainer'

export function EmailNotificationSettings() {
  const { data, isLoading, refetch } = useSystemConfig('email_notification_enabled')
  const { mutateAsync: updateConfig, isPending: saving } = useUpdateSystemConfig()

  const enabled = data?.value === true || data?.value === 'true'

  const handleToggle = withErrorHandler(
    async (checked: boolean) => {
      await updateConfig({
        key: 'email_notification_enabled',
        value: checked,
        description: '是否启用登录邮件提醒'
      })
      message.success(checked ? '已启用邮件提醒' : '已停用邮件提醒')
    },
    {
      errorMessage: '更新配置失败'
    }
  )

  return (
    <PageContainer
      title="邮件提醒设置"
      breadcrumb={[{ title: '系统设置' }, { title: '邮件提醒设置' }]}
    >
      <Card
        title="邮件提醒设置"
        loading={isLoading}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
        }
        className="page-card"
        bordered={false}
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
    </PageContainer>
  )
}
