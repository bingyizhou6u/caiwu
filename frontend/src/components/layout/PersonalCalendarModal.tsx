/**
 * 个人日历弹窗组件
 * 
 * 显示与用户相关的日历事件：
 * - 任务截止日期
 * - 请假记录
 * - 合同到期/入职周年提醒
 * - 个人自定义事件
 */
import { useState } from 'react'
import { Modal, Calendar, Badge, Spin, Typography, Tag, List, Empty, Button, Form, Input, DatePicker, Select, ColorPicker, Popconfirm, message } from 'antd'
import { CalendarOutlined, ClockCircleOutlined, CheckSquareOutlined, ExclamationCircleOutlined, PlusOutlined, UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/http'

const { Text } = Typography
const { RangePicker } = DatePicker

interface CalendarEvent {
    date: string
    type: 'task' | 'leave' | 'reminder' | 'personal'
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
    personal: <UserOutlined />,
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    task: '任务',
    leave: '请假',
    reminder: '提醒',
    personal: '个人',
}

interface EventFormValues {
    title: string
    description?: string
    timeRange: [Dayjs, Dayjs]
    isAllDay?: boolean
    color?: string | any // ColorPicker value
}

export function PersonalCalendarModal({ open, onClose }: PersonalCalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState<string>(dayjs().format('YYYY-MM'))
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [isFormVisible, setIsFormVisible] = useState(false)
    const [editingEventId, setEditingEventId] = useState<string | null>(null)
    const [form] = Form.useForm<EventFormValues>()
    const queryClient = useQueryClient()

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
        staleTime: 60 * 1000,
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

    // 创建事件 Mutation
    const createEventMutation = useMutation({
        mutationFn: async (values: any) => {
            return await api.post('/api/v2/my/calendar/events', values)
        },
        onSuccess: () => {
            message.success('创建成功')
            setIsFormVisible(false)
            form.resetFields()
            queryClient.invalidateQueries({ queryKey: ['my-calendar'] })
        }
    })

    // 更新事件 Mutation
    const updateEventMutation = useMutation({
        mutationFn: async ({ id, values }: { id: string, values: any }) => {
            return await api.put(`/api/v2/my/calendar/events/${id}`, values)
        },
        onSuccess: () => {
            message.success('更新成功')
            setIsFormVisible(false)
            setEditingEventId(null)
            form.resetFields()
            queryClient.invalidateQueries({ queryKey: ['my-calendar'] })
        }
    })

    // 删除事件 Mutation
    const deleteEventMutation = useMutation({
        mutationFn: async (id: string) => {
            return await api.delete(`/api/v2/my/calendar/events/${id}`)
        },
        onSuccess: () => {
            message.success('删除成功')
            queryClient.invalidateQueries({ queryKey: ['my-calendar'] })
        }
    })

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

    // 处理表单提交
    const handleSubmit = async (values: EventFormValues) => {
        const payload = {
            title: values.title,
            description: values.description,
            startTime: values.timeRange[0].valueOf(),
            endTime: values.timeRange[1].valueOf(),
            isAllDay: values.isAllDay ? 1 : 0,
            color: typeof values.color === 'string' ? values.color : values.color?.toHexString(),
        }

        if (editingEventId) {
            updateEventMutation.mutate({ id: editingEventId, values: payload })
        } else {
            createEventMutation.mutate(payload)
        }
    }

    // 打开编辑
    const handleEdit = (event: CalendarEvent) => {
        if (event.type !== 'personal' || !event.meta?.id) return

        setEditingEventId(event.meta.id)
        form.setFieldsValue({
            title: event.title,
            description: event.meta.description,
            timeRange: [dayjs(event.meta.startTime), dayjs(event.meta.endTime)],
            isAllDay: !!event.meta.isAllDay,
            color: event.color
        })
        setIsFormVisible(true)
    }

    // 打开新增
    const handleAdd = () => {
        setEditingEventId(null)
        form.resetFields()
        // 默认选中当前选中日期，或者是今天
        const initialDate = selectedDate ? dayjs(selectedDate) : dayjs()
        form.setFieldsValue({
            timeRange: [initialDate.startOf('day'), initialDate.endOf('day')],
            color: '#13c2c2'
        })
        setIsFormVisible(true)
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
            width={900}
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

                    {/* 事件详情/编辑面板 */}
                    <div style={{ width: 320, borderLeft: '1px solid #f0f0f0', paddingLeft: 16, display: 'flex', flexDirection: 'column' }}>

                        {!isFormVisible ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text strong>
                                        {selectedDate ? dayjs(selectedDate).format('M月D日') : '选择日期查看详情'}
                                    </Text>
                                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
                                        添加事件
                                    </Button>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {selectedDate ? (
                                        selectedEvents.length > 0 ? (
                                            <List
                                                size="small"
                                                dataSource={selectedEvents}
                                                renderItem={(event) => (
                                                    <List.Item
                                                        style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', flexDirection: 'column', alignItems: 'flex-start' }}
                                                        actions={event.type === 'personal' ? [
                                                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(event)} />,
                                                            <Popconfirm title="确定删除?" onConfirm={() => deleteEventMutation.mutate(event.meta!.id)}>
                                                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                                            </Popconfirm>
                                                        ] : []}
                                                    >
                                                        <div style={{ width: '100%' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <Tag color={event.color} style={{ marginBottom: 4 }}>
                                                                    {EVENT_TYPE_ICONS[event.type]} {EVENT_TYPE_LABELS[event.type]}
                                                                </Tag>
                                                                {event.meta?.isAllDay ? <Tag>全天</Tag> : null}
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 500 }}>{event.title}</div>
                                                            {event.meta?.description && (
                                                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{event.meta.description}</div>
                                                            )}
                                                            {event.type === 'task' && (
                                                                <div style={{ marginTop: 4 }}>
                                                                    {event.meta?.priority && (
                                                                        <Tag style={{ fontSize: 10 }}>
                                                                            {event.meta.priority === 'high' ? '高优先' : event.meta.priority === 'medium' ? '中优先' : '低优先'}
                                                                        </Tag>
                                                                    )}
                                                                </div>
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
                            </>
                        ) : (
                            // 表单视图
                            <>
                                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong>{editingEventId ? '编辑事件' : '新建事件'}</Text>
                                    <Button size="small" onClick={() => setIsFormVisible(false)}>取消</Button>
                                </div>
                                <Form
                                    form={form}
                                    layout="vertical"
                                    onFinish={handleSubmit}
                                    size="small"
                                >
                                    <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                                        <Input placeholder="事件标题" />
                                    </Form.Item>

                                    <Form.Item name="timeRange" label="时间" rules={[{ required: true }]}>
                                        <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                                    </Form.Item>

                                    <Form.Item name="color" label="颜色" initialValue="#13c2c2">
                                        <ColorPicker showText />
                                    </Form.Item>

                                    <Form.Item name="description" label="备注">
                                        <Input.TextArea rows={3} placeholder="可选备注" />
                                    </Form.Item>

                                    <Button type="primary" htmlType="submit" block loading={createEventMutation.isPending || updateEventMutation.isPending}>
                                        保存
                                    </Button>
                                </Form>
                            </>
                        )}
                    </div>
                </div>

                {/* 图例 */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ marginRight: 16 }}>图例:</Text>
                    <Badge color="#1890ff" text="任务截止" style={{ marginRight: 12 }} />
                    <Badge color="#722ed1" text="请假" style={{ marginRight: 12 }} />
                    <Badge color="#faad14" text="入职周年" style={{ marginRight: 12 }} />
                    <Badge color="#ff4d4f" text="合同到期" style={{ marginRight: 12 }} />
                    <Badge color="#13c2c2" text="个人事件" />
                </div>
            </Spin>
        </Modal>
    )
}

export default PersonalCalendarModal
