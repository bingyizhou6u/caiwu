import { Card, Row, Col, Statistic, List, Typography, Avatar, Space, Spin } from 'antd'
import {
  DollarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BankOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMyDashboard } from '../../../hooks'
import type { MyDashboard } from '../../../hooks/business/useMy'
import { StatusTag, AmountDisplay } from '../../../components/common'
import { REIMBURSEMENT_STATUS, LEAVE_STATUS } from '../../../utils/status'

const { Title, Text } = Typography

const leaveTypeLabels: Record<string, string> = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  other: '其他',
}

const expenseTypeLabels: Record<string, string> = {
  travel: '差旅费',
  office: '办公用品',
  meal: '餐饮',
  transport: '交通',
  other: '其他',
}

import { PageContainer } from '../../../components/PageContainer'

export function MyDashboard() {
  const { data, isLoading: loading } = useMyDashboard()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!data) {
    return <div>加载失败</div>
  }

  const { employee, stats, recentApplications } = data
  const mainSalary = stats.salary.find((s) => s.currencyId === 'CNY')

  return (
    <PageContainer
      title="个人首页"
      breadcrumb={[{ title: '个人中心' }, { title: '首页' }]}
    >
      {/* 用户信息卡片 */}
      <Card style={{ marginBottom: 24 }} bordered={false} className="page-card">
        <Space size="large">
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{employee.name}</Title>
            <Text type="secondary">{employee.position} · {employee.orgDepartment || employee.department}</Text>
            <br />
            <Text type="secondary">{employee.email}</Text>
          </div>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="page-card">
            <Statistic
              title="本月薪资"
              value={mainSalary ? mainSalary.totalCents / 100 : 0}
              prefix={<DollarOutlined />}
              suffix="元"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="page-card">
            <Statistic
              title={stats.annualLeave.isFirstCycle ? "年假（试用期）" : `年假（第${stats.annualLeave.cycleNumber}周期）`}
              value={stats.annualLeave.remaining}
              prefix={<CalendarOutlined />}
              suffix={stats.annualLeave.isFirstCycle ? "暂无" : `/ ${stats.annualLeave.total} 天`}
              valueStyle={stats.annualLeave.isFirstCycle ? { color: '#999' } : undefined}
            />
            {!stats.annualLeave.isFirstCycle && stats.annualLeave.cycleEnd && (
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                周期：{stats.annualLeave.cycleStart} 至 {stats.annualLeave.cycleEnd}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="page-card">
            <Statistic
              title="待报销"
              value={stats.pendingReimbursementCents / 100}
              prefix={<FileTextOutlined />}
              suffix="元"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="page-card">
            <Statistic
              title="借支余额"
              value={stats.borrowingBalanceCents / 100}
              prefix={<BankOutlined />}
              suffix="元"
              precision={2}
              valueStyle={{ color: stats.borrowingBalanceCents > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近申请 */}
      <Card title="最近申请" style={{ marginTop: 24 }} bordered={false} className="page-card">
        <List
          dataSource={recentApplications}
          locale={{ emptyText: '暂无申请记录' }}
          renderItem={(item: MyDashboard['recentApplications'][number]) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  item.type === 'leave'
                    ? <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    : <FileTextOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                }
                title={
                  <Space>
                    <span>
                      {item.type === 'leave'
                        ? `请假 - ${leaveTypeLabels[item.subType] || item.subType}`
                        : `报销 - ${expenseTypeLabels[item.subType] || item.subType}`
                      }
                    </span>
                    <StatusTag 
                      status={item.status || ''} 
                      statusMap={item.type === 'leave' ? LEAVE_STATUS : REIMBURSEMENT_STATUS} 
                    />
                  </Space>
                }
                description={
                  <Space>
                    <ClockCircleOutlined />
                    {item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
                    {item.amount && (
                      <span style={{ marginLeft: 16 }}>
                        {item.type === 'leave' ? (
                          item.amount
                        ) : (
                          <AmountDisplay cents={parseInt(item.amount)} currency="CNY" />
                        )}
                      </span>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </PageContainer>
  )
}

export default MyDashboard
