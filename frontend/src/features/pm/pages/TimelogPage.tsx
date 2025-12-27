/**
 * 工时管理页面
 * 支持记录和查看工时
 * 
 * @accessibility 
 * - 支持键盘导航
 * - 支持屏幕阅读器
 * - 支持减少动画模式
 * - 支持高对比度模式
 */
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
    Button, Card, DatePicker, Form, Input, InputNumber, message, Modal, Select, Space,
    Statistic, Table, Tabs, Row, Col
} from 'antd'
import {
    PlusOutlined, ClockCircleOutlined, TeamOutlined, CalendarOutlined
} from '@ant-design/icons'
import {
    useTimelogs, useMyTimelogs, useCreateTimelog, useDeleteTimelog,
    useTeamWorkloadSummary, useProjects, useTasks,
    type Timelog, type Project, type Task
} from '../../../hooks/business/usePM'
import { PageContainer } from '../../../components/PageContainer'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import styles from './TimelogPage.module.css'

const { RangePicker } = DatePicker

export default function TimelogPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const projectIdFromUrl = searchParams.get('projectId') || ''

    const [activeTab, setActiveTab] = useState('my')
    const [projectId, setProjectId] = useState(projectIdFromUrl)
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [form] = Form.useForm()

    const { data: projects = [] } = useProjects()
    const { data: tasks = [] } = useTasks({ projectId })
    const { data: myTimelogs = [], isLoading: myLoading, refetch: refetchMy } = useMyTimelogs(
        dateRange[0]?.format('YYYY-MM-DD'),
        dateRange[1]?.format('YYYY-MM-DD')
    )
    const { data: teamTimelogs = [], isLoading: teamLoading, refetch: refetchTeam } = useTimelogs({})
    const { data: workloadSummary = [] } = useTeamWorkloadSummary(
        projectId,
        dateRange[0]?.format('YYYY-MM-DD'),
        dateRange[1]?.format('YYYY-MM-DD')
    )
    const createTimelog = useCreateTimelog()
    const deleteTimelog = useDeleteTimelog()

    // 统计
    const myTotalHours = myTimelogs.reduce((sum: number, t: Timelog) => sum + t.hours, 0)
    const teamTotalHours = teamTimelogs.reduce((sum: number, t: Timelog) => sum + t.hours, 0)

    // 创建工时记录
    const handleCreate = async (values: any) => {
        try {
            await createTimelog.mutateAsync({
                taskId: values.taskId,
                logDate: values.logDate.format('YYYY-MM-DD'),
                hours: values.hours,
                description: values.description,
            })
            message.success('工时记录已创建')
            setCreateModalVisible(false)
            form.resetFields()
            refetchMy()
            refetchTeam()
        } catch (error: any) {
            message.error(error?.message || '创建失败')
        }
    }

    // 删除工时记录
    const handleDelete = async (id: string) => {
        try {
            await deleteTimelog.mutateAsync(id)
            message.success('工时记录已删除')
            refetchMy()
            refetchTeam()
        } catch (error: any) {
            message.error(error?.message || '删除失败')
        }
    }

    // 工时列表列
    const timelogColumns: ColumnsType<Timelog> = [
        {
            title: '日期',
            dataIndex: 'logDate',
            key: 'logDate',
            width: 100,
            render: (date) => dayjs(date).format('YYYY-MM-DD'),
        },
        {
            title: '任务',
            dataIndex: 'taskTitle',
            key: 'taskTitle',
            ellipsis: true,
        },
        {
            title: '工时',
            dataIndex: 'hours',
            key: 'hours',
            width: 80,
            render: (hours: number) => `${hours.toFixed(1)} h`,
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '操作',
            key: 'action',
            width: 80,
            render: (_, record) => (
                <Button size="small" danger onClick={() => handleDelete(record.id)}>
                    删除
                </Button>
            ),
        },
    ]

    // 团队工时列表列（包含员工名）
    const teamTimelogColumns: ColumnsType<Timelog> = [
        {
            title: '员工',
            dataIndex: 'employeeName',
            key: 'employeeName',
            width: 100,
        },
        ...timelogColumns.slice(0, -1), // 不包含操作列
    ]

    // 工时汇总列
    const workloadColumns: ColumnsType<any> = [
        {
            title: '成员',
            dataIndex: 'employeeName',
            key: 'employeeName',
        },
        {
            title: '总工时',
            dataIndex: 'totalHours',
            key: 'totalHours',
            render: (hours: number) => `${hours.toFixed(1)} h`,
        },
    ]

    // 空状态提示 (无障碍: 添加 role 和 aria-label)
    const emptyState = (text: string) => (
        <div className={styles.emptyState} role="status" aria-label={text}>
            <ClockCircleOutlined className={styles.emptyStateIcon} aria-hidden="true" />
            <div>{text}</div>
        </div>
    )

    const tabItems = [
        {
            key: 'my',
            label: <span><ClockCircleOutlined aria-hidden="true" /> 我的工时 ({myTimelogs.length})</span>,
            children: (
                <Card className={`page-card-inner ${styles.tableCard}`} hoverable>
                    <Table
                        columns={timelogColumns}
                        dataSource={myTimelogs}
                        rowKey="id"
                        loading={myLoading}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                        size="small"
                        locale={{ emptyText: emptyState('暂无工时记录，点击右上角"记录工时"添加') }}
                        rowClassName={(_, index) => index % 2 === 0 ? '' : styles.tableRowAlt}
                        aria-label="我的工时记录列表"
                    />
                </Card>
            ),
        },
        {
            key: 'team',
            label: <span><TeamOutlined aria-hidden="true" /> 团队工时 ({teamTimelogs.length})</span>,
            children: (
                <Card className={`page-card-inner ${styles.tableCard}`} hoverable>
                    <Table
                        columns={teamTimelogColumns}
                        dataSource={teamTimelogs}
                        rowKey="id"
                        loading={teamLoading}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                        size="small"
                        locale={{ emptyText: emptyState('暂无团队工时记录') }}
                        rowClassName={(_, index) => index % 2 === 0 ? '' : styles.tableRowAlt}
                        aria-label="团队工时记录列表"
                    />
                </Card>
            ),
        },
        {
            key: 'summary',
            label: <span><CalendarOutlined aria-hidden="true" /> 工时汇总</span>,
            children: (
                <Card className={`page-card-inner ${styles.tableCard}`} hoverable>
                    <Table
                        columns={workloadColumns}
                        dataSource={workloadSummary}
                        rowKey="employeeId"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: emptyState('暂无工时汇总数据') }}
                        rowClassName={(_, index) => index % 2 === 0 ? '' : styles.tableRowAlt}
                        aria-label="工时汇总列表"
                    />
                </Card>
            ),
        },
    ]

    return (
        <PageContainer
            title="工时管理"
            breadcrumb={[{ title: '项目管理' }, { title: '工时管理' }]}
        >
            <Card bordered className="page-card page-card-outer">
                {/* 统计卡片 */}
                <Row gutter={[24, 24]} className={styles.statsRow} role="region" aria-label="工时统计">
                    <Col xs={24} sm={8}>
                        <Card className={`page-card-inner ${styles.statCard}`} hoverable>
                            <Statistic
                                title="我的工时"
                                value={myTotalHours.toFixed(1)}
                                suffix="h"
                                prefix={<ClockCircleOutlined aria-hidden="true" />}
                                valueStyle={{ color: 'var(--timelog-stat-my, #1890ff)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card className={`page-card-inner ${styles.statCard}`} hoverable>
                            <Statistic
                                title="团队总工时"
                                value={teamTotalHours.toFixed(1)}
                                suffix="h"
                                prefix={<TeamOutlined aria-hidden="true" />}
                                valueStyle={{ color: 'var(--timelog-stat-team, #52c41a)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card className={`page-card-inner ${styles.statCard}`} hoverable>
                            <Statistic
                                title="活跃成员"
                                value={workloadSummary.length}
                                prefix={<TeamOutlined aria-hidden="true" />}
                                valueStyle={{ color: 'var(--timelog-stat-members, #722ed1)' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* 筛选工具栏 */}
                <Card className={`page-card-inner ${styles.toolbarCard}`} style={{ marginBottom: 16 }}>
                    <div className={styles.toolbar}>
                        <Space>
                            <Select
                                placeholder="选择项目"
                                style={{ width: 200 }}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                value={projectId || undefined}
                                options={projects.map((p: Project) => ({ value: p.id, label: p.name }))}
                                onChange={(value) => setProjectId(value || '')}
                            />
                            <RangePicker
                                value={dateRange}
                                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                            />
                        </Space>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setCreateModalVisible(true)}
                        >
                            记录工时
                        </Button>
                    </div>
                </Card>

                {/* 标签页 */}
                <Tabs type="card" activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </Card>

            {/* 创建工时弹窗 */}
            <Modal
                title="记录工时"
                open={createModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                }}
                confirmLoading={createTimelog.isPending}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate}>
                    <Form.Item name="taskId" label="任务" rules={[{ required: true, message: '请选择任务' }]}>
                        <Select
                            placeholder="选择任务"
                            showSearch
                            optionFilterProp="label"
                            options={tasks.map((t: Task) => ({ value: t.id, label: `${t.code} - ${t.title}` }))}
                        />
                    </Form.Item>
                    <Form.Item name="logDate" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                        name="hours"
                        label="工时 (小时)"
                        rules={[
                            { required: true, message: '请输入工时' },
                            { type: 'number', min: 0.5, max: 24, message: '工时范围: 0.5-24 小时' },
                        ]}
                    >
                        <InputNumber step={0.5} min={0.5} max={24} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="description" label="工作描述">
                        <Input.TextArea rows={3} placeholder="描述本次工作内容..." />
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    )
}
