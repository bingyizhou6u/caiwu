import React, { useState } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { authApi } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { LoginResponse } from '../../types'

interface LoginProps {
    onSuccess: (data: LoginResponse, email: string, password: string) => void
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false)
    const [apiOk, setApiOk] = useState(true) // Assume OK for now or pass as prop

    const onLogin = async (v: any) => {
        setLoading(true)
        try {
            const payload = {
                email: v.email.trim(),
                password: v.password
            }
            const data = await authApi.login(payload)
            onSuccess(data, payload.email, payload.password)
        } catch (error: any) {
            message.error(error.message || '登录失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card title="登录" style={{ width: 360 }}>
            <Form layout="vertical" onFinish={onLogin} onFinishFailed={() => message.error('请检查表单填写')}>
                <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                    <Input placeholder="请输入邮箱地址" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password placeholder="请输入密码" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} disabled={!apiOk} block>
                        登录
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    )
}
