/**
 * 项目详情页面
 * 包含项目基本信息、任务列表、工时统计
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
    Badge, Button, Card, Descriptions, Dropdown, message, Modal, Progress,
    Space, Statistic, Table, Tabs, Tag, Tooltip, Typography
} from 'antd'
import {
    ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
    ProjectOutlined, ClockCircleOutlined, TeamOutlined, CalendarOutlined,
    MoreOutlined
} from '@ant-design/icons'
import {
    useProject, useDeleteProject, useTasks, useTeamWorkloadSummary,
    type Project, type Task
} from '../../../hooks/business/usePM'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TabPane } = Tabs

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: '进行中', color: 'processing' },
    on_hold: { label: '暂停', color: 'warning' },
    completed: { label: '已完成', color: 'success' },
    cancelled: { label: '已取消', color: 'default' },
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    todo: { label: '待办', color: 'default' },
    in_progress: { label: '进行中', color: 'processing' },
    review: { label: '评审中', color: 'warning' },
    completed: { label: '已完成', color: 'success' },
    blocked: { label: '阻塞', color: 'error' },
    cancelled: { label: '已取消', color: 'default' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'red' },
    medium: { label: '中', color: 'orange' },
    low: { label: '低', color: 'green' },
}

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [deleteModalVisible, setDeleteModalVisible] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    const { data: project, isLoading: projectLoading, refetch } = useProject(id || '')
    const { data: tasks = [], isLoading: tasksLoading } = useTasks({ projectId: id })
    const { data: workloadSummary = [] } = useTeamWorkloadSummary(id || '')
    const deleteProject = useDeleteProject()

    if (!id) {
        return <div>无效的项目 ID</div>
    }

    // 统计数据
    const taskStats = {
        total: tasks.length,
        completed: tasks.filter((t: Task) => t.status === 'completed').length,
        inProgress: tasks.filter((t: Task) => t.status === 'in_progress').length,
        blocked: tasks.filter((t: Task) => t.status === 'blocked').length,
    }
    const completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0
    const totalHours = tasks.reduce((sum: number, t: Task) => sum + (t.actualHours || 0), 0)
    const estimatedHours = tasks.reduce((sum: number, t: Task) => sum + (t.estimatedHours || 0), 0)

    // 处理删除
    const handleDelete = async () => {
        try {
            await deleteProject.mutateAsync(id)
            message.success('项目已删除')
            navigate('/pm/projects')
        } catch (error: any) {
            message.error(error?.message || '删除失败')
        }
    }

    // 任务表格列
    const taskColumns: ColumnsType<Task> = [
        {
            title: '任务编号',
            dataIndex: 'code',
            key: 'code',
            width: 120,
            render: (code) => <Text code>{code}</Text>,
        },
        {
            title: '任务标题',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const config = TASK_STATUS_CONFIG[status] || { label: status, color: 'default' }
                return <Badge status={config.color as any} text={config.label} />
            },
        },
        {
            title: '负责人',
            dataIndex: 'assigneeName',
            key: 'assigneeName',
            width: 100,
            render: (name) => name || '-',
        },
        {
            title: '工时',
            key: 'hours',
            width: 120,
            render: (_, record) => (
                <span>
                    {record.actualHours || 0} / {record.estimatedHours || 0} h
                </span>
            ),
        },
        {
            title: '截止日期',
            dataIndex: 'dueDate',
            key: 'dueDate',
            width: 100,
            render: (date) => date ? dayjs(date).format('MM/DD') : '-',
        },
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

    return (
        <div className="p-6">
            {/* 顶部导航 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pm/projects')}>
                        返回
                    </Button>
                    {project && (
                        <div>
                            <Title level={4} className="mb-0">{project.name}</Title>
                            <Text type="secondary">{project.code}</Text>
                        </div>
                    )}
                </div>
                <Space>
                    <Button
                        type="primary"
                        icon={<ProjectOutlined />}
                        onClick={() => navigate(`/pm/tasks/kanban?projectId=${id}`)}
                    >
                        看板视图
                    </Button>
                    <Button icon={<EditOutlined />} onClick={() => navigate(`/pm/projects/${id}/edit`)}>
                        编辑
                    </Button>
                    <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteModalVisible(true)}>
                        删除
                    </Button>
                </Space>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <Card>
                    <Statistic
                        title="任务完成率"
                        value={completionRate}
                        suffix="%"
                        prefix={<Progress size="small" percent={completionRate} showInfo={false} style={{ width: 60 }} />}
                    />
                </Card>
                <Card>
                    <Statistic title="任务总数" value={taskStats.total} prefix={<ProjectOutlined />} />
                </Card>
                <Card>
                    <Statistic
                        title="实际/预估工时"
                        value={totalHours}
                        suffix={`/ ${estimatedHours} h`}
                        prefix={<ClockCircleOutlined />}
                    />
                </Card>
                <Card>
                    <Statistic title="团队成员" value={workloadSummary.length} prefix={<TeamOutlined />} />
                </Card>
            </div>

            {/* 标签页 */}
            <Card>
                <Tabs type="card" activeKey={activeTab} onChange={setActiveTab}>
                    <TabPane tab="概览" key="overview">
                        {project && (
                            <Descriptions bordered column={2}>
                                <Descriptions.Item label="项目编号">{project.code}</Descriptions.Item>
                                <Descriptions.Item label="状态">
                                    <Badge
                                        status={STATUS_CONFIG[project.status]?.color as any || 'default'}
                                        text={STATUS_CONFIG[project.status]?.label || project.status}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label="部门">{project.departmentName || '-'}</Descriptions.Item>
                                <Descriptions.Item label="项目经理">{project.managerName || '-'}</Descriptions.Item>
                                <Descriptions.Item label="优先级">
                                    <Tag color={PRIORITY_CONFIG[project.priority]?.color}>
                                        {PRIORITY_CONFIG[project.priority]?.label || project.priority}
                                    </Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="预算">
                                    {project.budgetCents ? `¥${(project.budgetCents / 100).toLocaleString()}` : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="计划周期">
                                    {project.startDate || '-'} ~ {project.endDate || '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="实际周期">
                                    {project.actualStartDate || '-'} ~ {project.actualEndDate || '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="描述" span={2}>
                                    {project.description || '暂无描述'}
                                </Descriptions.Item>
                            </Descriptions>
                        )}
                    </TabPane>

                    <TabPane tab={`任务 (${tasks.length})`} key="tasks">
                        <div className="mb-4">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => navigate(`/pm/tasks/new?projectId=${id}`)}
                            >
                                新建任务
                            </Button>
                        </div>
                        <Table
                            columns={taskColumns}
                            dataSource={tasks}
                            rowKey="id"
                            loading={tasksLoading}
                            pagination={{ pageSize: 10 }}
                            size="small"
                        />
                    </TabPane>

                    <TabPane tab="团队工时" key="workload">
                        <Table
                            columns={workloadColumns}
                            dataSource={workloadSummary}
                            rowKey="employeeId"
                            pagination={false}
                            size="small"
                        />
                    </TabPane>
                </Tabs>
            </Card>

            {/* 删除确认弹窗 */}
            <Modal
                title="确认删除"
                open={deleteModalVisible}
                onOk={handleDelete}
                onCancel={() => setDeleteModalVisible(false)}
                confirmLoading={deleteProject.isPending}
                okButtonProps={{ danger: true }}
            >
                <p>确定要删除项目 <strong>{project?.name}</strong> 吗？</p>
                <p className="text-gray-500 text-sm mt-2">此操作将软删除项目，相关数据将保留但不再显示。</p>
            </Modal>
        </div>
    )
}
