import { DatePicker, Space, Button } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useState, useEffect } from 'react'

export interface DateRangePickerProps {
  value?: [Dayjs, Dayjs] | null
  onChange?: (value: [Dayjs, Dayjs] | null) => void
  allowClear?: boolean
  style?: React.CSSProperties
  id?: string
}

export function DateRangePicker({ value, onChange, allowClear = true, style, id }: DateRangePickerProps) {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(
    value || [dayjs().startOf('month'), dayjs()]
  )
  const [internalId] = useState(() => id || `date-range-picker-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if (value) {
      setRange(value)
    }
  }, [value])

  const handleChange = (dates: unknown) => {
    const typedDates = dates as [Dayjs, Dayjs] | null
    setRange(typedDates)
    onChange?.(typedDates)
  }

  const quickSelect = (type: string) => {
    let start: Dayjs
    let end: Dayjs = dayjs()

    switch (type) {
      case 'today':
        start = dayjs().startOf('day')
        end = dayjs().endOf('day')
        break
      case 'yesterday':
        start = dayjs().subtract(1, 'day').startOf('day')
        end = dayjs().subtract(1, 'day').endOf('day')
        break
      case 'thisWeek':
        start = dayjs().startOf('week')
        end = dayjs().endOf('week')
        break
      case 'lastWeek':
        start = dayjs().subtract(1, 'week').startOf('week')
        end = dayjs().subtract(1, 'week').endOf('week')
        break
      case 'thisMonth':
        start = dayjs().startOf('month')
        end = dayjs().endOf('month')
        break
      case 'lastMonth':
        start = dayjs().subtract(1, 'month').startOf('month')
        end = dayjs().subtract(1, 'month').endOf('month')
        break
      case 'last7Days':
        start = dayjs().subtract(6, 'day').startOf('day')
        end = dayjs().endOf('day')
        break
      case 'last30Days':
        start = dayjs().subtract(29, 'day').startOf('day')
        end = dayjs().endOf('day')
        break
      case 'thisYear':
        start = dayjs().startOf('year')
        end = dayjs().endOf('year')
        break
      case 'lastYear':
        start = dayjs().subtract(1, 'year').startOf('year')
        end = dayjs().subtract(1, 'year').endOf('year')
        break
      default:
        return
    }

    const newRange: [Dayjs, Dayjs] = [start, end]
    setRange(newRange)
    onChange?.(newRange)
  }

  return (
    <Space wrap style={style}>
      <DatePicker.RangePicker
        id={internalId}
        value={range}
        onChange={handleChange}
        allowClear={allowClear}
        format="YYYY-MM-DD"
        style={{ width: 240 }}
      />
      <Space size="small">
        <Button size="small" onClick={() => quickSelect('today')}>今天</Button>
        <Button size="small" onClick={() => quickSelect('yesterday')}>昨天</Button>
        <Button size="small" onClick={() => quickSelect('thisWeek')}>本周</Button>
        <Button size="small" onClick={() => quickSelect('lastWeek')}>上周</Button>
        <Button size="small" onClick={() => quickSelect('thisMonth')}>本月</Button>
        <Button size="small" onClick={() => quickSelect('lastMonth')}>上月</Button>
        <Button size="small" onClick={() => quickSelect('last7Days')}>最近7天</Button>
        <Button size="small" onClick={() => quickSelect('last30Days')}>最近30天</Button>
        <Button size="small" onClick={() => quickSelect('thisYear')}>本年</Button>
      </Space>
    </Space>
  )
}
