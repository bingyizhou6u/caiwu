import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Button, Descriptions, Tag, message, Spin, Space, Timeline, Alert, Modal, Tabs, Progress } from 'antd'
import { ClockCircleOutlined, LoginOutlined, LogoutOutlined, UserOutlined, CalendarOutlined, WalletOutlined, FileTextOutlined, DollarOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMyDashboard, useMyProfile } from '../../../hooks'
// TODO: 考勤功能暂未实现
// import { useAttendanceToday, useClockIn, useClockOut } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { StatusTag, EmptyText } from '../../../components/common'
import { LEAVE_STATUS, REIMBURSEMENT_STATUS, COMMON_STATUS, EMPLOYEE_STATUS, getStatusConfig } from '../../../utils/status'

interface WorkSchedule {
  days: number[]
  start: string
  end: string
}

interface AttendanceRecord {
  id: string
  date: string
  clockInTime: number | null
  clockOutTime: number | null
  status: string
}

interface DashboardData {
  employee: { id: string; name: string; email: string; position: string; department: string; orgDepartment: string }
  stats: {
    salary: Array<{ total_cents: number; currencyId: string }>
    annualLeave: { cycleMonths: number; cycleNumber: number; cycleStart: string | null; cycleEnd: string | null; isFirstCycle: boolean; total: number; used: number; remaining: number }
    pendingReimbursementCents: number
  }
  recentApplications: Array<{ id: string; type: string; sub_type: string; status: string; amount: string; createdAt: number }>
}

interface ProfileData {
  id: string; name: string; email: string; phone: string | null
  position: string; positionCode: string; department: string; orgDepartment: string; entryDate: string; contractEndDate: string | null
  emergencyContact: string | null; emergencyPhone: string | null; status: string; workSchedule: WorkSchedule | null
  annualLeaveCycleMonths: number; annualLeaveDays: number
  probationSalaryCents: number | null; regularSalaryCents: number | null; livingAllowanceCents: number | null
  housingAllowanceCents: number | null; transportationAllowanceCents: number | null; mealAllowanceCents: number | null
}

const dayNames: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
const typeTextMap: Record<string, string> = { leave: '请假', reimbursement: '报销', annual: '年假', sick: '病假', personal: '事假', other: '其他', travel: '差旅', office: '办公', meal: '餐饮', transport: '交通' }

// 将 StatusConfig 的颜色转换为 Timeline 的颜色
function getTimelineColor(status: string | null | undefined, statusMap: Record<string, any>): string {
  const config = getStatusConfig(status, statusMap)
  if (!config) return 'gray'
  // 将 Tag 颜色映射到 Timeline 颜色
  const colorMap: Record<string, string> = {
    processing: 'orange',
    success: 'green',
    error: 'red',
    warning: 'orange',
    default: 'gray',
  }
  return colorMap[config.color || 'default'] || 'gray'
}

import { PageContainer } from '../../../components/PageContainer'

