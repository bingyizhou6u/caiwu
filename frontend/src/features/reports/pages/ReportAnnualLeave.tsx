import { useState, useEffect } from 'react'
import { Card, Table, Typography, Space, Spin, Select, Row, Col, Statistic, Progress, Tag, Alert } from 'antd'
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'

const { Title, Text } = Typography

interface AnnualLeaveRecord {
  employeeId: string
  employeeName: string
  departmentName: string
  orgDepartmentName: string
  joinDate: string
  cycleNumber: number
  cycleStart: string
  cycleEnd: string
  isFirstCycle: boolean
  entitledDays: number
  usedDays: number
  remainingDays: number
  usageRate: number
}

interface Summary {
  totalEmployees: number
  totalEntitled: number
  totalUsed: number
  totalRemaining: number
  avgUsageRate: number
}

interface AnnualLeaveConfig {
  cycleMonths: number
  daysPerCycle: number
}

import { PageContainer } from '../../../components/PageContainer'

export function ReportAnnualLeave() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnnualLeaveRecord[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [config, setConfig] = useState<AnnualLeaveConfig | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<string | undefined>()

  useEffect(() => {
    loadDepartments()
    loadData()
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedDept])

  const loadDepartments = async () => {
    try {
      const result = await apiClient.get<any>(api.departments)
      setDepartments(result.results || [])
    } catch (e) {
      console.error('Failed to load departments:', e)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedDept) params.set('departmentId', selectedDept)

      const result = await apiClient.get<any>(`${api.reports.annualLeave}?${params}`)
      setData(result.results || [])
      setSummary(result.summary || null)
      setConfig(result.config || null)
    } catch (error) {
      console.error('Failed to load annual leave report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<AnnualLeaveRecord> = [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 100,
    },
    {
      title: '组织部门',
      dataIndex: 'orgDepartmentName',
      key: 'orgDepartmentName',
      width: 100,
    },
    {
      title: '入职日期',
      dataIndex: 'joinDate',
      key: 'joinDate',
      width: 100,
    },
    {
      title: '当前周期',
      key: 'cycle',
      width: 100,
      render: (_, record) => (
        record.isFirstCycle
          ? <Tag color="orange">第1周期（无年假）</Tag>
          : <Tag color="blue">第{record.cycleNumber}周期</Tag>
      ),
    },
    {
      title: '周期时间',
      key: 'cycleDate',
      width: 180,
      render: (_, record) => (
        <Text type="secondary">{record.cycleStart} 至 {record.cycleEnd}</Text>
      ),
    },
    {
      title: '应得/已用/剩余',
      key: 'days',
      width: 150,
      render: (_, record) => (
        record.isFirstCycle
          ? <Text type="secondary">-</Text>
          : <Space>
            <Text strong>{record.entitledDays}</Text>
            <Text>/</Text>
            <Text type={record.usedDays > 0 ? 'success' : undefined}>{record.usedDays}</Text>
            <Text>/</Text>
            <Text type={record.remainingDays > 0 ? 'warning' : 'danger'}>{record.remainingDays}</Text>
          </Space>
      ),
    },
    {
      title: '使用率',
      key: 'usageRate',
      width: 120,
      render: (_, record) => (
        record.isFirstCycle
          ? <Text type="secondary">-</Text>
          : <Progress
            percent={record.usageRate}
            size="small"
            status={record.usageRate >= 80 ? 'success' : record.usageRate >= 50 ? 'normal' : 'exception'}
          />
      ),
    },
  ]

  return (
    <PageContainer
      title="年假统计报表"
      breadcrumb={[{ title: '报表中心' }, { title: '年假统计报表' }]}
    >
      {config && (
        <Alert
          message={`当前年假制度：${config.cycleMonths === 6 ? '半年制' : '年制'}，每周期 ${config.daysPerCycle} 天`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card style={{ marginBottom: 24 }} bordered={false} className="page-card">
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="员工总数"
              value={summary?.totalEmployees || 0}
              prefix={<TeamOutlined />}
              suffix="人"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总应得年假"
              value={summary?.totalEntitled || 0}
              prefix={<CalendarOutlined />}
              suffix="天"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已使用年假"
              value={summary?.totalUsed || 0}
              prefix={<CheckCircleOutlined />}
              suffix="天"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均使用率"
              value={summary?.avgUsageRate || 0}
              suffix="%"
              precision={0}
            />
          </Col>
        </Row>
      </Card>

      <Card bordered={false} className="page-card">
        <Space style={{ marginBottom: 16 }}>
          <Text>筛选项目：</Text>
          <Select
            style={{ width: 200 }}
            placeholder="全部项目"
            allowClear
            value={selectedDept}
            onChange={setSelectedDept}
          >
            {departments.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          className="table-striped"
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="employeeId"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>
    </PageContainer>
  )
}

export default ReportAnnualLeave
