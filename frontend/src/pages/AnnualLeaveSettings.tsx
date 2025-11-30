import { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Select, Button, message, Spin, Typography, Divider, Alert } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import { authedJsonFetch } from '../utils/authedFetch'

const { Title, Text } = Typography

interface AnnualLeaveConfig {
  annual_leave_cycle_months: string
  annual_leave_days_per_cycle: string
  annual_leave_overtime_multiplier: string
}

export function AnnualLeaveSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const configs = await authedJsonFetch(`${api.systemConfig}`)
      const configMap: Record<string, string> = {}
      for (const c of configs.results || []) {
        configMap[c.key] = c.value
      }
      form.setFieldsValue({
        cycle_months: parseInt(configMap['annual_leave_cycle_months'] || '6'),
        days_per_cycle: parseInt(configMap['annual_leave_days_per_cycle'] || '5'),
        overtime_multiplier: parseFloat(configMap['annual_leave_overtime_multiplier'] || '1'),
      })
    } catch (error) {
      console.error('Failed to load config:', error)
      message.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      
      // 保存三个配置项
      await Promise.all([
        authedJsonFetch(`${api.systemConfig}/annual_leave_cycle_months`, {
          method: 'PUT',
          body: JSON.stringify({ value: String(values.cycle_months) }),
        }),
        authedJsonFetch(`${api.systemConfig}/annual_leave_days_per_cycle`, {
          method: 'PUT',
          body: JSON.stringify({ value: String(values.days_per_cycle) }),
        }),
        authedJsonFetch(`${api.systemConfig}/annual_leave_overtime_multiplier`, {
          method: 'PUT',
          body: JSON.stringify({ value: String(values.overtime_multiplier) }),
        }),
      ])
      
      message.success('保存成功')
    } catch (error: any) {
      message.error(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>年假制度配置</Title>
      
      <Alert
        message="年假规则说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>员工入职日起开始计算年假周期</li>
            <li>第一个周期内不享有年假</li>
            <li>自第二周期起，每完成一个周期获得指定天数年假</li>
            <li>年假仅限当周期使用，不得顺延、累计或合并</li>
            <li>周期结束时未休年假自动折算工资</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 500 }}
        >
          <Form.Item
            name="cycle_months"
            label="年假周期"
            rules={[{ required: true, message: '请选择年假周期' }]}
          >
            <Select>
              <Select.Option value={6}>半年制（6个月）</Select.Option>
              <Select.Option value={12}>年制（12个月）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="days_per_cycle"
            label="每周期年假天数"
            rules={[{ required: true, message: '请输入年假天数' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} addonAfter="天" />
          </Form.Item>

          <Form.Item
            name="overtime_multiplier"
            label="未休年假折算系数"
            extra="未休年假折算工资 = 未休天数 × 日薪 × 系数"
            rules={[{ required: true, message: '请输入折算系数' }]}
          >
            <InputNumber min={0.5} max={3} step={0.5} style={{ width: '100%' }} addonAfter="倍" />
          </Form.Item>

          <Divider />

          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存配置
          </Button>
        </Form>
      </Card>
    </div>
  )
}

export default AnnualLeaveSettings
