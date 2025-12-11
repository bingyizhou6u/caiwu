import { useState } from 'react'
import { Button, Tooltip } from 'antd'
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { usePermissions } from '../utils/permissions'
import { useCreateAuditLog } from '../hooks/business/useAuditLogs'

interface Props {
    value: string | number
    permission?: string
    maskPattern?: string
    type?: 'salary' | 'phone' | 'address' | 'default'
    entityId?: string
    entityType?: string
}

export function SensitiveField({
    value,
    permission,
    maskPattern = '****',
    type = 'default',
    entityId,
    entityType
}: Props) {
    const [visible, setVisible] = useState(false)
    const { hasPermission } = usePermissions()
    const { mutate: logAudit } = useCreateAuditLog()

    // 检查权限
    // 如果没有提供permission prop，则默认允许查看（或者根据业务需求默认禁止）
    // 这里假设没有permission prop意味着不需要特殊权限，或者由父组件控制
    const parts = permission ? permission.split('.') : []
    const canView = !permission || hasPermission(parts[0], parts[1], parts[2])

    if (!canView) {
        return <span style={{ color: '#999' }}>—— 无权查看 ——</span>
    }

    // 生成脱敏值
    const getMaskedValue = () => {
        const strValue = String(value)

        switch (type) {
            case 'salary':
                return '****.**'
            case 'phone':
                return strValue.replace(/(\+\d{1,4})(\d+)/, '$1****')
            case 'address':
                if (strValue.length <= 10) return maskPattern
                const parts = strValue.split('')
                return strValue.slice(0, 6) + '****' + strValue.slice(-4)
            default:
                return maskPattern
        }
    }

    const displayValue = visible ? value : getMaskedValue()

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>{displayValue}</span>
            <Tooltip title={visible ? '隐藏' : '显示'}>
                <Button
                    type="text"
                    size="small"
                    icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => {
                        const newVisible = !visible
                        setVisible(newVisible)
                        if (newVisible && entityId && entityType) {
                            logAudit({
                                action: 'view_sensitive_data',
                                entity: entityType,
                                entityId: entityId,
                                detail: `Viewed ${type} data`,
                            })
                        }
                    }}
                />
            </Tooltip>
        </span>
    )
}
