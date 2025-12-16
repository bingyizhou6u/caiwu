import { Typography, Card, Collapse, Divider, Tag, Space } from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography
const { Panel } = Collapse

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
    { title: '是否带薪', dataIndex: 'paid', key: 'paid', render: (v: boolean) => v ? <Tag color="green">带薪</Tag> : <Tag color="orange">无薪</Tag> },
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

        <Collapse defaultActiveKey={['1']} accordion>
          {/* 年假制度 */}
          <Panel
            header={<Space><CalendarOutlined /> <Text strong>年假制度</Text></Space>}
            key="1"
          >
            <div>
              <Title level={5}>年假规则</Title>
              <Paragraph>
                <ol>
                  <li>员工入职日起开始计算年假周期。</li>
                  <li>年假周期分为两种：
                    <ul>
                      <li><Tag color="blue">半年制</Tag> 每6个月为一个周期</li>
                      <li><Tag color="purple">年制</Tag> 每12个月为一个周期</li>
                    </ul>
                  </li>
                  <li>员工入职后的第一个周期内<Text type="danger">不享有年假</Text>。</li>
                  <li>自入职满一个周期进入第二周期起，每完成一个周期获得相应天数带薪年假。</li>
                  <li>年假仅限当周期使用，<Text type="warning">不得顺延、累计或合并</Text>。</li>
                  <li>当周期结束时未休的年假自动折算工资：<Text code>未休天数 × 日薪 × 折算系数</Text>。</li>
                  <li>员工离职时按本周期已工作天数比例折算应得年假；未休补偿，已休超出部分扣回。</li>
                </ol>
              </Paragraph>

              <Divider />

              <Title level={5}>年假设置</Title>
              <Paragraph>
                年假天数因人而异，由人力资源部门在员工档案中设置。默认值为：
                <ul>
                  <li>周期：半年制（6个月）</li>
                  <li>每周期年假天数：15天</li>
                </ul>
              </Paragraph>
            </div>
          </Panel>

          {/* 考勤制度 */}
          <Panel
            header={<Space><ClockCircleOutlined /> <Text strong>考勤制度</Text></Space>}
            key="2"
          >
            <div>
              <Title level={5}>工作时间</Title>
              <Paragraph>
                <ul>
                  <li>默认工作日：周一至周六</li>
                  <li>默认工作时间：09:00 - 21:00</li>
                  <li>具体工作时间以员工档案中的设置为准</li>
                </ul>
              </Paragraph>

              <Divider />

              <Title level={5}>假期类型</Title>
              <DataTable<LeaveType>
                columns={leaveTypeColumns}
                data={leaveTypes}
                tableProps={{ className: 'table-striped', size: 'small' }}
              />

              <Divider />

              <Title level={5}>请假流程</Title>
              <Paragraph>
                <ol>
                  <li>在系统中提交请假申请，填写请假类型、日期和原因</li>
                  <li>等待上级审批</li>
                  <li>审批通过后假期生效</li>
                  <li>年假申请会自动校验剩余天数，超额无法提交</li>
                </ol>
              </Paragraph>
            </div>
          </Panel>

          {/* 报销制度 */}
          <Panel
            header={<Space><DollarOutlined /> <Text strong>报销制度</Text></Space>}
            key="3"
          >
            <div>
              <Title level={5}>报销流程</Title>
              <Paragraph>
                <ol>
                  <li>保留原始发票和相关凭证</li>
                  <li>在系统中提交报销申请，上传凭证照片</li>
                  <li>填写报销金额、类型和说明</li>
                  <li>等待财务审批</li>
                  <li>审批通过后，财务安排打款</li>
                </ol>
              </Paragraph>

              <Divider />

              <Title level={5}>注意事项</Title>
              <Paragraph>
                <ul>
                  <li>报销需在费用发生后 <Text strong>30天内</Text> 提交</li>
                  <li>发票必须真实有效，信息完整</li>
                  <li>单次报销金额超过一定限额需附加说明</li>
                  <li>差旅费用需提前申请审批</li>
                </ul>
              </Paragraph>
            </div>
          </Panel>

          {/* 借支制度 */}
          <Panel
            header={<Space><SafetyCertificateOutlined /> <Text strong>借支制度</Text></Space>}
            key="4"
          >
            <div>
              <Title level={5}>借支规则</Title>
              <Paragraph>
                <ul>
                  <li>员工可申请借支，用于紧急资金周转</li>
                  <li>借支金额从后续薪资中扣除</li>
                  <li>借支需说明用途和预计还款时间</li>
                  <li>借支申请需经过审批</li>
                </ul>
              </Paragraph>

              <Divider />

              <Title level={5}>还款方式</Title>
              <Paragraph>
                <ul>
                  <li>从月度薪资中自动扣除</li>
                  <li>可主动提前还款</li>
                  <li>离职时需一次性结清</li>
                </ul>
              </Paragraph>
            </div>
          </Panel>

          {/* 薪资福利 */}
          <Panel
            header={<Space><TeamOutlined /> <Text strong>薪资福利</Text></Space>}
            key="5"
          >
            <div>
              <Title level={5}>薪资构成</Title>
              <Paragraph>
                <ul>
                  <li><Text strong>基本工资</Text>：试用期工资 / 转正工资</li>
                  <li><Text strong>津贴</Text>：
                    <ul>
                      <li>生活津贴</li>
                      <li>住房津贴</li>
                      <li>交通津贴</li>
                      <li>餐补</li>
                    </ul>
                  </li>
                </ul>
              </Paragraph>

              <Divider />

              <Title level={5}>发薪时间</Title>
              <Paragraph>
                每月固定日期发放上月薪资，具体日期以公司通知为准。
              </Paragraph>
            </div>
          </Panel>
        </Collapse>
      </Card>
    </PageContainer>
  )
}

export default CompanyPolicies
