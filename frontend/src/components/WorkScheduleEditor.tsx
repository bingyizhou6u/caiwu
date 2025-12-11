import { useState, useEffect } from 'react'
import { Checkbox, TimePicker, Space, Card, Row, Col } from 'antd'
import dayjs from 'dayjs'

interface WorkSchedule {
  days: number[]
  start: string
  end: string
}

interface WorkScheduleEditorProps {
  value?: WorkSchedule
  onChange?: (value: WorkSchedule) => void
  id?: string // Form.Item 会传递 id，用于 label for 关联
}

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const DEFAULT_SCHEDULE: WorkSchedule = {
  days: [1, 2, 3, 4, 5, 6],
  start: '09:00',
  end: '21:00',
}

export function WorkScheduleEditor({ value, onChange, id }: WorkScheduleEditorProps) {
  const [schedule, setSchedule] = useState<WorkSchedule>(value || DEFAULT_SCHEDULE)

  useEffect(() => {
    if (value) {
      setSchedule(value)
    }
  }, [value])

  const handleDaysChange = (days: number[]) => {
    const newSchedule = { ...schedule, days }
    setSchedule(newSchedule)
    onChange?.(newSchedule)
  }

  const handleTimeChange = (field: 'start' | 'end', time: dayjs.Dayjs | null) => {
    if (time) {
      const newSchedule = { ...schedule, [field]: time.format('HH:mm') }
      setSchedule(newSchedule)
      onChange?.(newSchedule)
    }
  }

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      {/* 隐藏输入用于匹配 Form.Item label for，避免可访问性报错 */}
      {id && <input id={id} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} aria-hidden />}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <span style={{ marginRight: 8 }}>工作日：</span>
          <Checkbox.Group
            options={WEEKDAYS.map(d => ({ value: d.value, label: d.label }))}
            value={schedule.days}
            onChange={(values) => handleDaysChange(values as number[])}
          />
        </Col>
        <Col span={12}>
          <Space>
            <span>上班时间：</span>
            <TimePicker
              value={dayjs(schedule.start, 'HH:mm')}
              format="HH:mm"
              onChange={(time) => handleTimeChange('start', time)}
              minuteStep={30}
            />
          </Space>
        </Col>
        <Col span={12}>
          <Space>
            <span>下班时间：</span>
            <TimePicker
              value={dayjs(schedule.end, 'HH:mm')}
              format="HH:mm"
              onChange={(time) => handleTimeChange('end', time)}
              minuteStep={30}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

export default WorkScheduleEditor
