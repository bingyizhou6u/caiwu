import { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, message, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ThunderboltFilled } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { useAppStore } from '../../../store/useAppStore'
import './Login.css'

const { Header, Content } = Layout

export function Login() {
    const navigate = useNavigate()
    const { setUserInfo, setToken, isAuthenticated } = useAppStore()

    const [loading, setLoading] = useState(false)
    const [loginStep, setLoginStep] = useState<'login' | 'changePassword' | 'twoFactor'>('login')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [totpData, setTotpData] = useState<any>(null)
    const [hasTotp, setHasTotp] = useState(false)
    const [apiOk, setApiOk] = useState(false)

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard')
        }
    }, [isAuthenticated, navigate])

    useEffect(() => {
        apiClient.get<any>(api.health).then(d => setApiOk(!!d.db)).catch(() => setApiOk(false))
    }, [])

    const onLogin = async (v: any) => {
        if (!v?.email || typeof v.email !== 'string') return message.error('请输入有效邮箱')
        if (!v?.password) return message.error('请输入密码')
        setLoading(true)
        try {
            const payload = {
                email: v.email.trim(),
                password: v.password
            }
            const data = await apiClient.post<any>(api.auth.loginPassword, payload)

            if (data.mustChangePassword) {
                setLoginEmail(v.email.trim())
                setLoginPassword(v.password)
                setLoginStep('changePassword')
                message.info('首次登录，请修改密码')
            } else if (data.needBindTotp) {
                setLoginEmail(v.email.trim())
                setLoginPassword(v.password)
                setHasTotp(false)
                setLoginStep('twoFactor')
                message.info('请绑定Google验证码')
            } else if (data.needTotp) {
                setLoginEmail(v.email.trim())
                setLoginPassword(v.password)
                setHasTotp(true)
                setLoginStep('twoFactor')
                message.info('请输入Google验证码')
            } else {
                // Login Success
                setUserInfo(data.user)
                setToken(data.token)
                message.success('登录成功')
                navigate('/dashboard')
            }
        } catch (error: any) {
            message.error('登录失败：' + (error.message || '网络错误'))
        } finally {
            setLoading(false)
        }
    }

    const onChangePassword = async (v: any) => {
        if (!v?.oldPassword || !v?.newPassword) return message.error('请输入密码')
        if (v.newPassword.length < 6) return message.error('密码至少6位')
        setLoading(true)
        try {
            await apiClient.post(api.auth.changePasswordFirst, {
                email: loginEmail,
                oldPassword: v.oldPassword,
                newPassword: v.newPassword
            })

            setLoginPassword(v.newPassword)
            setLoginStep('twoFactor')
            setHasTotp(false)
            message.success('密码已修改，请完成二步验证')
        } catch (error: any) {
            message.error('修改密码失败：' + (error.message || '网络错误'))
        } finally {
            setLoading(false)
        }
    }

    const onTwoFactor = async (v: any) => {
        if (!v?.totp || v.totp.length !== 6) return message.error('请输入6位验证码')
        setLoading(true)
        try {
            if (!hasTotp && !totpData) {
                // Get QR Code
                const qrData = await apiClient.post<any>(api.auth.getTotpQr, { email: loginEmail, password: loginPassword })
                setTotpData(qrData)
                message.info('请先扫描二维码')
                setLoading(false)
                return
            }

            if (hasTotp) {
                // Verify TOTP
                const data = await apiClient.post<any>(api.auth.loginPassword, { email: loginEmail, password: loginPassword, totp: v.totp })
                setUserInfo(data.user)
                setToken(data.token)
                message.success('登录成功')
                navigate('/dashboard')
            } else {
                // Bind TOTP
                const data = await apiClient.post<any>(api.auth.bindTotpFirst, { email: loginEmail, password: loginPassword, secret: totpData.secret, totp: v.totp })
                setUserInfo(data.user)
                setToken(data.token)
                message.success('Google验证码已绑定，登录成功')
                navigate('/dashboard')
            }
        } catch (error: any) {
            message.error('操作失败：' + (error.message || '网络错误'))
        } finally {
            setLoading(false)
        }
    }

    const loadTotpStatus = async () => {
        if (loginStep !== 'twoFactor' || !loginEmail || !loginPassword) return
        try {
            const data = await apiClient.post<any>(api.auth.loginPassword, { email: loginEmail, password: loginPassword }, { skipErrorHandle: true })

            if (data.needBindTotp) {
                setHasTotp(false)
            } else if (data.needTotp) {
                setHasTotp(true)
            }
        } catch (error: any) {
            if (error.message === 'Google验证码必填') {
                setHasTotp(true)
            }
        }
    }

    useEffect(() => {
        if (loginStep === 'twoFactor') {
            loadTotpStatus()
        }
    }, [loginStep])

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
                {loginStep === 'login' ? (
                    <Card title="登录" className="login-card" style={{ width: 400 }}>
                        <Form layout="vertical" onFinish={onLogin} onFinishFailed={() => message.error('请检查表单填写')}>
                            <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                                <Input placeholder="请输入邮箱地址" />
                            </Form.Item>
                            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                                <Input.Password placeholder="请输入密码" />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                                <Button type="primary" htmlType="submit" loading={loading} disabled={!apiOk} block>
                                    登录
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                ) : loginStep === 'changePassword' ? (
                    <Card title="首次登录 - 修改密码" className="login-card" style={{ width: 400 }}>
                        <Form layout="vertical" onFinish={onChangePassword} onFinishFailed={() => message.error('请检查表单填写')}>
                            <Form.Item>
                                <div className="login-info-text">
                                    邮箱：<strong>{loginEmail}</strong>
                                </div>
                            </Form.Item>
                            <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                                <Input.Password placeholder="请输入管理员设置的初始密码" />
                            </Form.Item>
                            <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
                                <Input.Password placeholder="请输入新密码（至少6位）" />
                            </Form.Item>
                            <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[
                                { required: true, message: '请确认新密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve()
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致'))
                                    },
                                }),
                            ]}>
                                <Input.Password placeholder="请再次输入新密码" />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                                <Button type="primary" htmlType="submit" loading={loading} disabled={!apiOk} block>
                                    修改密码
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                ) : (
                    <Card title={hasTotp ? "二步验证" : "绑定Google验证码"} className="login-card" style={{ width: 420 }}>
                        {!hasTotp && !totpData ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <Button type="primary" onClick={async () => {
                                    setLoading(true)
                                    try {
                                        const data = await apiClient.post<any>(api.auth.getTotpQr, { email: loginEmail, password: loginPassword })
                                        setTotpData(data)
                                    } catch (error: any) {
                                        message.error('获取二维码失败：' + (error.message || '网络错误'))
                                    } finally {
                                        setLoading(false)
                                    }
                                }} loading={loading} disabled={!apiOk}>
                                    获取二维码
                                </Button>
                            </div>
                        ) : (
                            <Form layout="vertical" onFinish={onTwoFactor} onFinishFailed={() => message.error('请检查表单填写')}>
                                {!hasTotp && totpData && (
                                    <Form.Item>
                                        <div className="qr-code-container">
                                            <div className="qr-code-hint">请使用Google Authenticator扫描二维码</div>
                                            <img src={totpData.qrCode} alt="QR Code" style={{ width: 200, height: 200 }} />
                                        </div>
                                    </Form.Item>
                                )}
                                <Form.Item name="totp" label="Google验证码" rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '请输入6位数字验证码' }]}>
                                    <Input placeholder="请输入6位验证码" maxLength={6} className="totp-input" />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} disabled={!apiOk} block>
                                        {hasTotp ? '验证登录' : '绑定验证码'}
                                    </Button>
                                </Form.Item>
                            </Form>
                        )}
                    </Card>
                )}
            </Content>
        </Layout>
    )
}
