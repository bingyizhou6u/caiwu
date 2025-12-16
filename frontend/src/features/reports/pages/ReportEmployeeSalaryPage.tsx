import { useState, useMemo } from 'react'
import { Card, Space, Select, Statistic, Row, Col } from 'antd'
import { formatAmount } from '../../../utils/formatters'
import { DataTable } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { useEmployeeSalary } from '../../../hooks'
import type { ColumnsType } from 'antd/es/table'

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
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(undefined)

  const { data, isLoading: loading } = useEmployeeSalary({ year, month })
  // 确保 dataRows 始终是数组，防止 React 错误
  const dataRows = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : [])

  // 计算汇总数据
  const summary = useMemo(() => {
    return dataRows.reduce((acc: { totalSalary: number; employeeIds: Set<string> }, row: EmployeeSalaryRow) => {
      acc.totalSalary += row.actualSalaryCents
      acc.employeeIds.add(row.employeeId)
      return acc
    }, {
      totalSalary: 0,
      employeeIds: new Set<string>(),
    })
  }, [dataRows])
  
  const employeeCount = summary.employeeIds.size

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
      sorter: (a: EmployeeSalaryRow, b: EmployeeSalaryRow) => {
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
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={[
            {
              name: 'year',
              label: '年份',
              type: 'select',
              placeholder: '请选择年份',
              options: yearOptions,
            },
            {
              name: 'month',
              label: '月份',
              type: 'select',
              placeholder: '全部月份',
              options: [{ label: '全部月份', value: undefined }, ...monthOptions],
            },
          ]}
          onSearch={(values) => {
            setYear(values.year || new Date().getFullYear())
            setMonth(values.month)
          }}
          onReset={() => {
            setYear(new Date().getFullYear())
            setMonth(undefined)
          }}
          initialValues={{ year, month }}
        />

        <Row gutter={16} style={{ marginBottom: 16, marginTop: 16 }}>
          <Col span={8}>
            <Statistic
              title="员工总数"
              value={employeeCount}
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
              value={employeeCount > 0 ? (summary.totalSalary / employeeCount) / 100 : 0}
              precision={2}
            />
          </Col>
        </Row>

        <DataTable<EmployeeSalaryRow>
          columns={columns}
          data={dataRows}
          loading={loading}
          rowKey={(record) => `${record.employeeId}-${record.year}-${record.month}`}
          pagination={{ pageSize: 20 }}
          tableProps={{
            className: 'table-striped',
            scroll: { x: 1200 },
          }}
        />
      </Card>
    </PageContainer>
  )
}

