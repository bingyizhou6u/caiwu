import { useState, useEffect } from 'react'
import { Card, Descriptions, Button, Modal, Form, Input, message, Spin, Typography, Avatar, Space, Divider } from 'antd'
import { UserOutlined, EditOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, BankOutlined, TeamOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'

const { Title } = Typography

interface Profile {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  idCard: string
  bankAccount: string
  bankName: string
  position: string
  positionCode: string
  department: string
  orgDepartment: string
  entryDate: string
  contractEndDate: string
  emergencyContact: string
  emergencyPhone: string
}

import { PageContainer } from '../../../components/PageContainer'

export function MyProfile() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiClient.get<Profile>(api.my.profile)
      setProfile(result)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    form.setFieldsValue({
      phone: profile?.phone,
      emergencyContact: profile?.emergencyContact,
      emergencyPhone: profile?.emergencyPhone,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      await apiClient.put(api.my.profile, values)

      message.success('信息更新成功')
      setModalVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  if (!profile) {
    return <div>加载失败</div>
  }

  return (
    <PageContainer
      title="个人信息"
      breadcrumb={[{ title: '个人中心' }, { title: '个人信息' }]}
    >
      {/* 基本信息卡片 */}
      <Card style={{ marginBottom: 24 }} bordered={false} className="page-card">
        <Space size="large" align="start">
          <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <Title level={3} style={{ margin: 0 }}>{profile.name}</Title>
            <Space style={{ marginTop: 8 }}>
              <TeamOutlined /> {profile.position}
              {profile.orgDepartment && <span>· {profile.orgDepartment}</span>}
              {profile.department && <span>· {profile.department}</span>}
            </Space>
          </div>
        </Space>
      </Card>

      {/* 详细信息 */}
      <Card
        title="详细信息"
        bordered={false}
        className="page-card"
        extra={
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
            编辑
          </Button>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered>
          <Descriptions.Item label={<><MailOutlined /> 邮箱</>}>{profile.email}</Descriptions.Item>
          <Descriptions.Item label={<><PhoneOutlined /> 手机</>}>{profile.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label={<><IdcardOutlined /> 身份证</>}>{profile.idCard || '-'}</Descriptions.Item>
          <Descriptions.Item label={<><BankOutlined /> 银行账户</>}>{profile.bankAccount || '-'}</Descriptions.Item>
          <Descriptions.Item label="开户行">{profile.bankName || '-'}</Descriptions.Item>
          <Descriptions.Item label="职位代码">{profile.positionCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="入职日期">{profile.entryDate || '-'}</Descriptions.Item>
          <Descriptions.Item label="合同到期">{profile.contractEndDate || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider>紧急联系人</Divider>

        <Descriptions column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="联系人">{profile.emergencyContact || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{profile.emergencyPhone || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 编辑表单 */}
      <Modal
        title="编辑个人信息"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="phone" label="手机号码">
            <Input placeholder="请输入手机号码" />
          </Form.Item>
          <Form.Item name="emergencyContact" label="紧急联系人">
            <Input placeholder="请输入紧急联系人姓名" />
          </Form.Item>
          <Form.Item name="emergencyPhone" label="紧急联系人电话">
            <Input placeholder="请输入紧急联系人电话" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default MyProfile
