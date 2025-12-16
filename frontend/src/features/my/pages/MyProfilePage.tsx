import { Card, Descriptions, Button, Form, Input, Spin, Typography, Avatar, Space, Divider } from 'antd'
import { FormModal } from '../../../components/FormModal'
import { SensitiveField } from '../../../components/SensitiveField'
import { EmptyText } from '../../../components/common'
import { UserOutlined, EditOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, BankOutlined, TeamOutlined } from '@ant-design/icons'
import { useMyProfile, useUpdateMyProfile } from '../../../hooks'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useFormModal } from '../../../hooks/forms/useFormModal'
import { withErrorHandler } from '../../../utils/errorHandler'
import { z } from 'zod'

const { Title } = Typography

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

import { PageContainer } from '../../../components/PageContainer'

export function MyProfile() {
  const { data: profile, isLoading: loading } = useMyProfile()
  const { mutateAsync: updateProfile } = useUpdateMyProfile()
  const { form, validateWithZod: validateUpdate } = useZodForm(updateProfileSchema)
  
  const {
    isOpen: modalVisible,
    openEdit,
    close: closeModal,
  } = useFormModal()

  const handleEdit = () => {
    if (profile) {
      form.setFieldsValue({
        phone: profile.phone || '',
        emergencyContact: profile.emergencyContact || '',
        emergencyPhone: profile.emergencyPhone || '',
      })
      openEdit()
    }
  }

  const handleSubmit = withErrorHandler(
    async () => {
      const values = await validateUpdate()
      await updateProfile(values)
    },
    {
      successMessage: '信息更新成功',
      onSuccess: () => {
        closeModal()
      }
    }
  )

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
      <Card bordered className="page-card page-card-outer">
        {/* 基本信息卡片 */}
        <Card className="page-card-inner" style={{ marginBottom: 24 }} bordered={false}>
          <Space size="large" align="start">
            <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}><EmptyText value={profile.name} /></Title>
              <Space style={{ marginTop: 8 }}>
                <TeamOutlined /> <EmptyText value={profile.position} />
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
          className="page-card-inner"
          extra={
            <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
          }
        >
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered>
            <Descriptions.Item label={<><MailOutlined /> 邮箱</>}>{profile.email}</Descriptions.Item>
            <Descriptions.Item label={<><PhoneOutlined /> 手机</>}>
              {profile.phone ? <SensitiveField value={profile.phone} type="phone" entityId={profile.id} entityType="employee" /> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={<><IdcardOutlined /> 身份证</>}>
              {profile.idCard ? <SensitiveField value={profile.idCard} type="default" entityId={profile.id} entityType="employee" /> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={<><BankOutlined /> 银行账户</>}>
              {profile.bankAccount ? <SensitiveField value={profile.bankAccount} type="default" entityId={profile.id} entityType="employee" /> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开户行"><EmptyText value={profile.bankName} /></Descriptions.Item>
            <Descriptions.Item label="职位代码"><EmptyText value={profile.positionCode} /></Descriptions.Item>
            <Descriptions.Item label="入职日期"><EmptyText value={profile.entryDate} /></Descriptions.Item>
            <Descriptions.Item label="合同到期"><EmptyText value={profile.contractEndDate} /></Descriptions.Item>
          </Descriptions>

          <Divider>紧急联系人</Divider>

          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="联系人"><EmptyText value={profile.emergencyContact} /></Descriptions.Item>
            <Descriptions.Item label="联系电话"><EmptyText value={profile.emergencyPhone} /></Descriptions.Item>
          </Descriptions>
        </Card>
      </Card>

      {/* 编辑表单 */}
      <FormModal
        title="编辑个人信息"
        open={modalVisible}
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => { closeModal(); form.resetFields() }}
        width={500}
      >
        <Form.Item name="phone" label="手机号码">
          <Input placeholder="请输入手机号码" />
        </Form.Item>
        <Form.Item name="emergencyContact" label="紧急联系人">
          <Input placeholder="请输入紧急联系人姓名" />
        </Form.Item>
        <Form.Item name="emergencyPhone" label="紧急联系人电话">
          <Input placeholder="请输入紧急联系人电话" />
        </Form.Item>
      </FormModal>
    </PageContainer>
  )
}

export default MyProfile
