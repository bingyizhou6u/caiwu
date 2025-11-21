import React, { useState } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { authApi } from '../../api/auth'
import { LoginResponse } from '../../types'
import { QRCodeCanvas } from 'qrcode.react'
import { api } from '../../config/api'

interface TwoFactorProps {
    email: string
    password?: string // Optional, might be needed for binding
    hasTotp: boolean
    onSuccess: (data: LoginResponse) => void
}

export const TwoFactor: React.FC<TwoFactorProps> = ({ email, password, hasTotp, onSuccess }) => {
    const [loading, setLoading] = useState(false)
    const [totpData, setTotpData] = useState<any>(null)

    const onGetQr = async () => {
        setLoading(true)
        try {
            const response = await fetch(api.auth.getTotpQr, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            })
            const data = await response.json()
            if (response.ok) {
                setTotpData(data)
            } else {
                message.error(data.error || '获取二维码失败')
            }
        } catch (error: any) {
            message.error('获取二维码失败：' + (error.message || '网络错误'))
        } finally {
            setLoading(false)
        }
    }

    const onSubmit = async (v: any) => {
        setLoading(true)
        try {
            let data: LoginResponse
            if (hasTotp) {
                // Verify and Login
                data = await authApi.login({ email, password, totp: v.totp })
            } else {
                // Bind and Login
                const response = await fetch(api.auth.bindTotpFirst, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, secret: totpData.secret, totp: v.totp }),
                    credentials: 'include'
                })
                data = await response.json()
                if (!response.ok) throw new Error(data.error || '绑定失败')
            }

            onSuccess(data)
            message.success(hasTotp ? '登录成功' : 'Google验证码已绑定，登录成功')
        } catch (error: any) {
            message.error(error.message || '验证失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card title={hasTotp ? "二步验证" : "绑定Google验证码"} style={{ width: 400 }}>
            {!hasTotp && !totpData ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Button type="primary" onClick={onGetQr} loading={loading}>
                        获取二维码
                    </Button>
                </div>
            ) : (
                <Form layout="vertical" onFinish={onSubmit} onFinishFailed={() => message.error('请检查表单填写')}>
                    {!hasTotp && totpData && (
                        <Form.Item>
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <div style={{ marginBottom: 8 }}>请使用Google Authenticator扫描二维码</div>
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: 'white', border: '1px solid #eee', borderRadius: 4 }}>
                                    <QRCodeCanvas value={totpData.otpauthUrl} size={200} />
                                </div>
                            </div>
                        </Form.Item>
                    )}
                    <Form.Item name="totp" label="Google验证码" rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '请输入6位数字验证码' }]}>
                        <Input placeholder="请输入6位验证码" maxLength={6} style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            {hasTotp ? '验证登录' : '绑定验证码'}
                        </Button>
                    </Form.Item>
                </Form>
            )}
        </Card>
    )
}
