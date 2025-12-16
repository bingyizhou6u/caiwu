import { Typography, Card, Collapse, Divider, Tag, Space, List } from 'antd'
import { StatusTag } from '../../../components/common/StatusTag'
import { COMMON_STATUS } from '../../../utils/status'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography
const { Panel } = Collapse

// 样式常量
const sectionStyle = { marginBottom: 16 }
const listItemStyle = { padding: '8px 0', borderBottom: '1px solid #f0f0f0' }
const highlightBoxStyle = {
  background: '#fafafa',
  borderRadius: 8,
  padding: '12px 16px',
  marginTop: 12
}

import { PageContainer } from '../../../components/PageContainer'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'

interface LeaveType {
  key: string
  type: string
  description: string
  paid: boolean
}

export function CompanyPolicies() {
  const leaveTypeColumns: DataTableColumn<LeaveType>[] = [
    { title: '假期类型', dataIndex: 'type', key: 'type' },
    { title: '说明', dataIndex: 'description', key: 'description' },
    { title: '是否带薪', dataIndex: 'paid', key: 'paid', render: (v: boolean) => <StatusTag status={v ? 'paid' : 'unpaid'} statusMap={COMMON_STATUS} /> },
  ]

  const leaveTypes: LeaveType[] = [
    { key: '1', type: '年假', description: '根据个人设置的年假天数，入职第一周期无年假', paid: true },
    { key: '2', type: '病假', description: '因病需要休息，需提供医院证明', paid: true },
    { key: '3', type: '事假', description: '因个人事务需要请假', paid: false },
    { key: '4', type: '其他', description: '其他特殊情况', paid: false },
  ]

  return (
    <PageContainer
      title="公司制度说明"
      breadcrumb={[{ title: '个人中心' }, { title: '公司制度说明' }]}
    >
      <Card bordered className="page-card page-card-outer">
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          以下是公司各项制度的详细说明，请仔细阅读。如有疑问，请联系人力资源部门。
        </Paragraph>

        <Collapse accordion>
          {/* 年假制度 */}
          <Panel
            header={<Space><CalendarOutlined style={{ color: '#1890ff' }} /> <Text strong>年假制度</Text></Space>}
            key="1"
          >
            <div>
              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />年假规则</Title>
                <List
                  size="small"
                  dataSource={[
                    '员工入职日起开始计算年假周期',
                    <>年假周期分为两种：<Tag color="blue">半年制</Tag>（6个月）或 <Tag color="purple">年制</Tag>（12个月）</>,
                    <>员工入职后的第一个周期内 <Text type="danger" strong>不享有年假</Text></>,
                    '自第二周期起，每完成一个周期获得相应天数带薪年假',
                    <>年假仅限当周期使用，<Text type="warning" strong>不得顺延、累计或合并</Text></>,
                    <>未休年假折算公式：<Text code>未休天数 × 日薪 × 折算系数</Text></>,
                    '离职时按本周期已工作天数比例折算应得年假'
                  ]}
                  renderItem={(item) => (
                    <List.Item style={listItemStyle}>
                      <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />{item}</Space>
                    </List.Item>
                  )}
                />
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />年假设置</Title>
                <Paragraph type="secondary">年假天数因人而异，由人力资源部门在员工档案中设置。</Paragraph>
                <div style={highlightBoxStyle}>
                  <Space direction="vertical" size={4}>
                    <Text><Text strong>默认周期：</Text>半年制（6个月）</Text>
                    <Text><Text strong>每周期天数：</Text>15 天</Text>
                  </Space>
                </div>
              </div>
            </div>
          </Panel>

          {/* 考勤制度 */}
          <Panel
            header={<Space><ClockCircleOutlined style={{ color: '#52c41a' }} /> <Text strong>考勤制度</Text></Space>}
            key="2"
          >
            <div>
              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />工作时间</Title>
                <div style={highlightBoxStyle}>
                  <Space direction="vertical" size={4}>
                    <Text><Text strong>工作日：</Text>周一至周六</Text>
                    <Text><Text strong>工作时间：</Text>09:00 - 21:00</Text>
                    <Text type="secondary">* 具体时间以员工档案设置为准</Text>
                  </Space>
                </div>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />假期类型</Title>
                <DataTable<LeaveType>
                  columns={leaveTypeColumns}
                  data={leaveTypes}
                  tableProps={{ size: 'small' }}
                />
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />请假流程</Title>
                <List
                  size="small"
                  dataSource={[
                    '在系统中提交请假申请，填写请假类型、日期和原因',
                    '等待上级审批',
                    '审批通过后假期生效',
                    '年假申请会自动校验剩余天数，超额无法提交'
                  ]}
                  renderItem={(item, index) => (
                    <List.Item style={listItemStyle}>
                      <Space><Tag color="blue">{index + 1}</Tag>{item}</Space>
                    </List.Item>
                  )}
                />
              </div>
            </div>
          </Panel>

          {/* 报销制度 */}
          <Panel
            header={<Space><DollarOutlined style={{ color: '#faad14' }} /> <Text strong>报销制度</Text></Space>}
            key="3"
          >
            <div>
              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />报销流程</Title>
                <List
                  size="small"
                  dataSource={[
                    '保留原始发票和相关凭证',
                    '在系统中提交报销申请，上传凭证照片',
                    '填写报销金额、类型和说明',
                    '等待财务审批',
                    '审批通过后，财务安排打款'
                  ]}
                  renderItem={(item, index) => (
                    <List.Item style={listItemStyle}>
                      <Space><Tag color="blue">{index + 1}</Tag>{item}</Space>
                    </List.Item>
                  )}
                />
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />注意事项</Title>
                <List
                  size="small"
                  dataSource={[
                    <>报销需在费用发生后 <Text strong type="danger">30天内</Text> 提交</>,
                    '发票必须真实有效，信息完整',
                    '单次报销金额超过一定限额需附加说明',
                    '差旅费用需提前申请审批'
                  ]}
                  renderItem={(item) => (
                    <List.Item style={listItemStyle}>
                      <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />{item}</Space>
                    </List.Item>
                  )}
                />
              </div>
            </div>
          </Panel>

          {/* 借支制度 */}
          <Panel
            header={<Space><SafetyCertificateOutlined style={{ color: '#722ed1' }} /> <Text strong>借支制度</Text></Space>}
            key="4"
          >
            <div>
              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />借支规则</Title>
                <List
                  size="small"
                  dataSource={[
                    '员工可申请借支，用于紧急资金周转',
                    '借支金额从后续薪资中扣除',
                    '借支需说明用途和预计还款时间',
                    '借支申请需经过审批'
                  ]}
                  renderItem={(item) => (
                    <List.Item style={listItemStyle}>
                      <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />{item}</Space>
                    </List.Item>
                  )}
                />
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />还款方式</Title>
                <div style={highlightBoxStyle}>
                  <Space direction="vertical" size={8}>
                    <Text><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />从月度薪资中自动扣除</Text>
                    <Text><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />可主动提前还款</Text>
                    <Text><CheckCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />离职时需一次性结清</Text>
                  </Space>
                </div>
              </div>
            </div>
          </Panel>

          {/* 薪资福利 */}
          <Panel
            header={<Space><TeamOutlined style={{ color: '#13c2c2' }} /> <Text strong>薪资福利</Text></Space>}
            key="5"
          >
            <div>
              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />薪资构成</Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={highlightBoxStyle}>
                    <Text strong style={{ color: '#1890ff' }}>基本工资</Text>
                    <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                      试用期工资 / 转正工资
                    </Paragraph>
                  </div>
                  <div style={highlightBoxStyle}>
                    <Text strong style={{ color: '#52c41a' }}>津贴补助</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space wrap>
                        <Tag color="green">生活津贴</Tag>
                        <Tag color="blue">住房津贴</Tag>
                        <Tag color="orange">交通津贴</Tag>
                        <Tag color="purple">餐补</Tag>
                      </Space>
                    </div>
                  </div>
                </Space>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div style={sectionStyle}>
                <Title level={5}><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />发薪时间</Title>
                <div style={{ ...highlightBoxStyle, background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                  <Text>每月固定日期发放上月薪资，具体日期以公司通知为准。</Text>
                </div>
              </div>
            </div>
          </Panel>
        </Collapse>
      </Card>
    </PageContainer>
  )
}

export default CompanyPolicies
