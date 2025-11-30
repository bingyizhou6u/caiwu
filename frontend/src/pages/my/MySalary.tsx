import { useState, useEffect } from 'react'
import { Card, Table, Tabs, Statistic, Row, Col, Spin, Typography, Empty } from 'antd'
import { DollarOutlined } from '@ant-design/icons'
import { api } from '../../config/api'
import { authedJsonFetch } from '../../utils/authedFetch'

const { Title } = Typography

interface SalaryConfig {
  id: string
  salary_type: string
  currency_id: string
  currency_name: string
  currency_symbol: string
  amount_cents: number
}

interface AllowanceConfig {
  id: string
  allowance_type: string
  currency_id: string
  currency_name: string
  currency_symbol: string
  amount_cents: number
}

const salaryTypeLabels: Record<string, string> = {
  probation: '试用期',
  regular: '转正',
}

const allowanceTypeLabels: Record<string, string> = {
  living: '生活补贴',
  housing: '住房补贴',
  transportation: '交通补贴',
  meal: '餐饮补贴',
}

export function MySalary() {
  const [loading, setLoading] = useState(true)
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig[]>([])
  const [allowanceConfig, setAllowanceConfig] = useState<AllowanceConfig[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await authedJsonFetch(`${api.base}/api/my/salary`)
      setSalaryConfig(result.salaryConfig || [])
      setAllowanceConfig(result.allowanceConfig || [])
    } catch (error) {
      console.error('Failed to load salary:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  // 计算总薪资
  const totalSalary = salaryConfig.reduce((sum, s) => sum + s.amount_cents, 0)
  const totalAllowance = allowanceConfig.reduce((sum, a) => sum + a.amount_cents, 0)

  const salaryColumns = [
    { title: '类型', dataIndex: 'salary_type', render: (v: string) => salaryTypeLabels[v] || v },
    { title: '币种', dataIndex: 'currency_name' },
    { title: '金额', dataIndex: 'amount_cents', render: (v: number, r: SalaryConfig) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}` },
  ]

  const allowanceColumns = [
    { title: '类型', dataIndex: 'allowance_type', render: (v: string) => allowanceTypeLabels[v] || v },
    { title: '币种', dataIndex: 'currency_name' },
    { title: '金额', dataIndex: 'amount_cents', render: (v: number, r: AllowanceConfig) => `${r.currency_symbol || '¥'}${(v / 100).toFixed(2)}` },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>我的薪资</Title>

      {/* 薪资概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="底薪（月）"
              value={totalSalary / 100}
              prefix={<DollarOutlined />}
              suffix="元"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="津贴（月）"
              value={totalAllowance / 100}
              prefix={<DollarOutlined />}
              suffix="元"
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="salary" items={[
        {
          key: 'salary',
          label: '薪资配置',
          children: salaryConfig.length > 0 ? (
            <Table
              dataSource={salaryConfig}
              columns={salaryColumns}
              rowKey="id"
              pagination={false}
            />
          ) : <Empty description="暂无薪资配置" />
        },
        {
          key: 'allowance',
          label: '津贴配置',
          children: allowanceConfig.length > 0 ? (
            <Table
              dataSource={allowanceConfig}
              columns={allowanceColumns}
              rowKey="id"
              pagination={false}
            />
          ) : <Empty description="暂无津贴配置" />
        },
      ]} />
    </div>
  )
}

export default MySalary
