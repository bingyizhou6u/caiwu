import React, { useState } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { authApi } from '../../api/auth'

interface ChangePasswordProps {
    email: string
    onSuccess: (newPassword: string) => void
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ email, onSuccess }) => {
    const [loading, setLoading] = useState(false)

    const onChangePassword = async (v: any) => {
        setLoading(true)
        try {
            await authApi.changePasswordFirst({
                email,
                oldPassword: v.oldPassword,
                newPassword: v.newPassword
            })
            message.success('密码已修改，请完成二步验证')
            onSuccess(v.newPassword)
        } catch (error: any) {
            message.error(error.message || '修改密码失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card title="首次登录 - 修改密码" style={{ width: 360 }}>
            <Form layout="vertical" onFinish={onChangePassword} onFinishFailed={() => message.error('请检查表单填写')}>
                <Form.Item>
                    <div style={{ marginBottom: 16, color: '#666' }}>
                        邮箱：<strong>{email}</strong>
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
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block>
                        修改密码
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    )
}
