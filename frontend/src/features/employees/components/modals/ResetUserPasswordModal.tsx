import { Modal, Alert } from 'antd'
import { withErrorHandler } from '../../../../utils/errorHandler'
import { useResetUserPassword } from '../../../../hooks/business/useEmployees'
import type { Employee } from '../../../../types'

interface ResetUserPasswordModalProps {
    open: boolean
    employee: Employee | null
    onCancel: () => void
    onSuccess: () => void
}

export function ResetUserPasswordModal({ open, employee, onCancel, onSuccess }: ResetUserPasswordModalProps) {
    const { mutateAsync: resetPassword, isPending } = useResetUserPassword()

    const handleOk = withErrorHandler(
        async () => {
            if (!employee?.id) return
            await resetPassword(employee.id)
            onSuccess()
        },
        { successMessage: '重置链接已发送，请通知员工查收邮件' }
    )

    return (
        <Modal
            title={`重置密码 - ${employee?.name}`}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            width={400}
            confirmLoading={isPending}
        >
            <Alert
                type="info"
                showIcon
                message="操作说明"
                description={
                    <>
                        <div>系统将发送<b>密码重置链接</b>至员工邮箱。</div>
                        <div>员工需点击邮件中的链接重置密码，链接有效期为1小时。</div>
                        <div>发送邮箱：{employee?.personalEmail || '未知'}</div>
                    </>
                }
            />
        </Modal>
    )
}
