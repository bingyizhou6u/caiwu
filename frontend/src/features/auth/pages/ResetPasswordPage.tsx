
import { Card, Form, Input, Button, message, Typography, Spin, Result } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../../config/api'

const { Title, Text } = Typography

export function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const navigate = useNavigate()
    const [form] = Form.useForm()

    const [verifying, setVerifying] = useState(true)
    const [valid, setValid] = useState(false)
    const [email, setEmail] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!token) {
            setVerifying(false)
            setValid(false)
            setErrorMsg('链接无效：缺少令牌')
            return
        }
        verifyToken(token)
    }, [token])

    const verifyToken = async (t: string) => {
        try {
            const res = await fetch(`${api.auth.verifyResetToken}?token=${t}`)
            const data = await res.json()
            if (res.ok && data.valid) {
                setValid(true)
                setEmail(data.email)
            } else {
                setValid(false)
                setErrorMsg(data.error?.message || data.message || '链接无效或已过期')
            }
        } catch (error) {
            console.error('Verify error:', error)
            setErrorMsg('验证失败，请稍后重试')
        } finally {
            setVerifying(false)
        }
    }

    const handleSubmit = async (values: { newPassword: string }) => {
        if (!token) return
        setSubmitting(true)
        try {
            const res = await fetch(api.auth.resetPassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: values.newPassword
                })
            })
            const data = await res.json()

            if (res.ok && data.ok) {
                message.success('密码重置成功！正在跳转...')
                setTimeout(() => {
                    navigate('/my/center')
                }, 1500)
            } else {
                const msg = data.error || '重置失败，请重试'
                message.error(msg)
            }
        } catch (error) {
            console.error('Reset error:', error)
            message.error('网络连接失败，请检查您的网络')
        } finally {
            setSubmitting(false)
        }
    }

    if (verifying) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
                <Spin tip="正在验证链接..." size="large" />
            </div>
        )
    }

    if (!valid) {
        return (
            <div style={{ maxWidth: 480, margin: '40px auto', padding: 20 }}>
                <Result
                    status="error"
                    title="链接无效"
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
        <div style={{ maxWidth: 480, margin: '40px auto' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <LockOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>重置密码</Title>
                    <Text type="secondary">为账号 {email} 设置新密码</Text>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    autoComplete="off"
                >
                    <Form.Item
                        name="newPassword"
                        label="新密码"
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
                            loading={submitting}
                            size="large"
                            block
                        >
                            重置并登录
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    )
}
