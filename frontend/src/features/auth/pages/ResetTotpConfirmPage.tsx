import { useState, useEffect } from 'react'
import { Layout, Card, Button, Result, Spin, message, Form, Input, Space } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ThunderboltFilled, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useVerifyTotpResetToken, useGenerateTotpRebind, useConfirmTotpRebind } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import '../../../styles/features/auth/login.css'

const { Header, Content } = Layout

type Step = 'verifying' | 'invalid' | 'confirm' | 'rebind' | 'success'

export function ResetTotpConfirm() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [step, setStep] = useState<Step>('verifying')
    const [totpData, setTotpData] = useState<{ secret: string; qrCode: string; email: string } | null>(null)

    const { mutateAsync: verifyToken } = useVerifyTotpResetToken()
    const { mutateAsync: generateRebind, isPending: generating } = useGenerateTotpRebind()
    const { mutateAsync: confirmRebind, isPending: confirming } = useConfirmTotpRebind()

    useEffect(() => {
        if (!token) {
            setStep('invalid')
            return
        }
        handleVerifyToken()
    }, [token])

    const handleVerifyToken = withErrorHandler(
        async () => {
            if (!token) return
            await verifyToken(token)
            setStep('confirm')
        },
        {
            showSuccess: false,
            showError: false,
            onError: () => {
                setStep('invalid')
            },
        }
    )

    const handleConfirm = withErrorHandler(
        async () => {
            if (!token) return
            const data = await generateRebind(token)
            setTotpData(data)
            setStep('rebind')
        },
        {
            showSuccess: false,
            errorMessage: '生成验证码失败，请重试'
        }
    )

    const handleRebind = withErrorHandler(
        async (values: { totpCode: string }) => {
            if (!token || !totpData) return
            await confirmRebind({
                token,
                secret: totpData.secret,
                totpCode: values.totpCode,
            })
            setStep('success')
            message.success('2FA 重新绑定成功！')
        },
        {
            showSuccess: false,
            errorMessage: '验证码错误，请重试'
        }
    )

    const renderContent = () => {
        switch (step) {
            case 'verifying':
                return (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size="large" tip="验证链接中..." />
                    </div>
                )

            case 'invalid':
                return (
                    <Result
                        status="error"
                        title="无效的链接"
                        subTitle="该重置链接无效或已过期，请重新请求。"
                        extra={[
                            <Button type="primary" key="retry" onClick={() => navigate('/auth/request-totp-reset')}>
                                重新发送
                            </Button>,
                            <Button key="login" onClick={() => navigate('/login')}>
                                返回登录
                            </Button>,
                        ]}
                    />
                )

            case 'confirm':
                return (
                    <Result
                        status="warning"
                        title="重置并重新绑定 2FA"
                        subTitle="点击确认后，您将扫描新的二维码来绑定新的验证器。旧的验证器将失效。"
                        extra={[
                            <Button
                                type="primary"
                                key="confirm"
                                loading={generating}
                                onClick={handleConfirm}
                                size="large"
                                icon={<QrcodeOutlined />}
                            >
                                确认并生成新二维码
                            </Button>,
                            <Button key="cancel" onClick={() => navigate('/login')}>
                                取消
                            </Button>,
                        ]}
                    />
                )

            case 'rebind':
                return (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ marginBottom: 16 }}>扫描二维码绑定新验证器</h3>
                        <p style={{ color: '#666', marginBottom: 16 }}>
                            账号: {totpData?.email}
                        </p>
                        {totpData?.qrCode && (
                            <div style={{ marginBottom: 24 }}>
                                <img
                                    src={totpData.qrCode}
                                    alt="TOTP QR Code"
                                    style={{ width: 200, height: 200, border: '1px solid #eee', borderRadius: 8 }}
                                />
                            </div>
                        )}
                        <div style={{
                            background: '#f5f5f5',
                            padding: '8px 16px',
                            borderRadius: 4,
                            marginBottom: 24,
                            fontSize: 12,
                            wordBreak: 'break-all'
                        }}>
                            <span style={{ color: '#999' }}>手动输入密钥: </span>
                            <code>{totpData?.secret}</code>
                        </div>
                        <Form onFinish={handleRebind} layout="vertical">
                            <Form.Item
                                name="totpCode"
                                label="输入验证码"
                                rules={[
                                    { required: true, message: '请输入验证码' },
                                    { pattern: /^\d{6}$/, message: '请输入6位数字' }
                                ]}
                            >
                                <Input
                                    placeholder="输入6位验证码"
                                    maxLength={6}
                                    style={{ textAlign: 'center', letterSpacing: 8, fontSize: 18 }}
                                />
                            </Form.Item>
                            <Space style={{ width: '100%' }} direction="vertical">
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={confirming}
                                    block
                                    size="large"
                                    icon={<CheckCircleOutlined />}
                                >
                                    确认绑定
                                </Button>
                                <Button block onClick={() => navigate('/login')}>
                                    取消
                                </Button>
                            </Space>
                        </Form>
                    </div>
                )

            case 'success':
                return (
                    <Result
                        status="success"
                        title="绑定成功"
                        subTitle="您的 2FA 已重新绑定，现在可以使用新的验证器登录。"
                        extra={[
                            <Button type="primary" key="login" onClick={() => navigate('/login')}>
                                前往登录
                            </Button>,
                        ]}
                    />
                )
        }
    }

    return (
        <Layout className="login-layout">
            <Header className="login-header">
                <div className="login-header-title">
                    <ThunderboltFilled className="login-header-logo" />
                    <span>AR公司管理系统</span>
                </div>
            </Header>
            <Content className="login-content">
                <Card className="login-card" style={{ width: 420 }}>
                    {renderContent()}
                </Card>
            </Content>
        </Layout>
    )
}
