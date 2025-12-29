/**
 * 甘特图组件
 * 
 * 以时间线形式展示任务进度
 */
import { useState, useMemo } from 'react'
import { Radio, Empty, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Task } from '../../../hooks/business/usePM'
import '../styles/gantt.css'

type ViewMode = 'day' | 'week'

interface GanttChartProps {
    tasks: Task[]
    projectStartDate?: string
    projectEndDate?: string
}

// 优先级配置
const PRIORITY_COLORS: Record<string, string> = {
    high: '#ff4d4f',
    medium: '#faad14',
    low: '#52c41a',
}

export function GanttChart({ tasks, projectStartDate, projectEndDate }: GanttChartProps) {
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState<ViewMode>('day')

    // 计算日期范围
    const { startDate, endDate, days } = useMemo(() => {
        // 从任务中获取日期范围
        let minDate = projectStartDate ? dayjs(projectStartDate) : dayjs()
        let maxDate = projectEndDate ? dayjs(projectEndDate) : dayjs().add(30, 'day')

        tasks.forEach(task => {
            if (task.startDate) {
                const start = dayjs(task.startDate)
                if (start.isBefore(minDate)) minDate = start
            }
            if (task.dueDate) {
                const end = dayjs(task.dueDate)
                if (end.isAfter(maxDate)) maxDate = end
            }
        })

        // 扩展范围以确保可见性
        minDate = minDate.subtract(2, 'day')
        maxDate = maxDate.add(2, 'day')

        // 生成日期数组
        const daysList: dayjs.Dayjs[] = []
        let current = minDate
        while (current.isBefore(maxDate) || current.isSame(maxDate, 'day')) {
            daysList.push(current)
            current = current.add(1, 'day')
        }

        return {
            startDate: minDate,
            endDate: maxDate,
            days: daysList,
        }
    }, [tasks, projectStartDate, projectEndDate])

    // 过滤有日期的任务
    const validTasks = useMemo(() => {
        return tasks.filter(task => task.startDate || task.dueDate)
    }, [tasks])

    // 计算任务条位置
    const getTaskBarStyle = (task: Task) => {
        const taskStart = task.startDate ? dayjs(task.startDate) : null
        const taskEnd = task.dueDate ? dayjs(task.dueDate) : null

        if (!taskStart && !taskEnd) return null

        const effectiveStart = taskStart || taskEnd!
        const effectiveEnd = taskEnd || taskStart!

        // 计算在网格中的位置
        const startIndex = effectiveStart.diff(startDate, 'day')
        const endIndex = effectiveEnd.diff(startDate, 'day')
        const duration = Math.max(1, endIndex - startIndex + 1)

        // 计算像素位置 (每格 40px)
        const cellWidth = 40
        const left = Math.max(0, startIndex * cellWidth)
        const width = duration * cellWidth - 4 // 减去一点边距

        return { left, width }
    }

    // 检查是否是周末
    const isWeekend = (date: dayjs.Dayjs) => {
        const day = date.day()
        return day === 0 || day === 6
    }

    // 检查是否是今天
    const isToday = (date: dayjs.Dayjs) => {
        return date.isSame(dayjs(), 'day')
    }

    if (validTasks.length === 0) {
        return (
            <div className="gantt-empty">
                <Empty description="暂无带日期的任务，请为任务设置开始日期或截止日期" />
            </div>
        )
    }

    // 网格列数
    const gridTemplateColumns = `200px repeat(${days.length}, 40px)`

    return (
        <div className="gantt-container">
            {/* 视图控制 */}
            <div className="gantt-view-controls">
                <span className="view-label">
                    <span className="gantt-date-range">
                        {startDate.format('YYYY/MM/DD')} - {endDate.format('YYYY/MM/DD')}
                    </span>
                </span>
                <Radio.Group
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                >
                    <Radio.Button value="day">日</Radio.Button>
                    <Radio.Button value="week">周</Radio.Button>
                </Radio.Group>
            </div>

            {/* 甘特图主体 */}
            <div className="gantt-chart" style={{ gridTemplateColumns }}>
                {/* 表头 */}
                <div className="gantt-header">
                    <div className="gantt-header-cell" style={{ textAlign: 'left', paddingLeft: 12 }}>
                        任务
                    </div>
                    {days.map((day, idx) => (
                        <div
                            key={idx}
                            className={`gantt-header-cell ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
                        >
                            <div>{day.format('DD')}</div>
                            <div style={{ fontSize: 10 }}>{day.format('ddd')}</div>
                        </div>
                    ))}
                </div>

                {/* 任务行 */}
                {validTasks.map((task) => {
                    const barStyle = getTaskBarStyle(task)

                    return (
                        <div key={task.id} className="gantt-row">
                            {/* 任务信息 */}
                            <div className="gantt-task-info">
                                <Tag color={PRIORITY_COLORS[task.priority || 'medium']} style={{ margin: 0 }}>
                                    {task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}
                                </Tag>
                                <span
                                    className="task-title"
                                    onClick={() => navigate(`/pm/tasks/${task.id}/edit`)}
                                    title={task.title}
                                >
                                    {task.title}
                                </span>
                            </div>

                            {/* 时间格子 */}
                            {days.map((day, idx) => (
                                <div
                                    key={idx}
                                    className={`gantt-cell ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
                                >
                                    {/* 任务条只在第一个格子渲染 */}
                                    {idx === 0 && barStyle && (
                                        <div
                                            className={`gantt-bar priority-${task.priority || 'medium'} status-${task.status}`}
                                            style={{
                                                left: barStyle.left,
                                                width: barStyle.width,
                                            }}
                                            onClick={() => navigate(`/pm/tasks/${task.id}/edit`)}
                                        >
                                            <span className="gantt-tooltip">
                                                <div><strong>{task.code}</strong> {task.title}</div>
                                                <div>{task.startDate || '?'} → {task.dueDate || '?'}</div>
                                                <div>{task.assigneeNames?.join(', ') || '未分配'}</div>
                                            </span>
                                            {task.code}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default GanttChart
