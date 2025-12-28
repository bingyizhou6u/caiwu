import { useState, useEffect } from 'react'
import { ClockCircleOutlined } from '@ant-design/icons'
import { PersonalCalendarModal } from './PersonalCalendarModal'

/**
 * 头部时钟组件
 * 显示迪拜时间 (UTC+4)
 * 点击打开个人日历
 */
export function HeaderClock() {
    const [time, setTime] = useState('')
    const [date, setDate] = useState('')
    const [calendarOpen, setCalendarOpen] = useState(false)

    useEffect(() => {
        const updateTime = () => {
            // 使用迪拜时区 (UTC+4)
            const now = new Date()
            const options: Intl.DateTimeFormatOptions = {
                timeZone: 'Asia/Dubai',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }
            const dateOptions: Intl.DateTimeFormatOptions = {
                timeZone: 'Asia/Dubai',
                month: '2-digit',
                day: '2-digit',
                weekday: 'short'
            }
            setTime(now.toLocaleTimeString('zh-CN', options))
            setDate(now.toLocaleDateString('zh-CN', dateOptions))
        }

        // 立即更新一次
        updateTime()

        // 每秒更新
        const timer = setInterval(updateTime, 1000)

        return () => clearInterval(timer)
    }, [])

    return (
        <>
            <div
                className="header-clock"
                onClick={() => setCalendarOpen(true)}
                style={{ cursor: 'pointer' }}
                title="点击打开日历"
            >
                <ClockCircleOutlined className="clock-icon" />
                <div className="clock-content">
                    <span className="clock-time">{time}</span>
                    <span className="clock-date">{date}</span>
                </div>
            </div>
            <PersonalCalendarModal
                open={calendarOpen}
                onClose={() => setCalendarOpen(false)}
            />
        </>
    )
}
