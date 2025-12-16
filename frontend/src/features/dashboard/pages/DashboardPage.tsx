import { Card, Typography, Space, Descriptions, Tag } from 'antd'
import { UserOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'
import { usePermissions } from '../../../utils/permissions'

const { Title } = Typography

const levelLabels: Record<number, string> = {
  1: '总部',
  2: '项目',
  3: '组',
}

const functionRoleLabels: Record<string, string> = {
  director: '主管',
  hr: '人力',
  finance: '财务',
  admin: '行政',
  developer: '开发',
}

import { PageContainer } from '../../../components/PageContainer'

export function Dashboard() {
  const { user } = usePermissions()

  return (
    <PageContainer
      title="个人中心"
      breadcrumb={[{ title: '首页' }, { title: '个人中心' }]}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Card bordered={false} className="page-card" style={{ maxWidth: 800, width: '100%' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }} align="center">
            <UserOutlined style={{ fontSize: 64, color: 'var(--color-primary)' }} />
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
                  {user?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <Space>
                      <MailOutlined />
                      <span>邮箱</span>
                    </Space>
                  }
                >
                  {user?.email || '-'}
                </Descriptions.Item>
                {user?.position && (
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
                        <Tag color="green">{user.position.name}</Tag>
                      </div>
                      {user.position.level && (
                        <div className="form-extra-info">
                          层级: {levelLabels[user.position.level] || `Level ${user.position.level}`}
                        </div>
                      )}
                      {user.position.functionRole && (
                        <div className="form-extra-info">
                          职能: {functionRoleLabels[user.position.functionRole] || user.position.functionRole}
                        </div>
                      )}
                      {user.position.canManageSubordinates === 1 && (
                        <div className="form-extra-info">
                          <Tag color="blue" style={{ marginTop: 4 }}>可管理下属</Tag>
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
    </PageContainer>
  )
}
