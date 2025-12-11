import { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, message } from 'antd'
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
    const [loginStep, setLoginStep] = useState<'login' | 'totp'>('login')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
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
        if (!v?.email || typeof v.email !== 'string') return message.error('请输入有效的邮箱地址')
        if (!v?.password) return message.error('请输入密码')
        setLoading(true)
        try {
            const payload = {
                email: v.email.trim(),
                password: v.password
            }
            const data = await apiClient.post<any>(api.auth.loginPassword, payload)

            if (data.needTotp) {
                // 用户需验证 TOTP
                setLoginEmail(v.email.trim())
                setLoginPassword(v.password)
                setLoginStep('totp')
                message.info('请输入 Google 验证码')
            } else {
                // 登录成功
                setUserInfo(data.user)
                setToken(data.token)
                message.success('登录成功')
                navigate('/dashboard')
            }
        } catch (error: any) {
            // 使用标准消息或后端返回的消息
            const msg = error.message || '网络连接失败，请检查您的网络'
            message.error(msg)
        } finally {
            setLoading(false)
        }
    }

    const onTotp = async (v: any) => {
        if (!v?.totp || v.totp.length !== 6) return message.error('请输入 6 位数字验证码')
        setLoading(true)
        try {
            const data = await apiClient.post<any>(api.auth.loginPassword, {
                email: loginEmail,
                password: loginPassword,
                totp: v.totp
            })
            setUserInfo(data.user)
            setToken(data.token)
            message.success('登录成功')
            navigate('/dashboard')
        } catch (error: any) {
            const msg = error.message === 'Google验证码错误' ? '验证码错误或已失效，请重试' : (error.message || '网络连接失败，请检查您的网络')
            message.error(msg)
        } finally {
            setLoading(false)
        }
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
                {loginStep === 'login' ? (
                    <Card title="登录" className="login-card" style={{ width: 400 }}>
                        <Form layout="vertical" onFinish={onLogin} onFinishFailed={() => message.error('请检查表单填写')}>
                            <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入登录邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
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
                ) : (
                    <Card title="二步验证" className="login-card" style={{ width: 400 }}>
                        <Form layout="vertical" onFinish={onTotp} onFinishFailed={() => message.error('请检查表单填写')}>
                            <Form.Item name="totp" label="Google验证码" rules={[{ required: true, message: '请输入 Google 验证码' }, { pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }]}>
                                <Input
                                    placeholder="请输入6位验证码"
                                    maxLength={6}
                                    className="totp-input"
                                    style={{ textAlign: 'center', letterSpacing: 8, fontSize: 18 }}
                                />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                                <Button type="primary" htmlType="submit" loading={loading} disabled={!apiOk} block>
                                    验证登录
                                </Button>
                            </Form.Item>
                            <Form.Item style={{ marginTop: 16 }}>
                                <Button block onClick={() => setLoginStep('login')}>
                                    返回登录
                                </Button>
                                <Button type="link" block onClick={() => navigate('/auth/request-totp-reset')} style={{ marginTop: 8 }}>
                                    2FA设备丢失？
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                )}
            </Content>
        </Layout>
    )
}
