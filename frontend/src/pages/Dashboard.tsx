import { Card, Typography, Space, Descriptions, Tag } from 'antd'
import { UserOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'

const { Title } = Typography

interface UserInfo {
  name?: string
  email?: string
  role?: string
}

const roleLabels: Record<string, string> = {
  manager: '管理员',
  finance: '财务',
  hr: '人事',
  auditor: '审计',
  read: '只读',
  employee: '员工'
}

export function Dashboard({ userRole, userInfo }: { userRole?: string; userInfo?: UserInfo | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ maxWidth: 600, width: '100%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }} align="center">
          <UserOutlined style={{ fontSize: 64, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>个人信息</Title>
          <div style={{ width: '100%', marginTop: 24 }}>
            <Descriptions column={1} bordered>
              <Descriptions.Item 
                label={
                  <Space>
                    <UserOutlined />
                    <span>姓名</span>
                  </Space>
                }
              >
                {userInfo?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <MailOutlined />
                    <span>邮箱</span>
                  </Space>
                }
              >
                {userInfo?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <SafetyOutlined />
                    <span>角色</span>
                  </Space>
                }
              >
                {userInfo?.role ? (
                  <Tag color={userInfo.role === 'manager' ? 'red' : userInfo.role === 'finance' ? 'blue' : 'default'}>
                    {roleLabels[userInfo.role] || userInfo.role}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Space>
      </Card>
    </div>
  )
}
