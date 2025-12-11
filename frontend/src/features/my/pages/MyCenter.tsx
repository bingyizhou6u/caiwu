import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Button, Descriptions, Tag, message, Spin, Space, Timeline, Alert, Modal, Tabs, Progress } from 'antd'
import { ClockCircleOutlined, LoginOutlined, LogoutOutlined, UserOutlined, CalendarOutlined, WalletOutlined, FileTextOutlined, DollarOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'

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
    borrowingBalanceCents: number
  }
  recentApplications: Array<{ id: string; type: string; sub_type: string; status: string; amount: string; createdAt: number }>
}

interface ProfileData {
  id: string; name: string; email: string; phone: string | null; idCard: string | null; bankAccount: string | null; bankName: string | null
  position: string; positionCode: string; department: string; orgDepartment: string; entryDate: string; contractEndDate: string | null
  emergencyContact: string | null; emergencyPhone: string | null; status: string; workSchedule: WorkSchedule | null
  annualLeaveCycleMonths: number; annualLeaveDays: number
  probationSalaryCents: number | null; regularSalaryCents: number | null; livingAllowanceCents: number | null
  housingAllowanceCents: number | null; transportationAllowanceCents: number | null; mealAllowanceCents: number | null
}

const dayNames: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
const statusColorMap: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', normal: 'green', late: 'orange', early: 'orange', late_early: 'red' }
const statusTextMap: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已拒绝', normal: '正常', late: '迟到', early: '早退', late_early: '迟到且早退' }
const typeTextMap: Record<string, string> = { leave: '请假', reimbursement: '报销', annual: '年假', sick: '病假', personal: '事假', other: '其他', travel: '差旅', office: '办公', meal: '餐饮', transport: '交通' }

import { PageContainer } from '../../../components/PageContainer'

