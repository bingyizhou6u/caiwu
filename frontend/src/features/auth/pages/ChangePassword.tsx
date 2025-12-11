import { Card, Form, Button, message, Typography, Space, Result } from 'antd'
import { SafetyOutlined, MailOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { api } from '../../../config/api'

const { Title, Text } = Typography

export function ChangePassword() {
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const navigate = useNavigate()
    const { userInfo, token } = useAppStore()

    const handleRequestResetLink = async () => {
        setLoading(true)
        try {
            const response = await fetch(api.auth.requestMyResetLink, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                credentials: 'include',
            })

            const result = await response.json()

            if (response.ok && result.status === 'ok') {
                setSent(true)
                message.success(result.message || '重置链接已发送')
            } else {
                message.error(result.error || result.message || '请求失败，请稍后重试')
            }
        } catch (error) {
            message.error('网络连接失败，请检查您的网络')
        } finally {
            setLoading(false)
        }
    }

    if (sent) {
        return (
            <div style={{ maxWidth: 480, margin: '40px auto' }}>
                <Card>
                    <Result
                        status="success"
                        icon={<MailOutlined style={{ color: 'var(--color-primary)' }} />}
                        title="重置链接已发送"
                        subTitle={`请查收发送至 ${userInfo?.email || '您邮箱'} 的邮件，点击链接完成密码重置。链接有效期为1小时。`}
                        extra={[
                            <Button key="back" onClick={() => navigate(-1)}>
                                返回
                            </Button>,
                            <Button key="resend" type="primary" onClick={() => setSent(false)}>
                                重新发送
                            </Button>,
                        ]}
                    />
                </Card>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 480, margin: '40px auto' }}>
            <Card>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <SafetyOutlined style={{ fontSize: 48, color: 'var(--color-primary)' }} />
                        <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>修改密码</Title>
                        <Text type="secondary">点击下方按钮，系统将发送密码重置链接至您的邮箱</Text>
                    </div>

                    <div style={{
                        background: '#f5f5f5',
                        padding: 16,
                        borderRadius: 8,
                        textAlign: 'center'
                    }}>
                        <Text type="secondary">当前账号邮箱：</Text>
                        <br />
                        <Text strong>{userInfo?.email || '未知'}</Text>
                    </div>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ width: '100%' }} direction="vertical">
                            <Button
                                type="primary"
                                onClick={handleRequestResetLink}
                                loading={loading}
                                size="large"
                                icon={<MailOutlined />}
                                block
                            >
                                发送重置链接到邮箱
                            </Button>
                            <Button
                                size="large"
                                onClick={() => navigate(-1)}
                                block
                            >
                                取消
                            </Button>
                        </Space>
                    </Form.Item>
                </Space>
            </Card>
        </div>
    )
}
