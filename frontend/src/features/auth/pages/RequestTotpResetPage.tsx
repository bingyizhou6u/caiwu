import { useState } from 'react'
import { Layout, Card, Form, Input, Button, message, Result, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ThunderboltFilled, MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useRequestTotpReset } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import '../../../styles/features/auth/login.css'

const { Header, Content } = Layout
const { Paragraph } = Typography

export function RequestTotpReset() {
    const navigate = useNavigate()
    const [success, setSuccess] = useState(false)
    const { mutateAsync: requestReset, isPending: loading } = useRequestTotpReset()

    const onFinish = withErrorHandler(
        async (values: { email: string }) => {
            await requestReset(values)
            setSuccess(true)
        },
        {
            showSuccess: false, // 使用 Result 组件显示成功状态
            onError: (error: unknown) => {
                if (error && typeof error === 'object' && 'code' in error && error.code === 'not_found') {
                    // 即使邮箱不存在也提示成功，防止枚举攻击
                    setSuccess(true)
                } else {
                    const errorMessage = error instanceof Error ? error.message : '网络连接失败，请检查您的网络'
                    message.error(errorMessage)
                }
            }
        }
    )

    return (
        <Layout className="login-layout">
            <Header className="login-header">
                <div className="login-header-title">
                    <ThunderboltFilled className="login-header-logo" />
                    <span>AR公司管理系统</span>
                </div>
            </Header>
            <Content className="login-content">
                <Card title="重置 2FA" className="login-card" style={{ width: 400 }}>
                    {!success ? (
                        <Form layout="vertical" onFinish={onFinish}>
                            <Paragraph>
                                请输入您的登录邮箱。如果不确定使用哪个邮箱，请尝试个人邮箱（接收激活邮件的邮箱）。
                            </Paragraph>
                            <Form.Item
                                name="email"
                                label="邮箱地址"
                                rules={[
                                    { required: true, message: '请输入登录邮箱' },
                                    { type: 'email', message: '请输入有效的邮箱地址' }
                                ]}
                            >
                                <Input prefix={<MailOutlined />} placeholder="请输入邮箱" size="large" />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                                    发送重置邮件
                                </Button>
                            </Form.Item>

                            <div style={{ textAlign: 'center' }}>
                                <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')}>
                                    返回登录
                                </Button>
                            </div>
                        </Form>
                    ) : (
                        <Result
                            status="success"
                            title="重置邮件已发送"
                            subTitle="请检查您的邮箱（包括垃圾邮件文件夹），点击邮件中的链接确认重置 2FA。"
                            extra={[
                                <Button type="primary" key="login" onClick={() => navigate('/login')}>
                                    返回登录
                                </Button>,
                            ]}
                        />
                    )}
                </Card>
            </Content>
        </Layout>
    )
}
