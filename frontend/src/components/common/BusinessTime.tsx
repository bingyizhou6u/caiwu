/**
 * 业务时间显示组件
 * 
 * 显示业务时区 (UTC+4 迪拜时间) 的时间
 * 可选同时显示用户本地时间
 */

import React from 'react'
import { Tooltip } from 'antd'
import { formatBusinessTime, formatDualTime, getBusinessTimezoneDisplay, getLocalTimezoneDisplay } from '../../utils/timezone'

interface BusinessTimeProps {
    /** UTC 时间戳 (毫秒) */
    timestamp: number | null | undefined
    /** 显示格式 */
    format?: 'date' | 'datetime' | 'time'
    /** 是否在 Tooltip 中显示本地时间 */
    showLocalInTooltip?: boolean
    /** 占位符（当时间戳为空时显示） */
    placeholder?: string
    /** 额外的 CSS 样式 */
    style?: React.CSSProperties
}

/**
 * 业务时间显示组件
 * 
 * 使用示例:
 * ```tsx
 * <BusinessTime timestamp={1703145600000} />
 * <BusinessTime timestamp={createdAt} format="date" />
 * <BusinessTime timestamp={updatedAt} showLocalInTooltip />
 * ```
 */
export const BusinessTime: React.FC<BusinessTimeProps> = ({
    timestamp,
    format = 'datetime',
    showLocalInTooltip = true,
    placeholder = '-',
    style,
}) => {
    if (!timestamp) {
        return <span style={style}>{placeholder}</span>
    }

    const businessTime = formatBusinessTime(timestamp, format)

    if (!showLocalInTooltip) {
        return <span style={style}>{businessTime}</span>
    }

    const { local } = formatDualTime(timestamp)
    const tooltipContent = (
        <div>
            <div><strong>业务时间</strong> ({getBusinessTimezoneDisplay()})</div>
            <div>{businessTime}</div>
            <div style={{ marginTop: 4 }}><strong>本地时间</strong> ({getLocalTimezoneDisplay()})</div>
            <div>{local}</div>
        </div>
    )

    return (
        <Tooltip title={tooltipContent}>
            <span style={{ cursor: 'help', ...style }}>{businessTime}</span>
        </Tooltip>
    )
}

interface DualTimeDisplayProps {
    /** UTC 时间戳 (毫秒) */
    timestamp: number | null | undefined
    /** 显示格式 */
    format?: 'date' | 'datetime' | 'time'
    /** 占位符 */
    placeholder?: string
    /** 是否紧凑模式（本地时间显示在同一行） */
    compact?: boolean
}

/**
 * 双时区时间显示组件
 * 同时显示业务时间和本地时间
 * 
 * 使用示例:
 * ```tsx
 * <DualTimeDisplay timestamp={1703145600000} />
 * <DualTimeDisplay timestamp={createdAt} compact />
 * ```
 */
export const DualTimeDisplay: React.FC<DualTimeDisplayProps> = ({
    timestamp,
    format = 'datetime',
    placeholder = '-',
    compact = false,
}) => {
    if (!timestamp) {
        return <span>{placeholder}</span>
    }

    const businessTime = formatBusinessTime(timestamp, format)
    const { local } = formatDualTime(timestamp)

    if (compact) {
        return (
            <span>
                {businessTime}
                <span style={{ color: '#999', marginLeft: 8, fontSize: '0.9em' }}>
                    (本地: {local})
                </span>
            </span>
        )
    }

    return (
        <div>
            <div>{businessTime}</div>
            <div style={{ color: '#999', fontSize: '0.85em' }}>
                本地: {local}
            </div>
        </div>
    )
}

/**
 * 时区说明标签组件
 * 用于在报表标题处显示时区说明
 */
export const TimezoneLabel: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
    return (
        <span style={{
            color: '#999',
            fontSize: '0.85em',
            marginLeft: 8,
            ...style
        }}>
            ({getBusinessTimezoneDisplay()})
        </span>
    )
}

export default BusinessTime
