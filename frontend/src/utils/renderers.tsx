import { Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { formatAmount } from './formatters'

/**
 * 渲染金额 (分 -> 元)
 * @param cents 金额（分）
 * @param emptyText 空值显示文本
 */
export const renderCurrency = (cents: number | null | undefined, emptyText = '-') => {
    if (cents == null) return <span style={{ color: '#999' }}>{emptyText}</span>
    return <span>{formatAmount(cents)}</span>
}

/**
 * 渲染日期 (YYYY-MM-DD)
 * @param date 日期字符串或时间戳
 */
export const renderDate = (date: string | number | null | undefined, emptyText = '-') => {
    if (!date) return <span style={{ color: '#999' }}>{emptyText}</span>
    return <span>{dayjs(date).format('YYYY-MM-DD')}</span>
}

/**
 * 渲染时间 (YYYY-MM-DD HH:mm)
 * @param date 日期字符串或时间戳
 */
export const renderDateTime = (date: string | number | null | undefined, emptyText = '-') => {
    if (!date) return <span style={{ color: '#999' }}>{emptyText}</span>
    return <span>{dayjs(date).format('YYYY-MM-DD HH:mm')}</span>
}

/**
 * 渲染状态标签
 * @param status 状态值
 * @param mapping 映射配置 { [value]: { text: string, color: string } }
 */
export const renderStatus = (
    status: string | number,
    mapping: Record<string | number, { text: string, color?: string }>
) => {
    const config = mapping[status]
    if (!config) return <Tag>{status}</Tag>
    return <Tag color={config.color}>{config.text}</Tag>
}

/**
 * 渲染文本（处理空值）
 */
export const renderText = (text: string | null | undefined, emptyText = '-') => {
    if (!text) return <span style={{ color: '#999' }}>{emptyText}</span>
    return <span>{text}</span>
}
