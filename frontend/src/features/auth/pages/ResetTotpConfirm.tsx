import { useState, useEffect } from 'react'
import { Layout, Card, Button, Result, Spin, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ThunderboltFilled } from '@ant-design/icons'
import { api as apiClient } from '../../../api/http'
import { api } from '../../../config/api'
import './Login.css'

const { Header, Content } = Layout

export function ResetTotpConfirm() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [verifying, setVerifying] = useState(true)
    const [valid, setValid] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!token) {
            setVerifying(false)
            return
        }
        verifyToken()
    }, [token])

    const verifyToken = async () => {
        try {
            if (!token) return
            // 手动拼接查询参数，因为 RequestOptions 可能不支持 'params'
            await apiClient.get(`${api.auth.verifyTotpResetToken}?token=${token}`)
            setValid(true)
        } catch (error) {
            setValid(false)
        } finally {
            setVerifying(false)
        }
    }

    const handleConfirm = async () => {
        setConfirming(true)
        try {
            if (!token) return
            await apiClient.post(api.auth.confirmTotpReset, { token })
            setSuccess(true)
            message.success('2FA 已重置，请使用密码登录')
        } catch (error: any) {
            const msg = error.message || '重置失败，请联系管理员'
            message.error(msg)
        } finally {
            setConfirming(false)
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
                <Card className="login-card" style={{ width: 400 }}>
                    {verifying ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <Spin size="large" tip="验证链接中..." />
                        </div>
                    ) : !valid ? (
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
                    ) : !success ? (
                        <Result
                            status="warning"
                            title="确认重置 2FA？"
                            subTitle="此操作将移除您账号当前绑定的 Google 验证码。如果您找回了旧设备，之前的验证码将失效。"
                            extra={[
                                <Button type="primary" danger key="confirm" loading={confirming} onClick={handleConfirm} size="large">
                                    确认重置
                                </Button>,
                                <Button key="cancel" onClick={() => navigate('/login')}>
                                    取消
                                </Button>,
                            ]}
                        />
                    ) : (
                        <Result
                            status="success"
                            title="重置成功"
                            subTitle="您的 2FA 已被移除，现在您可以仅使用密码登录。"
                            extra={[
                                <Button type="primary" key="login" onClick={() => navigate('/login')}>
                                    前往登录
                                </Button>,
                            ]}
                        />
                    )}
                </Card>
            </Content>
        </Layout>
    )
}
