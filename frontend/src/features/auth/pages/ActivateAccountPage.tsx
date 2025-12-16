import { Card, Form, Input, Button, message, Typography, Space, Spin, Result, Steps, Alert } from 'antd'
import { LockOutlined, CheckCircleOutlined, SafetyOutlined, MobileOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../../config/api'
import { useAppStore } from '../../../store/useAppStore'

const { Title, Text } = Typography

interface TotpData {
    secret: string
    qrCode: string
}

export function ActivateAccount() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const navigate = useNavigate()
    const [form] = Form.useForm()
    const { setUserInfo, setToken } = useAppStore()

    const [verifying, setVerifying] = useState(true)
    const [valid, setValid] = useState(false)
    const [email, setEmail] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // TOTP 状态
    const [step, setStep] = useState(0) // 0: 设置密码, 1: 绑定验证器
    const [password, setPassword] = useState('')
    const [totpData, setTotpData] = useState<TotpData | null>(null)
    const [loadingQr, setLoadingQr] = useState(false)

    useEffect(() => {
        if (!token) {
            setVerifying(false)
            setValid(false)
            setErrorMsg('激活链接无效：缺少令牌')
            return
        }
        verifyToken(token)
    }, [token])

    const verifyToken = async (t: string) => {
        try {
            const res = await fetch(`${api.auth.verifyActivation}?token=${t}`)
            const data = await res.json()
            if (res.ok && data.valid) {
                setValid(true)
                setEmail(data.email)
            } else {
                setValid(false)
                setErrorMsg(data.error?.message || data.message || '激活链接无效或已过期')
            }
        } catch (error) {
            console.error('Verify error:', error)
            setErrorMsg('验证失败，请稍后重试')
        } finally {
            setVerifying(false)
        }
    }

    const handlePasswordSubmit = async (values: { newPassword: string }) => {
        setPassword(values.newPassword)
        setLoadingQr(true)

        // 生成 TOTP 密钥和二维码
        try {
            const res = await fetch(api.auth.generateTotpForActivation, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            const data = await res.json()

            if (data.secret && data.qrCode) {
                setTotpData(data)
                setStep(1)
            } else {
                // 若未启用 2FA，直接激活
                await activateWithoutTotp(values.newPassword)
            }
        } catch (error) {
            console.error('Get TOTP QR error:', error)
            // 若获取二维码失败，尝试不带 TOTP 激活（可能未启用 2FA）
            await activateWithoutTotp(values.newPassword)
        } finally {
            setLoadingQr(false)
        }
    }

    const activateWithoutTotp = async (pwd: string) => {
        if (!token) return
        setSubmitting(true)
        try {
            const res = await fetch(api.auth.activate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: pwd
                })
            })
            const data = await res.json()

            if (res.ok && data.ok) {
                setUserInfo(data.user)
                setToken(data.token)
                message.success('账号激活成功！正在跳转...')
                setTimeout(() => {
                    navigate('/dashboard')
                }, 1500)
            } else {
                const msg = data.error || '激活失败，请联系管理员'
                message.error(msg)
            }
        } catch (error) {
            message.error('网络连接失败，请检查您的网络')
        } finally {
            setSubmitting(false)
        }
    }

    const handleTotpSubmit = async (values: { totpCode: string }) => {
        if (!token || !totpData) return
        setSubmitting(true)
        try {
            const res = await fetch(api.auth.activate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password,
                    totpSecret: totpData.secret,
                    totpCode: values.totpCode
                })
            })
            const data = await res.json()

            if (res.ok && data.ok) {
                setUserInfo(data.user)
                setToken(data.token)
                message.success('账号激活成功！正在跳转...')
                setTimeout(() => {
                    navigate('/dashboard')
                }, 1500)
            } else {
                const msg = data.error || '激活失败，请联系管理员'
                message.error(msg)
            }
        } catch (error) {
            message.error('网络连接失败，请检查您的网络')
        } finally {
            setSubmitting(false)
        }
    }

    if (verifying) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
                <Spin tip="正在验证激活链接..." size="large" />
            </div>
        )
    }

    if (!valid) {
        return (
            <div style={{ maxWidth: 480, margin: '40px auto', padding: 20 }}>
                <Result
                    status="error"
                    title="激活失败"
                    subTitle={errorMsg}
                    extra={[
                        <Button type="primary" key="login" onClick={() => navigate('/login')}>
                            返回登录
                        </Button>
                    ]}
                />
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 520, margin: '40px auto' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                    <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>激活账号</Title>
                    <Text type="secondary">您好，{email}</Text>
                </div>

                <Steps
                    current={step}
                    size="small"
                    style={{ marginBottom: 32 }}
                    items={[
                        { title: '设置密码', icon: <LockOutlined /> },
                        { title: '绑定验证器', icon: <SafetyOutlined /> },
                    ]}
                />

                {step === 0 && (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handlePasswordSubmit}
                        autoComplete="off"
                    >
                        <Form.Item
                            name="newPassword"
                            label="设置登录密码"
                            rules={[
                                { required: true, message: '请输入新密码' },
                                { min: 6, message: '密码长度至少6位' }
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="请输入新密码（至少6位）"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="确认密码"
                            dependencies={['newPassword']}
                            rules={[
                                { required: true, message: '请确认新密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve()
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致'))
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="请再次输入新密码"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item style={{ marginTop: 32 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loadingQr}
                                size="large"
                                block
                            >
                                下一步：绑定验证器
                            </Button>
                        </Form.Item>
                    </Form>
                )}

                {step === 1 && totpData && (
                    <Form
                        layout="vertical"
                        onFinish={handleTotpSubmit}
                        autoComplete="off"
                    >
                        <Alert
                            type="info"
                            showIcon
                            message="请使用 Google Authenticator 扫描二维码"
                            description="扫描后，应用会显示一个6位验证码，请在下方输入"
                            style={{ marginBottom: 24 }}
                        />

                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <img
                                src={totpData.qrCode}
                                alt="TOTP QR Code"
                                style={{
                                    width: 200,
                                    height: 200,
                                    background: '#fff',
                                    padding: 8,
                                    borderRadius: 8,
                                    border: '1px solid #d9d9d9'
                                }}
                            />
                        </div>

                        <Form.Item
                            name="totpCode"
                            label="验证码"
                            rules={[
                                { required: true, message: '请输入 Google 验证码' },
                                { pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }
                            ]}
                        >
                            <Input
                                prefix={<MobileOutlined />}
                                placeholder="请输入6位验证码"
                                size="large"
                                maxLength={6}
                                style={{ textAlign: 'center', letterSpacing: 8, fontSize: 18 }}
                            />
                        </Form.Item>

                        <Space style={{ width: '100%', marginTop: 24 }} direction="vertical">
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                size="large"
                                block
                            >
                                完成激活
                            </Button>
                            <Button
                                size="large"
                                block
                                onClick={() => setStep(0)}
                            >
                                返回修改密码
                            </Button>
                        </Space>
                    </Form>
                )}
            </Card>
        </div>
    )
}
