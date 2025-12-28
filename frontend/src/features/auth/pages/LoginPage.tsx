import { useState, useEffect } from 'react'
import { Layout, Card, Spin, message, Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ThunderboltFilled, CloudOutlined, LoadingOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store/useAppStore'
import { useHealth } from '../../../hooks'
import '../../../styles/features/auth/login.css'

const { Header, Content } = Layout

/**
 * 登录页面 - Cloudflare Access 集成版
 * 
 * 用户通过 Cloudflare Access 验证身份后自动建立会话
 * 不再需要输入用户名密码
 */
export function Login() {
    const navigate = useNavigate()
    const { setUserInfo, setToken, isAuthenticated } = useAppStore()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | null>(null)

    const { data: healthData } = useHealth()
    const apiOk = !!healthData?.checks?.db

    // 如果已登录，直接跳转
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/my/center')
        }
    }, [isAuthenticated, navigate])

    // 自动建立 CF Access 会话
    useEffect(() => {
        if (!apiOk) return
        if (isAuthenticated) return

        const establishCfSession = async () => {
            try {
                setLoading(true)
                setError(null)

                // 调用 CF session 端点
                const response = await fetch('/api/v2/auth/cf-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })

                const data = await response.json()

                if (data.success && data.data) {
                    // 会话建立成功
                    setUserInfo(data.data.user)
                    setToken(data.data.token)
                    message.success('登录成功')
                    navigate('/my/center')
                } else {
                    // 会话建立失败
                    setError(data.error || '登录失败')
                    setErrorCode(data.code || null)
                }
            } catch (err: any) {
                console.error('CF session error:', err)
                if (err.message?.includes('CF_ACCESS_REQUIRED')) {
                    // 未通过 CF Access 验证，刷新页面触发 Access 登录
                    window.location.reload()
                } else {
                    setError(err.message || '网络错误')
                }
            } finally {
                setLoading(false)
            }
        }

        establishCfSession()
    }, [apiOk, isAuthenticated, navigate, setUserInfo, setToken])

    // 根据错误类型显示不同内容
    const renderContent = () => {
        if (loading) {
            return (
                <Card className="login-card" style={{ width: 400, textAlign: 'center' }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                    <div style={{ marginTop: 24, color: '#666' }}>
                        <CloudOutlined style={{ marginRight: 8 }} />
                        正在通过 Cloudflare Access 验证身份...
                    </div>
                </Card>
            )
        }

        if (error) {
            if (errorCode === 'EMPLOYEE_NOT_FOUND') {
                return (
                    <Result
                        status="warning"
                        title="未找到员工记录"
                        subTitle={error}
                        extra={[
                            <Button key="retry" type="primary" onClick={() => window.location.reload()}>
                                重试
                            </Button>,
                            <Button key="contact" onClick={() => window.location.href = 'mailto:admin@example.com'}>
                                联系管理员
                            </Button>,
                        ]}
                    />
                )
            }

            if (errorCode === 'EMPLOYEE_INACTIVE') {
                return (
                    <Result
                        status="error"
                        title="账号已停用"
                        subTitle="您的员工记录已停用，请联系管理员"
                        extra={
                            <Button type="primary" onClick={() => window.location.href = 'mailto:admin@example.com'}>
                                联系管理员
                            </Button>
                        }
                    />
                )
            }

            return (
                <Result
                    status="error"
                    title="登录失败"
                    subTitle={error}
                    extra={
                        <Button type="primary" onClick={() => window.location.reload()}>
                            重试
                        </Button>
                    }
                />
            )
        }

        return null
    }

    return (
        <Layout className="login-layout">
            <Header className="login-header">
                <div className="login-header-title">
                    <ThunderboltFilled className="login-header-logo" />
                    <span>AR公司管理系统</span>
                </div>
                <div className="login-header-status">
                    <span className={`status-dot ${apiOk ? 'connected' : 'disconnected'}`}></span>
                    <span>{apiOk ? '已连接' : 'API未连接'}</span>
                </div>
            </Header>
            <Content className="login-content">
                {renderContent()}
            </Content>
        </Layout>
    )
}
