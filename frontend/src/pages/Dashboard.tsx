import { Card, Typography, Space, Descriptions, Tag } from 'antd'
import { UserOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'

const { Title } = Typography

interface UserInfo {
  name?: string
  email?: string
  role?: string
  position?: {
    id: string
    code: string
    name: string
    level: string
    scope: string
    canViewReports?: boolean
  }
}

const levelLabels: Record<string, string> = {
  hq: '总部',
  project: '项目',
  department: '部门',
  group: '组',
  employee: '员工',
}

const scopeLabels: Record<string, string> = {
  all: '全部',
  hq_all: '总部+所有项目',
  project_all: '项目全部',
  project_dept: '项目部门',
  dept: '部门',
  group: '组',
  self: '自己',
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
              {userInfo?.position && (
                <Descriptions.Item 
                  label={
                    <Space>
                      <SafetyOutlined />
                      <span>账号权限</span>
                    </Space>
                  }
                >
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="green">{userInfo.position.name}</Tag>
                    </div>
                    {userInfo.position.level && (
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        层级: {levelLabels[userInfo.position.level] || userInfo.position.level}
                      </div>
                    )}
                    {userInfo.position.scope && (
                      <div style={{ fontSize: 12, color: '#666' }}>
                        权限范围: {scopeLabels[userInfo.position.scope] || userInfo.position.scope}
                      </div>
                    )}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        </Space>
      </Card>
    </div>
  )
}
