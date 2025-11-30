import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Typography, Modal, message, Tooltip } from 'antd'
import { 
  LogoutOutlined, 
  DesktopOutlined, 
  MobileOutlined, 
  TabletOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { authedJsonFetch } from '../utils/authedFetch'
import { api } from '../config/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text } = Typography

interface Session {
  id: string
  deviceInfo: string
  ipAddress: string
  createdAt: number | null
  lastActiveAt: number | null
  expiresAt: number
  isCurrent: boolean
}

export default function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const data = await authedJsonFetch(`${api.base}/api/sessions`)
      setSessions(data.sessions || [])
    } catch (error) {
      message.error('获取会话列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleLogout = (session: Session) => {
    Modal.confirm({
      title: '确认登出此会话？',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>设备：</strong>{session.deviceInfo}</p>
          <p><strong>IP：</strong>{session.ipAddress}</p>
          {session.isCurrent && (
            <Tag color="warning">这是当前会话，登出后需要重新登录</Tag>
          )}
        </div>
      ),
      okText: '确认登出',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await authedJsonFetch(`${api.base}/api/sessions/${session.id}`, {
            method: 'DELETE'
          })
          message.success('已登出该会话')
          if (session.isCurrent) {
            // 当前会话被登出，刷新页面触发重新登录
            window.location.href = '/login'
          } else {
            fetchSessions()
          }
        } catch (error) {
          message.error('操作失败')
        }
      }
    })
  }

  const handleLogoutAll = () => {
    Modal.confirm({
      title: '确认登出所有其他会话？',
      icon: <ExclamationCircleOutlined />,
      content: '这将登出除当前会话外的所有其他设备上的会话。',
      okText: '确认登出全部',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await authedJsonFetch(`${api.base}/api/sessions`, {
            method: 'DELETE'
          })
          message.success(result.message || '已登出所有其他会话')
          fetchSessions()
        } catch (error) {
          message.error('操作失败')
        }
      }
    })
  }

  const getDeviceIcon = (deviceInfo: string) => {
    if (deviceInfo.includes('手机')) return <MobileOutlined style={{ fontSize: 20 }} />
    if (deviceInfo.includes('平板')) return <TabletOutlined style={{ fontSize: 20 }} />
    return <DesktopOutlined style={{ fontSize: 20 }} />
  }

  const columns = [
    {
      title: '设备',
      dataIndex: 'deviceInfo',
      key: 'deviceInfo',
      render: (text: string, record: Session) => (
        <Space>
          {getDeviceIcon(text)}
          <div>
            <div>
              {text}
              {record.isCurrent && <Tag color="green" style={{ marginLeft: 8 }}>当前</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <GlobalOutlined style={{ marginRight: 4 }} />
              {record.ipAddress}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: '登录时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: number | null) => val ? (
        <Tooltip title={dayjs(val).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(val).fromNow()}
        </Tooltip>
      ) : '-'
    },
    {
      title: '最近活动',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      width: 180,
      render: (val: number | null) => val ? (
        <Tooltip title={dayjs(val).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(val).fromNow()}
        </Tooltip>
      ) : '-'
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 180,
      render: (val: number) => (
        <Tooltip title={dayjs(val).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(val).fromNow()}
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Session) => (
        <Button 
          type="text" 
          danger
          icon={<LogoutOutlined />}
          onClick={() => handleLogout(record)}
        >
          登出
        </Button>
      )
    }
  ]

  const otherSessionCount = sessions.filter(s => !s.isCurrent).length

  return (
    <Card 
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>会话管理</Title>
          <Tag>{sessions.length} 个活跃会话</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchSessions}>
            刷新
          </Button>
          {otherSessionCount > 0 && (
            <Button danger onClick={handleLogoutAll}>
              登出其他 {otherSessionCount} 个会话
            </Button>
          )}
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无活跃会话' }}
      />

      <div style={{ marginTop: 16, color: '#888' }}>
        <Text type="secondary">
          提示：如果发现可疑的登录会话，建议立即登出并修改密码。
        </Text>
      </div>
    </Card>
  )
}