export function MyCenter() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  // Hooks
  const { data: dashboard, isLoading: dashboardLoading } = useMyDashboard()
  const { data: profile, isLoading: profileLoading } = useMyProfile()
  // TODO: 考勤功能暂未实现
  // const { data: attendanceToday, isLoading: attendanceLoading } = useAttendanceToday()
  // const { mutateAsync: clockIn, isPending: clockingIn } = useClockIn()
  // const { mutateAsync: clockOut, isPending: clockingOut } = useClockOut()
  const attendanceToday: { today: string; record: AttendanceRecord | null; workSchedule: WorkSchedule | null } | null = null
  const attendanceLoading = false
  const clockingIn = false
  const clockingOut = false

  const loading = dashboardLoading || profileLoading || attendanceLoading

  // TODO: 考勤功能暂未实现
  const handleClockIn = () => {
    message.warning('考勤功能暂未实现')
  }

  const handleClockOut = () => {
    message.warning('考勤功能暂未实现')
  }

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatCents = (cents: number) => (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  const getWorkScheduleText = (schedule: WorkSchedule | null | undefined): string => {
    if (!schedule) return '未设置'
    return `${schedule.days.map(d => dayNames[d]).join('、')} ${schedule.start} - ${schedule.end}`
  }
  const isWorkDay = (schedule: WorkSchedule | null | undefined): boolean => {
    if (!schedule) return true
    return schedule.days.includes(currentTime.getDay())
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>

  // 转换数据格式以兼容现有代码
  const dashboardData: DashboardData | null = dashboard ? {
    employee: dashboard.employee,
    stats: {
      salary: dashboard.stats.salary.map((s: { totalCents: number; currencyId: string }) => ({ total_cents: s.totalCents, currencyId: s.currencyId })),
      annualLeave: dashboard.stats.annualLeave,
      pendingReimbursementCents: dashboard.stats.pendingReimbursementCents,
    },
    recentApplications: dashboard.recentApplications.map((app: { id: string; type: string; subType: string; status: string | null; amount: string | null; createdAt: number | null }) => ({
      ...app,
      sub_type: app.subType,
    })),
  } : null

  const profileData: ProfileData | null = profile ? {
    ...profile,
    workSchedule: (profile as any)?.workSchedule || null,
  } : null

  const attendanceData: { today: string; record: AttendanceRecord | null; workSchedule: WorkSchedule | null } | null = attendanceToday ? {
    today: (attendanceToday as any).today,
    record: (attendanceToday as any).record,
    workSchedule: (attendanceToday as any).workSchedule,
  } : null

  const workSchedule = attendanceData?.workSchedule || profileData?.workSchedule
  const isWorkingDay = isWorkDay(workSchedule)

  return (
    <PageContainer
      title="工作台"
      breadcrumb={[{ title: '个人中心' }, { title: '工作台' }]}
    >
      <Card bordered className="page-card page-card-outer">
        <Tabs defaultActiveKey="dashboard" items={[
          {
            key: 'dashboard', label: <span><ClockCircleOutlined /> 工作台</span>, children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title={<><ClockCircleOutlined /> 今日打卡</>} extra={<span style={{ fontSize: 24, fontWeight: 'bold' }}>{currentTime.toLocaleTimeString('zh-CN')}</span>} className="page-card-inner">
                    <Alert type={isWorkingDay ? 'info' : 'warning'} message={<Space direction="vertical" size={4} style={{ width: '100%' }}><div><strong>排班时间：</strong>{getWorkScheduleText(workSchedule)}</div>{!isWorkingDay && <div style={{ color: '#fa8c16' }}>今天不是工作日</div>}</Space>} style={{ marginBottom: 16 }} />
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={12}><Card size="small" style={{ textAlign: 'center', background: attendanceData?.record?.clockInTime ? '#f6ffed' : '#fafafa' }}><div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签到时间</div><div style={{ fontSize: 20, fontWeight: 'bold', color: attendanceData?.record?.clockInTime ? '#52c41a' : '#999' }}>{attendanceData?.record?.clockInTime ? formatTime(attendanceData.record.clockInTime) : '--:--:--'}</div></Card></Col>
                      <Col span={12}><Card size="small" style={{ textAlign: 'center', background: attendanceData?.record?.clockOutTime ? '#f6ffed' : '#fafafa' }}><div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签退时间</div><div style={{ fontSize: 20, fontWeight: 'bold', color: attendanceData?.record?.clockOutTime ? '#52c41a' : '#999' }}>{attendanceData?.record?.clockOutTime ? formatTime(attendanceData.record.clockOutTime) : '--:--:--'}</div></Card></Col>
                    </Row>
                    {attendanceData?.record?.status && (
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <StatusTag status={attendanceData.record.status} statusMap={COMMON_STATUS} />
                      </div>
                    )}
                    <Row gutter={16}>
                      <Col span={12}><Button type="primary" icon={<LoginOutlined />} size="large" block disabled={!!attendanceData?.record?.clockInTime} loading={clockingIn} onClick={handleClockIn} style={{ height: 60 }}>{attendanceData?.record?.clockInTime ? '已签到' : '签到'}</Button></Col>
                      <Col span={12}><Button type="primary" danger icon={<LogoutOutlined />} size="large" block disabled={!attendanceData?.record?.clockInTime || !!attendanceData?.record?.clockOutTime} loading={clockingOut} onClick={handleClockOut} style={{ height: 60 }}>{attendanceData?.record?.clockOutTime ? '已签退' : '签退'}</Button></Col>
                    </Row>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title={<><CalendarOutlined /> 本期年假</>} className="page-card-inner">
                    {dashboardData?.stats.annualLeave ? (<><Progress percent={dashboardData.stats.annualLeave.total > 0 ? Math.round((dashboardData.stats.annualLeave.used / dashboardData.stats.annualLeave.total) * 100) : 0} status={dashboardData.stats.annualLeave.remaining > 0 ? 'active' : 'exception'} strokeColor={dashboardData.stats.annualLeave.remaining > 0 ? '#1890ff' : '#ff4d4f'} />
                      <Row gutter={16} style={{ marginTop: 16 }}><Col span={8}><Statistic title="本期天数" value={dashboardData.stats.annualLeave.total} suffix="天" /></Col><Col span={8}><Statistic title="已使用" value={dashboardData.stats.annualLeave.used} suffix="天" valueStyle={{ color: '#ff4d4f' }} /></Col><Col span={8}><Statistic title="剩余" value={dashboardData.stats.annualLeave.remaining} suffix="天" valueStyle={{ color: '#52c41a' }} /></Col></Row>
                      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>周期：{dashboardData.stats.annualLeave.cycleMonths === 6 ? '半年制' : '年制'} | 第 {dashboardData.stats.annualLeave.cycleNumber} 周期{dashboardData.stats.annualLeave.cycleStart && ` (${dashboardData.stats.annualLeave.cycleStart} - ${dashboardData.stats.annualLeave.cycleEnd})`}</div></>) : <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无年假数据</div>}
                  </Card>
                  <Card title={<><WalletOutlined /> 财务概览</>} style={{ marginTop: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <Row gutter={16}><Col span={24}><Statistic title="待报销" value={formatCents(dashboardData?.stats.pendingReimbursementCents || 0)} prefix="¥" valueStyle={{ color: '#faad14' }} /></Col></Row>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title={<><FileTextOutlined /> 最近申请</>} className="page-card-inner">
                    {dashboardData?.recentApplications && dashboardData.recentApplications.length > 0 ? <Timeline items={dashboardData.recentApplications.map(app => ({ color: getTimelineColor(app.status, app.type === 'leave' ? LEAVE_STATUS : REIMBURSEMENT_STATUS), children: <div><Tag>{typeTextMap[app.type] || app.type}</Tag><Tag color="blue">{typeTextMap[app.sub_type] || app.sub_type}</Tag><StatusTag status={app.status || ''} statusMap={app.type === 'leave' ? LEAVE_STATUS : REIMBURSEMENT_STATUS} /><span style={{ marginLeft: 8, color: '#999' }}>{app.createdAt ? new Date(app.createdAt).toLocaleDateString('zh-CN') : ''}</span></div> }))} /> : <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无申请记录</div>}
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'profile', label: <span><UserOutlined /> 个人信息</span>, children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title={<><UserOutlined /> 基本信息</>} className="page-card-inner">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="姓名"><EmptyText value={profileData?.name} /></Descriptions.Item>
                      <Descriptions.Item label="邮箱"><EmptyText value={profileData?.email} /></Descriptions.Item>
                      <Descriptions.Item label="手机"><EmptyText value={profileData?.phone} /></Descriptions.Item>
                      <Descriptions.Item label="部门"><EmptyText value={profileData?.orgDepartment} /></Descriptions.Item>
                      <Descriptions.Item label="项目"><EmptyText value={profileData?.department} /></Descriptions.Item>
                      <Descriptions.Item label="职位"><EmptyText value={profileData?.position} /></Descriptions.Item>
                      <Descriptions.Item label="入职日期"><EmptyText value={profileData?.entryDate} /></Descriptions.Item>
                      <Descriptions.Item label="合同到期"><EmptyText value={profileData?.contractEndDate} /></Descriptions.Item>
                      <Descriptions.Item label="状态"><StatusTag status={profileData?.status || ''} statusMap={EMPLOYEE_STATUS} /></Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title={<><CalendarOutlined /> 工作安排</>} className="page-card-inner">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="排班时间">{getWorkScheduleText(profileData?.workSchedule)}</Descriptions.Item>
                      <Descriptions.Item label="年假周期">{profileData?.annualLeaveCycleMonths === 6 ? '半年制（6个月）' : '年制（12个月）'}</Descriptions.Item>
                      <Descriptions.Item label="年假天数">{profileData?.annualLeaveDays || 0} 天/周期</Descriptions.Item>
                    </Descriptions>
                  </Card>
                  <Card title={<><SafetyCertificateOutlined /> 紧急联系人</>} style={{ marginTop: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="紧急联系人"><EmptyText value={profileData?.emergencyContact} /></Descriptions.Item>
                      <Descriptions.Item label="紧急联系电话"><EmptyText value={profileData?.emergencyPhone} /></Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title={<><DollarOutlined /> 薪资福利</>} className="page-card-inner">
                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={8} md={6}><Statistic title="试用期薪资" value={profileData?.probationSalaryCents ? formatCents(profileData.probationSalaryCents) : '-'} prefix={profileData?.probationSalaryCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="正式薪资" value={profileData?.regularSalaryCents ? formatCents(profileData.regularSalaryCents) : '-'} prefix={profileData?.regularSalaryCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="生活补贴" value={profileData?.livingAllowanceCents ? formatCents(profileData.livingAllowanceCents) : '-'} prefix={profileData?.livingAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="住房补贴" value={profileData?.housingAllowanceCents ? formatCents(profileData.housingAllowanceCents) : '-'} prefix={profileData?.housingAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="交通补贴" value={profileData?.transportationAllowanceCents ? formatCents(profileData.transportationAllowanceCents) : '-'} prefix={profileData?.transportationAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="餐饮补贴" value={profileData?.mealAllowanceCents ? formatCents(profileData.mealAllowanceCents) : '-'} prefix={profileData?.mealAllowanceCents ? '¥' : ''} /></Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            )
          },
        ]} />
      </Card>
    </PageContainer>
  )
}

export default MyCenter
