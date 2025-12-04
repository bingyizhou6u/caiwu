import { Card, Switch, Space, message, Typography, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useSystemConfig, useUpdateSystemConfig } from '../../../hooks/business/useSystemConfig'
import { withErrorHandler } from '../../../utils/errorHandler'

const { Title, Paragraph } = Typography

import { PageContainer } from '../../../components/PageContainer'

export function SystemSettings() {
    const { data, isLoading, refetch } = useSystemConfig('2fa_enabled')
    const { mutateAsync: updateConfig, isPending: saving } = useUpdateSystemConfig()

    // Default to true if not set (backward compatibility)
    const enabled = data ? (data.value === true || data.value === 'true') : true

    const handleToggle = withErrorHandler(
        async (checked: boolean) => {
            await updateConfig({
                key: '2fa_enabled',
                value: checked,
                description: '是否启用Google 2FA登录验证'
            })
            message.success(checked ? '已启用2FA验证' : '已停用2FA验证')
            refetch()
        },
        {
            errorMessage: '更新配置失败'
        }
    )

    return (
        <PageContainer
            title="系统设置"
            breadcrumb={[{ title: '系统设置' }, { title: '通用设置' }]}
        >
            <Card
                title="登录安全设置"
                loading={isLoading}
                extra={
                    <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
                }
                className="page-card"
                bordered={false}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                        <Title level={4}>Google 2FA 验证</Title>
                        <Paragraph>
                            启用后，用户登录时需要输入Google Authenticator生成的动态验证码。
                        </Paragraph>
                        <Space>
                            <Switch
                                checked={enabled}
                                onChange={handleToggle}
                                loading={saving}
                                checkedChildren="已启用"
                                unCheckedChildren="已停用"
                            />
                            <span>{enabled ? '2FA验证已启用' : '2FA验证已停用'}</span>
                        </Space>
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <Title level={5}>说明</Title>
                        <Paragraph>
                            <ul>
                                <li>启用后，所有已绑定2FA的用户登录时必须输入验证码</li>
                                <li>未绑定2FA的用户登录后会被强制要求绑定</li>
                                <li>停用后，登录流程将跳过验证码检查</li>
                                <li>此设置立即生效</li>
                            </ul>
                        </Paragraph>
                    </div>
                </Space>
            </Card>
        </PageContainer>
    )
}
