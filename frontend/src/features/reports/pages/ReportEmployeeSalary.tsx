import { useState, useEffect } from 'react'
import { Card, Table, Space, Select, message, Statistic, Row, Col } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import type { ColumnsType } from 'antd/es/table'
import { formatAmount } from '../../../utils/formatters'

type EmployeeSalaryRow = {
  employeeId: string
  employeeName: string
  departmentId: string
  departmentName?: string
  year: number
  month: number
  joinDate: string
  status: 'probation' | 'regular'
  regularDate?: string
  baseSalaryCents: number
  workDays: number
  daysInMonth: number
  leaveDays?: number
  actualSalaryCents: number
}

import { PageContainer } from '../../../components/PageContainer'

export function ReportEmployeeSalary() {
  const [data, setData] = useState<EmployeeSalaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(undefined)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('year', String(year))
      if (month !== undefined) {
        params.append('month', String(month))
      }
      const results = await apiClient.get<{ results: EmployeeSalaryRow[] }>(
        `${api.reports.employeeSalary}?${params.toString()}`
      )
      setData(results.results || [])
    } catch (error: any) {
      message.error(error.message || '加载薪资表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [year, month])

  // 计算汇总数据
  const summary = data.reduce((acc, row) => {
    acc.totalSalary += row.actualSalaryCents
    acc.employeeCount = new Set([...acc.employeeIds, row.employeeId]).size
    acc.employeeIds.add(row.employeeId)
    return acc
  }, {
    totalSalary: 0,
    employeeCount: 0,
    employeeIds: new Set<string>(),
  })

  const columns: ColumnsType<EmployeeSalaryRow> = [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      fixed: 'left',
      width: 120,
    },
    {
      title: '项目',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
    },
    {
      title: '入职日期',
      dataIndex: 'joinDate',
      key: 'joinDate',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <span style={{ color: status === 'regular' ? '#52c41a' : '#faad14' }}>
          {status === 'regular' ? '已转正' : '试用期'}
        </span>
      ),
    },
    {
      title: '转正日期',
      dataIndex: 'regularDate',
      key: 'regularDate',
      width: 120,
      render: (date: string) => date || '-',
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 80,
      render: (m: number) => `${m}月`,
      sorter: (a, b) => {
        // 首先按年份降序
        if (a.year !== b.year) {
          return b.year - a.year
        }
        // 然后按月份降序（最新月份优先）
        return b.month - a.month
      },
      defaultSortOrder: 'descend',
    },
    {
      title: '基础工资',
      dataIndex: 'baseSalaryCents',
      key: 'baseSalaryCents',
      width: 120,
      align: 'right',
      render: (cents: number) => formatAmount(cents),
    },
    {
      title: '工作天数',
      dataIndex: 'work_days',
      key: 'work_days',
      width: 100,
      align: 'right',
    },
    {
      title: '请假天数',
      dataIndex: 'leaveDays',
      key: 'leaveDays',
      width: 100,
      align: 'right',
      render: (days: number) => days ? `${days.toFixed(1)}天` : '-',
    },
    {
      title: '月总天数',
      dataIndex: 'daysInMonth',
      key: 'daysInMonth',
      width: 100,
      align: 'right',
    },
    {
      title: '应发工资',
      dataIndex: 'actualSalaryCents',
      key: 'actualSalaryCents',
      width: 120,
      align: 'right',
      render: (cents: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {formatAmount(cents)}
        </span>
      ),
    },
  ]

  // 生成年份选项
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => ({
    value: y,
    label: `${y}年`,
  }))

  // 生成月份选项
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
    value: m,
    label: `${m}月`,
  }))

  return (
    <PageContainer
      title="员工薪资报表"
      breadcrumb={[{ title: '报表中心' }, { title: '员工薪资报表' }]}
      extra={
        <Space>
          <Select
            style={{ width: 120 }}
            value={year}
            onChange={setYear}
            options={yearOptions}
          />
          <Select
            style={{ width: 120 }}
            value={month}
            onChange={setMonth}
            placeholder="全部月份"
            allowClear
            options={monthOptions}
          />
        </Space>
      }
    >
      <Card bordered={false} className="page-card">
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Statistic
              title="员工总数"
              value={summary.employeeCount}
              suffix="人"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="工资总额"
              value={summary.totalSalary / 100}
              precision={2}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="平均工资"
              value={summary.employeeCount > 0 ? (summary.totalSalary / summary.employeeCount) / 100 : 0}
              precision={2}
            />
          </Col>
        </Row>

        <Table
          className="table-striped"
          columns={columns}
          dataSource={data}
          rowKey={(record) => `${record.employeeId}-${record.year}-${record.month}`}
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </PageContainer>
  )
}

