import React, { useState } from 'react'
import { Card, Typography, Space, Row, Col, Statistic, Progress, Tag, Alert } from 'antd'
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAnnualLeave } from '../../../hooks'
import { DataTable, type DataTableColumn, PageToolbar, EmptyText } from '../../../components/common'
import { DepartmentSelect } from '../../../components/form'

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
  const [selectedDept, setSelectedDept] = useState<string | undefined>()

  const { data: reportData, isLoading: loading } = useAnnualLeave(selectedDept ? { departmentId: selectedDept } : undefined)
  
  // 确保 data 始终是数组
  const data = Array.isArray(reportData?.results) ? reportData.results : []
  const summary = reportData?.summary || null
  const config = reportData?.config || null

  const columns: DataTableColumn<AnnualLeaveRecord>[] = [
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

      <Card bordered className="page-card page-card-outer">
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic
                title="员工总数"
                value={summary?.totalEmployees || 0}
                prefix={<TeamOutlined />}
                suffix="人"
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic
                title="总应得年假"
                value={summary?.totalEntitled || 0}
                prefix={<CalendarOutlined />}
                suffix="天"
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic
                title="已使用年假"
                value={summary?.totalUsed || 0}
                prefix={<CheckCircleOutlined />}
                suffix="天"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="page-card-inner">
              <Statistic
                title="平均使用率"
                value={summary?.avgUsageRate || 0}
                suffix="%"
                precision={0}
              />
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="page-card-inner">
        <PageToolbar style={{ marginBottom: 16 }}>
          <Text>筛选项目：</Text>
          <DepartmentSelect
            style={{ width: 200 }}
            placeholder="全部项目"
            allowClear
            value={selectedDept}
            onChange={setSelectedDept}
          />
        </PageToolbar>

        <DataTable<AnnualLeaveRecord>
          loading={loading}
          columns={columns}
          data={data}
          rowKey="employeeId"
          pagination={{ pageSize: 20 }}
          tableProps={{ scroll: { x: 1000 }, size: 'small' }}
        />
        </Card>
      </Card>
    </PageContainer>
  )
}

export default ReportAnnualLeave
