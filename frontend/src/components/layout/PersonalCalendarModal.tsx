/**
 * 个人日历弹窗组件
 * 
 * 显示与用户相关的日历事件：
 * - 任务截止日期
 * - 请假记录
 * - 合同到期/入职周年提醒
 */
import { useState, useEffect } from 'react'
import { Modal, Calendar, Badge, Spin, Typography, Tag, List, Empty } from 'antd'
import { CalendarOutlined, ClockCircleOutlined, CheckSquareOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/http'

const { Text } = Typography

interface CalendarEvent {
    date: string
    type: 'task' | 'leave' | 'reminder'
    title: string
    color: string
    meta?: Record<string, any>
}

interface PersonalCalendarModalProps {
    open: boolean
    onClose: () => void
}

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
    task: <CheckSquareOutlined />,
    leave: <ClockCircleOutlined />,
    reminder: <ExclamationCircleOutlined />,
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    task: '任务',
    leave: '请假',
    reminder: '提醒',
}

export function PersonalCalendarModal({ open, onClose }: PersonalCalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState<string>(dayjs().format('YYYY-MM'))
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    // 获取日历事件
    const { data, isLoading } = useQuery({
        queryKey: ['my-calendar', currentMonth],
        queryFn: async () => {
            const res = await api.get<{ success: boolean; data: { events: CalendarEvent[] } }>(
                `/api/v2/my/calendar?month=${currentMonth}`
            )
            return res.data?.events || []
        },
        enabled: open,
        staleTime: 60 * 1000, // 1分钟缓存
    })

    const events = data || []

    // 按日期分组事件
    const eventsByDate = events.reduce((acc, event) => {
        if (!acc[event.date]) {
            acc[event.date] = []
        }
        acc[event.date].push(event)
        return acc
    }, {} as Record<string, CalendarEvent[]>)

    // 选中日期的事件
    const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : []

    // 日期单元格渲染
    const dateCellRender = (value: Dayjs) => {
        const dateStr = value.format('YYYY-MM-DD')
        const dayEvents = eventsByDate[dateStr] || []

        if (dayEvents.length === 0) return null

        return (
            <div className="calendar-events">
                {dayEvents.slice(0, 3).map((event, idx) => (
                    <Badge
                        key={idx}
                        color={event.color}
                        text={<span style={{ fontSize: 10 }}>{event.title.slice(0, 6)}</span>}
                    />
                ))}
                {dayEvents.length > 3 && (
                    <span style={{ fontSize: 10, color: '#999' }}>+{dayEvents.length - 3}更多</span>
                )}
            </div>
        )
    }

    // 月份切换
    const handlePanelChange = (date: Dayjs) => {
        setCurrentMonth(date.format('YYYY-MM'))
        setSelectedDate(null)
    }

    // 日期选择
    const handleSelect = (date: Dayjs) => {
        setSelectedDate(date.format('YYYY-MM-DD'))
    }

    return (
        <Modal
            title={
                <span>
                    <CalendarOutlined style={{ marginRight: 8 }} />
                    我的日历
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
            styles={{ body: { padding: '12px 24px 24px' } }}
        >
            <Spin spinning={isLoading}>
                <div style={{ display: 'flex', gap: 16 }}>
                    {/* 日历 */}
                    <div style={{ flex: 1 }}>
                        <Calendar
                            fullscreen={false}
                            cellRender={(current, info) => {
                                if (info.type === 'date') {
                                    return dateCellRender(current)
                                }
                                return info.originNode
                            }}
                            onPanelChange={handlePanelChange}
                            onSelect={handleSelect}
                        />
                    </div>

                    {/* 事件详情面板 */}
                    <div style={{ width: 280, borderLeft: '1px solid #f0f0f0', paddingLeft: 16 }}>
                        <Text strong style={{ display: 'block', marginBottom: 12 }}>
                            {selectedDate ? dayjs(selectedDate).format('M月D日') : '选择日期查看详情'}
                        </Text>

                        {selectedDate ? (
                            selectedEvents.length > 0 ? (
                                <List
                                    size="small"
                                    dataSource={selectedEvents}
                                    renderItem={(event) => (
                                        <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                                            <div>
                                                <Tag color={event.color} style={{ marginBottom: 4 }}>
                                                    {EVENT_TYPE_ICONS[event.type]} {EVENT_TYPE_LABELS[event.type]}
                                                </Tag>
                                                <div style={{ fontSize: 13 }}>{event.title}</div>
                                                {event.meta?.priority && (
                                                    <Tag style={{ marginTop: 4, fontSize: 11 }}>
                                                        {event.meta.priority === 'high' ? '高优先' : event.meta.priority === 'medium' ? '中优先' : '低优先'}
                                                    </Tag>
                                                )}
                                                {event.meta?.status && (
                                                    <Tag style={{ marginTop: 4, fontSize: 11 }}>
                                                        {event.meta.status}
                                                    </Tag>
                                                )}
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                <Empty description="当日无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )
                        ) : (
                            <div style={{ color: '#999', textAlign: 'center', paddingTop: 40 }}>
                                <CalendarOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                <div>点击日期查看详情</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 图例 */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ marginRight: 16 }}>图例:</Text>
                    <Badge color="#1890ff" text="任务截止" style={{ marginRight: 12 }} />
                    <Badge color="#722ed1" text="请假" style={{ marginRight: 12 }} />
                    <Badge color="#faad14" text="入职周年" style={{ marginRight: 12 }} />
                    <Badge color="#ff4d4f" text="合同到期" />
                </div>
            </Spin>
        </Modal>
    )
}

export default PersonalCalendarModal
