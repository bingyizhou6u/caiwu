/**
 * 通用搜索过滤器组件
 * 统一的搜索表单布局和过滤条件
 */

import { Form, Input, Select, DatePicker, Button, Space, Card } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { ReactNode } from 'react'
import dayjs, { Dayjs } from 'dayjs'

export interface SearchFilterField {
  name: string
  label: string
  type: 'input' | 'select' | 'date' | 'dateRange' | 'custom'
  placeholder?: string
  options?: Array<{ label: string; value: any }>
  component?: ReactNode
}

export interface SearchFiltersProps {
  fields: SearchFilterField[]
  onSearch: (values: Record<string, any>) => void
  onReset?: () => void
  initialValues?: Record<string, any>
  layout?: 'horizontal' | 'vertical' | 'inline'
  showCard?: boolean
}

export function SearchFilters({
  fields,
  onSearch,
  onReset,
  initialValues,
  layout = 'inline',
  showCard = true,
}: SearchFiltersProps) {
  const [form] = Form.useForm()

  const handleSearch = () => {
    const values = form.getFieldsValue()
    // 处理日期范围
    Object.keys(values).forEach((key) => {
      if (values[key] && Array.isArray(values[key]) && values[key].length === 2) {
        const [start, end] = values[key] as [Dayjs, Dayjs]
        values[`${key}Start`] = start?.format('YYYY-MM-DD')
        values[`${key}End`] = end?.format('YYYY-MM-DD')
        delete values[key]
      } else if (values[key] && dayjs.isDayjs(values[key])) {
        values[key] = values[key].format('YYYY-MM-DD')
      }
    })
    onSearch(values)
  }

  const handleReset = () => {
    form.resetFields()
    if (onReset) {
      onReset()
    } else {
      onSearch({})
    }
  }

  const renderField = (field: SearchFilterField) => {
    switch (field.type) {
      case 'input':
        return (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            <Input placeholder={field.placeholder || `请输入${field.label}`} allowClear />
          </Form.Item>
        )
      case 'select':
        return (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            <Select
              placeholder={field.placeholder || `请选择${field.label}`}
              allowClear
              options={Array.isArray(field.options) ? field.options : []}
            />
          </Form.Item>
        )
      case 'date':
        return (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            <DatePicker placeholder={field.placeholder || `请选择${field.label}`} />
          </Form.Item>
        )
      case 'dateRange':
        return (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            <DatePicker.RangePicker />
          </Form.Item>
        )
      case 'custom':
        return (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            {field.component}
          </Form.Item>
        )
      default:
        return null
    }
  }

  const formContent = (
    <Form form={form} layout={layout} initialValues={initialValues}>
      <Space wrap>
        {fields.map(renderField)}
        <Form.Item>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Space>
    </Form>
  )

  if (showCard) {
    return <Card>{formContent}</Card>
  }

  return formContent
}

