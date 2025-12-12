import { Modal } from 'antd'
import { ExclamationCircleFilled } from '@ant-design/icons'

const { confirm } = Modal

interface DeleteConfirmOptions {
    title?: string
    content?: string
    onConfirm: () => Promise<void> | void
    okText?: string
    cancelText?: string
}

export function useDeleteConfirm() {
    const showDeleteConfirm = (options: DeleteConfirmOptions) => {
        const {
            title = '确认删除',
            content = '此操作不可恢复，确定要继续吗？',
            onConfirm,
            okText = '删除',
            cancelText = '取消'
        } = options

        confirm({
            title,
            icon: <ExclamationCircleFilled />,
            content,
            okText,
            okType: 'danger',
            cancelText,
            onOk: async () => {
                await onConfirm()
            },
        })
    }

    return {
        showDeleteConfirm
    }
}
