import { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, message } from 'antd'
import type { FormProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ThunderboltFilled } from '@ant-design/icons'
import { useAppStore } from '../../../store/useAppStore'
import { useHealth, useLogin } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import '../../../styles/features/auth/login.css'

const { Header, Content } = Layout

// localStorage key
const CACHED_EMAIL_KEY = 'caiwu_login_email'

// 表单值类型定义
interface LoginFormValues {
  email: string
  password: string
}

interface TotpFormValues {
  totp: string
}

export function Login() {
    const navigate = useNavigate()
    const { setUserInfo, setToken, isAuthenticated } = useAppStore()

    const [loginStep, setLoginStep] = useState<'login' | 'totp'>('login')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [form] = Form.useForm<LoginFormValues>()

    const { data: healthData } = useHealth()
    const apiOk = !!healthData?.checks?.db

    const { mutateAsync: login, isPending: loading } = useLogin()

    // 加载缓存的邮箱地址
    useEffect(() => {
        const cachedEmail = localStorage.getItem(CACHED_EMAIL_KEY)
        if (cachedEmail) {
            form.setFieldsValue({ email: cachedEmail })
        }
    }, [form])

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard')
        }
    }, [isAuthenticated, navigate])

    const onLogin: FormProps<LoginFormValues>['onFinish'] = withErrorHandler(
        async (v) => {
            if (!v?.email || typeof v.email !== 'string') {
                message.error('请输入有效的邮箱地址')
                return
            }
            if (!v?.password) {
                message.error('请输入密码')
                return
            }
            
            const email = v.email.trim()
            // 保存邮箱地址到缓存
            localStorage.setItem(CACHED_EMAIL_KEY, email)
            
            const payload = {
                email,
                password: v.password
            }
            const data = await login(payload)

            if (data.needTotp) {
                // 用户需验证 TOTP
                setLoginEmail(email)
                setLoginPassword(v.password)
                setLoginStep('totp')
                message.info('请输入 Google 验证码')
            } else {
                // 登录成功
                setUserInfo(data.user as unknown as Parameters<typeof setUserInfo>[0])
                setToken(data.token ?? null)
                message.success('登录成功')
                navigate('/dashboard')
            }
        },
        {
            showSuccess: false, // 登录成功消息已手动处理
            errorMessage: '网络连接失败，请检查您的网络'
        }
    )

    const onTotp: FormProps<TotpFormValues>['onFinish'] = withErrorHandler(
        async (v) => {
            if (!v?.totp || v.totp.length !== 6) {
                message.error('请输入 6 位数字验证码')
                return
            }
            
            const data = await login({
                email: loginEmail,
                password: loginPassword,
                totp: v.totp
            })
            setUserInfo(data.user as unknown as Parameters<typeof setUserInfo>[0])
            setToken(data.token ?? null)
            message.success('登录成功')
            navigate('/dashboard')
        },
        {
            showSuccess: false, // 登录成功消息已手动处理
            errorMessage: '验证码错误或已失效，请重试',
            onError: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : '网络连接失败，请检查您的网络'
                const msg = errorMessage === 'Google验证码错误' ? '验证码错误或已失效，请重试' : errorMessage
                message.error(msg)
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
                <div className="login-header-status">
                    <span className={`status-dot ${apiOk ? 'connected' : 'disconnected'}`}></span>
                    <span>{apiOk ? '已连接' : 'API未连接'}</span>
                </div>
            </Header>
            <Content className="login-content">
                {loginStep === 'login' ? (
                    <Card title="登录" className="login-card" style={{ width: 400 }}>
                        <Form form={form} layout="vertical" onFinish={onLogin} onFinishFailed={() => message.error('请检查表单填写')}>
                            <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入登录邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
                                <Input 
                                    placeholder="请输入邮箱地址" 
                                    onBlur={(e) => {
                                        // 失去焦点时保存邮箱地址到缓存
                                        const email = e.target.value.trim()
                                        if (email) {
                                            localStorage.setItem(CACHED_EMAIL_KEY, email)
                                        }
                                    }}
                                />
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
