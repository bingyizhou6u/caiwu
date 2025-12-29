/**
 * 通知下拉面板组件
 * 显示在顶部导航栏的通知图标和下拉列表
 */
import React from 'react'
import { Badge, Button, Dropdown, Empty, List, Spin, Typography } from 'antd'
import { BellOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
    useNotifications,
    useUnreadCount,
    useMarkAsRead,
    useMarkAllAsRead,
    type Notification,
} from '../../hooks/business/useNotifications'
import styles from './NotificationDropdown.module.css'

const { Text } = Typography

// 格式化时间
function formatTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return new Date(timestamp).toLocaleDateString()
}

// 获取通知类型图标颜色
function getTypeColor(type: Notification['type']): string {
    const colors = {
        system: '#1890ff',
        approval: '#52c41a',
        task: '#faad14',
        message: '#722ed1',
    }
    return colors[type] || '#666'
}

// 通知列表项
function NotificationItem({
    notification,
    onRead,
    onNavigate,
}: {
    notification: Notification
    onRead: (id: string) => void
    onNavigate: (link?: string) => void
}) {
    const handleClick = () => {
        if (!notification.isRead) {
            onRead(notification.id)
        }
        if (notification.link) {
            onNavigate(notification.link)
        }
    }

    return (
        <div
            className={`${styles.item} ${notification.isRead ? styles.read : styles.unread}`}
            onClick={handleClick}
        >
            <div className={styles.itemHeader}>
                <span
                    className={styles.typeIndicator}
                    style={{ backgroundColor: getTypeColor(notification.type) }}
                />
                <Text strong={!notification.isRead} className={styles.title}>
                    {notification.title}
                </Text>
            </div>
            {notification.content && (
                <Text type="secondary" className={styles.content} ellipsis>
                    {notification.content}
                </Text>
            )}
            <Text type="secondary" className={styles.time}>
                {formatTime(notification.createdAt)}
            </Text>
        </div>
    )
}

export function NotificationDropdown() {
    const navigate = useNavigate()
    const { data: notifications, isLoading } = useNotifications({ limit: 10 })
    const { data: unreadCount } = useUnreadCount()
    const markAsRead = useMarkAsRead()
    const markAllAsRead = useMarkAllAsRead()

    const handleRead = (id: string) => {
        markAsRead.mutate(id)
    }

    const handleNavigate = (link?: string) => {
        if (link) {
            navigate(link)
        }
    }

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate()
    }

    const dropdownContent = (
        <div className={styles.dropdown}>
            <div className={styles.header}>
                <Text strong>通知</Text>
                {unreadCount && unreadCount > 0 && (
                    <Button
                        type="link"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={handleMarkAllAsRead}
                        loading={markAllAsRead.isPending}
                    >
                        全部已读
                    </Button>
                )}
            </div>
            <div className={styles.list}>
                {isLoading ? (
                    <div className={styles.loading}>
                        <Spin size="small" />
                    </div>
                ) : notifications && notifications.length > 0 ? (
                    <List<Notification>
                        dataSource={notifications}
                        renderItem={(item) => (
                            <NotificationItem
                                key={item.id}
                                notification={item}
                                onRead={handleRead}
                                onNavigate={handleNavigate}
                            />
                        )}
                    />
                ) : (
                    <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
            </div>
        </div>
    )

    return (
        <Dropdown
            dropdownRender={() => dropdownContent}
            trigger={['click']}
            placement="bottomRight"
        >
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 18 }} />}
                    className={styles.trigger}
                />
            </Badge>
        </Dropdown>
    )
}
