/**
 * 通用搜索过滤器组件
 * 统一的搜索表单布局和过滤条件
 */

import { Form, Input, InputNumber, Select, DatePicker, Button, Space, Card } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { ReactNode } from 'react'
import dayjs, { Dayjs } from 'dayjs'

export interface SearchFilterField {
  name: string
  label: string
  type: 'input' | 'select' | 'date' | 'dateRange' | 'number' | 'numberRange' | 'custom'
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
  component?: ReactNode
  allowClear?: boolean
  mode?: 'multiple' | 'tags'
  min?: number
  max?: number
  precision?: number
}

export interface SearchFiltersProps {
  fields: SearchFilterField[]
  onSearch: (values: Record<string, string | number | string[] | undefined>) => void
  onReset?: () => void
  initialValues?: Record<string, string | number | string[] | undefined>
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
    // 清理空值
    const cleanedValues: Record<string, string | number | string[] | undefined> = {}
    
    Object.keys(values).forEach((key) => {
      const value = values[key]
      
      // 跳过空值
      if (value === undefined || value === null || value === '') {
        return
      }
      
      // 处理日期范围
      if (Array.isArray(value) && value.length === 2) {
        const [start, end] = value as [Dayjs, Dayjs]
        if (dayjs.isDayjs(start) && dayjs.isDayjs(end)) {
          cleanedValues[`${key}Start`] = start.format('YYYY-MM-DD')
          cleanedValues[`${key}End`] = end.format('YYYY-MM-DD')
          return
        }
      }
      
      // 处理单个日期
      if (dayjs.isDayjs(value)) {
        cleanedValues[key] = value.format('YYYY-MM-DD')
        return
      }
      
      // 处理数组（多选）
      if (Array.isArray(value) && value.length > 0) {
        cleanedValues[key] = value
        return
      }
      
      // 其他值直接保留
      cleanedValues[key] = value
    })
    
    onSearch(cleanedValues)
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
    const commonProps = {
      key: field.name,
      name: field.name,
      label: field.label,
    }

    switch (field.type) {
      case 'input':
        return (
          <Form.Item {...commonProps}>
            <Input
              placeholder={field.placeholder || `请输入${field.label}`}
              allowClear={field.allowClear !== false}
            />
          </Form.Item>
        )
      case 'select':
        return (
          <Form.Item {...commonProps}>
            <Select
              placeholder={field.placeholder || `请选择${field.label}`}
              allowClear={field.allowClear !== false}
              mode={field.mode}
              options={Array.isArray(field.options) ? field.options : []}
            />
          </Form.Item>
        )
      case 'date':
        return (
          <Form.Item {...commonProps}>
            <DatePicker
              placeholder={field.placeholder || `请选择${field.label}`}
              allowClear={field.allowClear !== false}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )
      case 'dateRange':
        return (
          <Form.Item {...commonProps}>
            <DatePicker.RangePicker
              allowClear={field.allowClear !== false}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )
      case 'number':
        return (
          <Form.Item {...commonProps}>
            <InputNumber
              placeholder={field.placeholder || `请输入${field.label}`}
              min={field.min}
              max={field.max}
              precision={field.precision}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )
      case 'numberRange':
        return (
          <Form.Item {...commonProps}>
            <Input.Group compact>
              <Form.Item name={[field.name, 'min']} noStyle>
                <InputNumber
                  placeholder="最小值"
                  min={field.min}
                  max={field.max}
                  precision={field.precision}
                  style={{ width: '50%' }}
                />
              </Form.Item>
              <Form.Item name={[field.name, 'max']} noStyle>
                <InputNumber
                  placeholder="最大值"
                  min={field.min}
                  max={field.max}
                  precision={field.precision}
                  style={{ width: '50%' }}
                />
              </Form.Item>
            </Input.Group>
          </Form.Item>
        )
      case 'custom':
        return (
          <Form.Item {...commonProps}>
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

