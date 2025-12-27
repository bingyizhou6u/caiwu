/**
 * 通用搜索过滤器组件
 * 统一的搜索表单布局和过滤条件
 */

import { Form, Input, InputNumber, Select, DatePicker, Button, Space, Card, Dropdown } from 'antd'
import { SearchOutlined, ReloadOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import { ReactNode, useState, useEffect } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import type { MenuProps } from 'antd'

// 快捷日期范围选择器（内嵌版本）
function QuickDateRangePicker({
  value,
  onChange,
  allowClear = true,
  showTime = false,
  id,
}: {
  value?: [Dayjs, Dayjs] | null
  onChange?: (value: [Dayjs, Dayjs] | null) => void
  allowClear?: boolean
  showTime?: boolean
  id?: string
}) {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(value || null)

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
      case 'thisWeek':
        start = dayjs().startOf('week')
        end = dayjs().endOf('week')
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
      default:
        return
    }

    const newRange: [Dayjs, Dayjs] = [start, end]
    setRange(newRange)
    onChange?.(newRange)
  }

  return (
    <Space wrap size="small">
      <DatePicker.RangePicker
        value={range}
        onChange={handleChange}
        allowClear={allowClear}
        showTime={showTime}
        format={showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}
        style={{ width: showTime ? 380 : 240 }}
      />
      <Button size="small" onClick={() => quickSelect('today')}>今天</Button>
      <Button size="small" onClick={() => quickSelect('thisWeek')}>本周</Button>
      <Button size="small" onClick={() => quickSelect('thisMonth')}>本月</Button>
      <Button size="small" onClick={() => quickSelect('lastMonth')}>上月</Button>
      <Button size="small" onClick={() => quickSelect('last7Days')}>近7天</Button>
      <Button size="small" onClick={() => quickSelect('last30Days')}>近30天</Button>
    </Space>
  )
}

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
  /** dateRange 类型专用：是否显示快捷选择按钮 */
  showQuickSelect?: boolean
  /** dateRange/date 类型专用：是否显示时分秒 */
  showTime?: boolean
}

export interface SearchFiltersProps {
  fields: SearchFilterField[]
  onSearch: (values: Record<string, string | number | string[] | undefined>) => void
  onReset?: () => void
  initialValues?: Record<string, string | number | string[] | undefined>
  layout?: 'horizontal' | 'vertical' | 'inline'
  showCard?: boolean
  /** 是否启用保存搜索条件功能 */
  enableSaveSearch?: boolean
  /** 保存搜索条件的唯一标识（用于 localStorage key） */
  saveSearchKey?: string
  /** 搜索条件变化回调 */
  onValuesChange?: (values: Record<string, any>) => void
}