export function MyCenter() {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [attendanceToday, setAttendanceToday] = useState<{ today: string; record: AttendanceRecord | null; workSchedule: WorkSchedule | null } | null>(null)
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashData, profileData, attendanceData] = await Promise.all([
        apiClient.get<DashboardData>(api.my.dashboard),
        apiClient.get<ProfileData>(api.my.profile),
        apiClient.get<any>(api.my.attendance.today),
      ])
      setDashboard(dashData)
      setProfile(profileData)
      setAttendanceToday(attendanceData)
    } catch { message.error('获取数据失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleClockIn = async () => {
    setClockingIn(true)
    try {
      const data = await apiClient.post<any>(api.my.attendance.clockIn, {})
      message.success(data.status === 'late' ? '签到成功（迟到）' : '签到成功')
      fetchData()
    } catch (error: any) { message.error(error.message || '签到失败') }
    finally { setClockingIn(false) }
  }

  const handleClockOut = async () => {
    Modal.confirm({
      title: '确认签退', content: '确定要签退吗？',
      onOk: async () => {
        setClockingOut(true)
        try {
          const data = await apiClient.post<any>(api.my.attendance.clockOut, {})
          message.success(data.status === 'early' ? '签退成功（早退）' : data.status === 'late_early' ? '签退成功（迟到且早退）' : '签退成功')
          fetchData()
        } catch (error: any) { message.error(error.message || '签退失败') }
        finally { setClockingOut(false) }
      },
    })
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

  const workSchedule = attendanceToday?.workSchedule || profile?.workSchedule
  const isWorkingDay = isWorkDay(workSchedule)

  return (
    <PageContainer
      title="工作台"
      breadcrumb={[{ title: '个人中心' }, { title: '工作台' }]}
    >
      <Card bordered={false} className="page-card">
        <Tabs defaultActiveKey="dashboard" items={[
          {
            key: 'dashboard', label: <span><ClockCircleOutlined /> 工作台</span>, children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title={<><ClockCircleOutlined /> 今日打卡</>} extra={<span style={{ fontSize: 24, fontWeight: 'bold' }}>{currentTime.toLocaleTimeString('zh-CN')}</span>}>
                    <Alert type={isWorkingDay ? 'info' : 'warning'} message={<Space direction="vertical" size={4} style={{ width: '100%' }}><div><strong>排班时间：</strong>{getWorkScheduleText(workSchedule)}</div>{!isWorkingDay && <div style={{ color: '#fa8c16' }}>今天不是工作日</div>}</Space>} style={{ marginBottom: 16 }} />
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={12}><Card size="small" style={{ textAlign: 'center', background: attendanceToday?.record?.clockInTime ? '#f6ffed' : '#fafafa' }}><div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签到时间</div><div style={{ fontSize: 20, fontWeight: 'bold', color: attendanceToday?.record?.clockInTime ? '#52c41a' : '#999' }}>{attendanceToday?.record?.clockInTime ? formatTime(attendanceToday.record.clockInTime) : '--:--:--'}</div></Card></Col>
                      <Col span={12}><Card size="small" style={{ textAlign: 'center', background: attendanceToday?.record?.clockOutTime ? '#f6ffed' : '#fafafa' }}><div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签退时间</div><div style={{ fontSize: 20, fontWeight: 'bold', color: attendanceToday?.record?.clockOutTime ? '#52c41a' : '#999' }}>{attendanceToday?.record?.clockOutTime ? formatTime(attendanceToday.record.clockOutTime) : '--:--:--'}</div></Card></Col>
                    </Row>
                    {attendanceToday?.record?.status && <div style={{ textAlign: 'center', marginBottom: 16 }}><Tag color={statusColorMap[attendanceToday.record.status] || 'default'}>{statusTextMap[attendanceToday.record.status] || attendanceToday.record.status}</Tag></div>}
                    <Row gutter={16}>
                      <Col span={12}><Button type="primary" icon={<LoginOutlined />} size="large" block disabled={!!attendanceToday?.record?.clockInTime} loading={clockingIn} onClick={handleClockIn} style={{ height: 60 }}>{attendanceToday?.record?.clockInTime ? '已签到' : '签到'}</Button></Col>
                      <Col span={12}><Button type="primary" danger icon={<LogoutOutlined />} size="large" block disabled={!attendanceToday?.record?.clockInTime || !!attendanceToday?.record?.clockOutTime} loading={clockingOut} onClick={handleClockOut} style={{ height: 60 }}>{attendanceToday?.record?.clockOutTime ? '已签退' : '签退'}</Button></Col>
                    </Row>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title={<><CalendarOutlined /> 本期年假</>}>
                    {dashboard?.stats.annualLeave ? (<><Progress percent={dashboard.stats.annualLeave.total > 0 ? Math.round((dashboard.stats.annualLeave.used / dashboard.stats.annualLeave.total) * 100) : 0} status={dashboard.stats.annualLeave.remaining > 0 ? 'active' : 'exception'} strokeColor={dashboard.stats.annualLeave.remaining > 0 ? '#1890ff' : '#ff4d4f'} />
                      <Row gutter={16} style={{ marginTop: 16 }}><Col span={8}><Statistic title="本期天数" value={dashboard.stats.annualLeave.total} suffix="天" /></Col><Col span={8}><Statistic title="已使用" value={dashboard.stats.annualLeave.used} suffix="天" valueStyle={{ color: '#ff4d4f' }} /></Col><Col span={8}><Statistic title="剩余" value={dashboard.stats.annualLeave.remaining} suffix="天" valueStyle={{ color: '#52c41a' }} /></Col></Row>
                      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>周期：{dashboard.stats.annualLeave.cycleMonths === 6 ? '半年制' : '年制'} | 第 {dashboard.stats.annualLeave.cycleNumber} 周期{dashboard.stats.annualLeave.cycleStart && ` (${dashboard.stats.annualLeave.cycleStart} - ${dashboard.stats.annualLeave.cycleEnd})`}</div></>) : <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无年假数据</div>}
                  </Card>
                  <Card title={<><WalletOutlined /> 财务概览</>} style={{ marginTop: 16 }}>
                    <Row gutter={16}><Col span={12}><Statistic title="待报销" value={formatCents(dashboard?.stats.pendingReimbursementCents || 0)} prefix="¥" valueStyle={{ color: '#faad14' }} /></Col><Col span={12}><Statistic title="借支余额" value={formatCents(dashboard?.stats.borrowingBalanceCents || 0)} prefix="¥" valueStyle={{ color: dashboard?.stats.borrowingBalanceCents ? '#ff4d4f' : '#52c41a' }} /></Col></Row>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title={<><FileTextOutlined /> 最近申请</>}>
                    {dashboard?.recentApplications && dashboard.recentApplications.length > 0 ? <Timeline items={dashboard.recentApplications.map(app => ({ color: statusColorMap[app.status] || 'gray', children: <div><Tag>{typeTextMap[app.type] || app.type}</Tag><Tag color="blue">{typeTextMap[app.sub_type] || app.sub_type}</Tag><Tag color={statusColorMap[app.status]}>{statusTextMap[app.status] || app.status}</Tag><span style={{ marginLeft: 8, color: '#999' }}>{new Date(app.createdAt).toLocaleDateString('zh-CN')}</span></div> }))} /> : <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无申请记录</div>}
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'profile', label: <span><UserOutlined /> 个人信息</span>, children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title={<><UserOutlined /> 基本信息</>}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="姓名">{profile?.name || '-'}</Descriptions.Item>
                      <Descriptions.Item label="邮箱">{profile?.email || '-'}</Descriptions.Item>
                      <Descriptions.Item label="手机">{profile?.phone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="部门">{profile?.orgDepartment || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目">{profile?.department || '-'}</Descriptions.Item>
                      <Descriptions.Item label="职位">{profile?.position || '-'}</Descriptions.Item>
                      <Descriptions.Item label="入职日期">{profile?.entryDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label="合同到期">{profile?.contractEndDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label="状态"><Tag color={profile?.status === 'active' ? 'green' : profile?.status === 'probation' ? 'orange' : 'default'}>{profile?.status === 'active' ? '正式' : profile?.status === 'probation' ? '试用' : profile?.status || '-'}</Tag></Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title={<><CalendarOutlined /> 工作安排</>}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="排班时间">{getWorkScheduleText(profile?.workSchedule)}</Descriptions.Item>
                      <Descriptions.Item label="年假周期">{profile?.annualLeaveCycleMonths === 6 ? '半年制（6个月）' : '年制（12个月）'}</Descriptions.Item>
                      <Descriptions.Item label="年假天数">{profile?.annualLeaveDays || 0} 天/周期</Descriptions.Item>
                    </Descriptions>
                  </Card>
                  <Card title={<><SafetyCertificateOutlined /> 紧急联系人</>} style={{ marginTop: 16 }}>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="紧急联系人">{profile?.emergencyContact || '-'}</Descriptions.Item>
                      <Descriptions.Item label="紧急联系电话">{profile?.emergencyPhone || '-'}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title={<><DollarOutlined /> 薪资福利</>}>
                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={8} md={6}><Statistic title="试用期薪资" value={profile?.probationSalaryCents ? formatCents(profile.probationSalaryCents) : '-'} prefix={profile?.probationSalaryCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="正式薪资" value={profile?.regularSalaryCents ? formatCents(profile.regularSalaryCents) : '-'} prefix={profile?.regularSalaryCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="生活补贴" value={profile?.livingAllowanceCents ? formatCents(profile.livingAllowanceCents) : '-'} prefix={profile?.livingAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="住房补贴" value={profile?.housingAllowanceCents ? formatCents(profile.housingAllowanceCents) : '-'} prefix={profile?.housingAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="交通补贴" value={profile?.transportationAllowanceCents ? formatCents(profile.transportationAllowanceCents) : '-'} prefix={profile?.transportationAllowanceCents ? '¥' : ''} /></Col>
                      <Col xs={12} sm={8} md={6}><Statistic title="餐饮补贴" value={profile?.mealAllowanceCents ? formatCents(profile.mealAllowanceCents) : '-'} prefix={profile?.mealAllowanceCents ? '¥' : ''} /></Col>
                    </Row>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title="银行信息">
                    <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                      <Descriptions.Item label="身份证号">{profile?.idCard || '-'}</Descriptions.Item>
                      <Descriptions.Item label="银行名称">{profile?.bankName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="银行账号">{profile?.bankAccount || '-'}</Descriptions.Item>
                    </Descriptions>
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
