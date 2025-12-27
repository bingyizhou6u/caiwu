/**
 * 统计卡片组件
 * 封装 Ant Design Card + Statistic，提供统一的悬浮效果和无障碍支持
 * 
 * @example
 * <StatCard
 *   title="我的工时"
 *   value={myTotalHours}
 *   suffix="h"
 *   icon={<ClockCircleOutlined />}
 *   color="#1890ff"
 * />
 */

import { ReactNode } from 'react'
import { Card, Statistic } from 'antd'
import styles from './StatCard.module.css'

export interface StatCardProps {
    /** 统计标题 */
    title: string
    /** 统计值 */
    value: string | number
    /** 后缀，如 "h"、"%" */
    suffix?: string
    /** 前缀图标 */
    icon?: ReactNode
    /** 值的颜色 */
    color?: string
    /** 是否启用悬浮效果，默认 true */
    hoverable?: boolean
    /** 自定义类名 */
    className?: string
    /** 自定义样式 */
    style?: React.CSSProperties
}

/**
 * 统计卡片组件
 * 用于展示关键数据指标，支持悬浮效果和无障碍
 */
export function StatCard({
    title,
    value,
    suffix,
    icon,
    color,
    hoverable = true,
    className,
    style,
}: StatCardProps) {
    return (
        <Card
            className={`page-card-inner ${hoverable ? styles.statCard : ''} ${className || ''}`}
            hoverable={hoverable}
            style={style}
        >
            <Statistic
                title={title}
                value={value}
                suffix={suffix}
                prefix={icon ? <span aria-hidden="true">{icon}</span> : undefined}
                valueStyle={color ? { color } : undefined}
            />
        </Card>
    )
}