export function SearchFilters({
  fields,
  onSearch,
  onReset,
  initialValues,
  layout = 'inline',
  showCard = true,
  enableSaveSearch = false,
  saveSearchKey,
  onValuesChange,
}: SearchFiltersProps) {
  const [form] = Form.useForm()
  const [savedSearches, setSavedSearches] = useState<Array<{ name: string; values: Record<string, any> }>>([])

  // 加载保存的搜索条件
  useEffect(() => {
    if (enableSaveSearch && saveSearchKey) {
      try {
        const saved = localStorage.getItem(`searchFilters_${saveSearchKey}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          setSavedSearches(parsed.savedSearches || [])
          // 如果有默认保存的搜索条件，自动加载
          if (parsed.default && !initialValues) {
            form.setFieldsValue(parsed.default)
          }
        }
      } catch (e) {
        console.error('Failed to load saved searches:', e)
      }
    }
  }, [enableSaveSearch, saveSearchKey, form, initialValues])

  // 保存当前搜索条件
  const handleSaveSearch = () => {
    if (!enableSaveSearch || !saveSearchKey) return
    
    const values = form.getFieldsValue()
    const name = prompt('请输入搜索条件名称：')
    if (!name) return

    const newSavedSearches = [...savedSearches, { name, values }]
    setSavedSearches(newSavedSearches)
    
    try {
      localStorage.setItem(
        `searchFilters_${saveSearchKey}`,
        JSON.stringify({ savedSearches: newSavedSearches })
      )
    } catch (e) {
      console.error('Failed to save search:', e)
    }
  }

  // 加载保存的搜索条件
  const handleLoadSearch = (values: Record<string, any>) => {
    form.setFieldsValue(values)
    handleSearch()
  }

  // 删除保存的搜索条件
  const handleDeleteSearch = (index: number) => {
    const newSavedSearches = savedSearches.filter((_, i) => i !== index)
    setSavedSearches(newSavedSearches)
    
    try {
      localStorage.setItem(
        `searchFilters_${saveSearchKey}`,
        JSON.stringify({ savedSearches: newSavedSearches })
      )
    } catch (e) {
      console.error('Failed to delete search:', e)
    }
  }

  const handleSearch = () => {
    const values = form.getFieldsValue()
    // 清理空值
    const cleanedValues: Record<string, string | number | string[] | undefined> = {}
    
    // 获取字段配置的 showTime
    const getFieldShowTime = (name: string) => {
      const field = fields.find(f => f.name === name)
      return field?.showTime
    }
    
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
          const format = getFieldShowTime(key) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
          cleanedValues[`${key}Start`] = start.format(format)
          cleanedValues[`${key}End`] = end.format(format)
          return
        }
      }
      
      // 处理单个日期
      if (dayjs.isDayjs(value)) {
        const format = getFieldShowTime(key) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
        cleanedValues[key] = value.format(format)
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

  // 表单值变化回调
  const handleValuesChange = () => {
    if (onValuesChange) {
      const values = form.getFieldsValue()
      onValuesChange(values)
    }
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
    // 基础属性：对于单一表单控件，使用 commonProps
    // Form.Item 会自动为 label 生成 htmlFor，关联到第一个表单控件的 id
    const commonProps = {
      key: field.name,
      name: field.name,
      label: field.label,
    }

    // 为需要 id 的字段生成唯一 ID（用于 label 关联）
    // 对于包含多个元素的字段类型，需要为第一个表单控件生成 id
    const fieldId = field.type === 'dateRange' && field.showQuickSelect
      ? `date-range-${field.name}-${Math.random().toString(36).substring(2, 9)}`
      : field.type === 'numberRange'
      ? `number-range-min-${field.name}-${Math.random().toString(36).substring(2, 9)}`
      : undefined

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
        // 当使用 QuickDateRangePicker 时，为 DatePicker 设置 id，Form.Item 会自动关联 label
        if (field.showQuickSelect) {
          return (
            <Form.Item {...commonProps}>
              <QuickDateRangePicker
                id={fieldId}
                allowClear={field.allowClear !== false}
                showTime={field.showTime}
              />
            </Form.Item>
          )
        }
        return (
          <Form.Item {...commonProps}>
            <DatePicker.RangePicker
              allowClear={field.allowClear !== false}
              showTime={field.showTime}
              format={field.showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}
              style={{ width: field.showTime ? 380 : 240 }}
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
        // custom 类型：如果组件是单一表单控件，Form.Item 会自动关联
        // 如果是多个元素，建议在自定义组件中为第一个表单控件添加 id
        return (
          <Form.Item {...commonProps}>
            {field.component}
          </Form.Item>
        )
      default:
        return null
    }
  }

  // 保存的搜索条件菜单
  const savedSearchMenuItems: MenuProps['items'] = savedSearches.map((search, index) => ({
    key: index.toString(),
    label: (
      <Space>
        <span onClick={() => handleLoadSearch(search.values)}>{search.name}</span>
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteSearch(index)
          }}
        />
      </Space>
    ),
  }))

  const formContent = (
    <Form 
      form={form} 
      layout={layout} 
      initialValues={initialValues}
      onValuesChange={handleValuesChange}
    >
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
            {enableSaveSearch && (
              <>
                <Button icon={<SaveOutlined />} onClick={handleSaveSearch}>
                  保存搜索
                </Button>
                {savedSearches.length > 0 && (
                  <Dropdown menu={{ items: savedSearchMenuItems }} trigger={['click']}>
                    <Button>已保存的搜索</Button>
                  </Dropdown>
                )}
              </>
            )}
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
