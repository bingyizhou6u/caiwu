/**
 * 任务看板页面
 * 支持拖拽切换任务状态
 */
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
    Badge, Button, Card, Dropdown, Input, message, Modal, Select, Space, Tag, Typography, Spin
} from 'antd'
import {
    PlusOutlined, SearchOutlined, MoreOutlined,
    EditOutlined, DeleteOutlined, ClockCircleOutlined, UserOutlined,
    ProjectOutlined, EyeOutlined
} from '@ant-design/icons'
import {
    useKanbanTasks, useUpdateTaskStatus, useDeleteTask, useProjects,
    type Task, type Project
} from '../../../hooks/business/usePM'
import { PageContainer } from '../../../components/PageContainer'
import dayjs from 'dayjs'
import { KANBAN_COLUMNS, TASK_PRIORITY_CONFIG } from '../constants'
import styles from '../../../components/common/common.module.css'

const { Text } = Typography

// 任务卡片组件
interface TaskCardProps {
    task: Task
    onDragStart: (e: React.DragEvent, task: Task) => void
    onEdit: (task: Task) => void
    onDelete: (task: Task) => void
    onView: (task: Task) => void
}

function TaskCard({ task, onDragStart, onEdit, onDelete, onView }: TaskCardProps) {
    const menuItems = [
        { key: 'view', icon: <EyeOutlined />, label: '查看详情', onClick: () => onView(task) },
        { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(task) },
        { type: 'divider' as const },
        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => onDelete(task) },
    ]

    // 获取负责人列表
    // 获取负责人列表
    const assigneeList = task.assigneeNames || []

    return (
        <Card
            size="small"
            draggable
            onDragStart={(e) => onDragStart(e, task)}
            onClick={() => onView(task)}
            style={{
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
            }}
            hoverable
            className="page-card-inner task-card"
            styles={{
                body: { padding: '12px' }
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <Text strong style={{ flex: 1, marginRight: 8, fontSize: 14 }} ellipsis={{ tooltip: task.title }}>
                    {task.title}
                </Text>
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                    <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ opacity: 0.6 }}
                        className="task-card-menu"
                    />
                </Dropdown>
            </div>

            {task.description && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }} ellipsis={{ tooltip: task.description }}>
                    {task.description.length > 50 ? task.description.slice(0, 50) + '...' : task.description}
                </Text>
            )}

            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                <Text code style={{ fontSize: 10, background: '#f5f5f5' }}>{task.code}</Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <Space size={4} wrap>
                    <Tag color={TASK_PRIORITY_CONFIG[task.priority]?.color} style={{ margin: 0, fontSize: 10 }}>
                        {TASK_PRIORITY_CONFIG[task.priority]?.label || task.priority}
                    </Tag>
                    {task.dueDate && (
                        <span style={{ color: dayjs(task.dueDate).isBefore(dayjs()) ? '#ff4d4f' : '#8c8c8c' }}>
                            <ClockCircleOutlined style={{ marginRight: 2 }} />
                            {dayjs(task.dueDate).format('MM/DD')}
                        </span>
                    )}
                </Space>
                {assigneeList.length > 0 && (
                    <span style={{ color: '#595959', fontSize: 11 }}>
                        <UserOutlined style={{ marginRight: 2 }} />
                        {assigneeList.length > 1 ? `${assigneeList[0]}等${assigneeList.length}人` : assigneeList[0]}
                    </span>
                )}
            </div>
        </Card>
    )
}

// 看板列组件
interface KanbanColumnProps {
    title: string
    color: string
    tasks: Task[]
    status: string
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent, status: string) => void
    onDragStart: (e: React.DragEvent, task: Task) => void
    onEdit: (task: Task) => void
    onDelete: (task: Task) => void
    onView: (task: Task) => void
}

function KanbanColumn({
    title, color, tasks, status, onDragOver, onDrop, onDragStart, onEdit, onDelete, onView
}: KanbanColumnProps) {
    return (
        <Card
            className="page-card-inner"
            style={{ flex: 1, minWidth: 280, maxWidth: 320 }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                    <span>{title}</span>
                    <Badge count={tasks.length} style={{ backgroundColor: color }} />
                </div>
            }
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
        >
            <div style={{ minHeight: 400, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', paddingTop: 8 }}>
                {tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: '#bfbfbf' }}>
                        拖拽任务到此处
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onDragStart={onDragStart}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onView={onView}
                        />
                    ))
                )}
            </div>
        </Card>
    )
}

export default function TaskKanbanPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const projectId = searchParams.get('projectId') || ''

    const [searchText, setSearchText] = useState('')
    const [draggedTask, setDraggedTask] = useState<Task | null>(null)
    const [deleteModalVisible, setDeleteModalVisible] = useState(false)
    const [viewModalVisible, setViewModalVisible] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)

    const { data: projects = [] } = useProjects()
    const { data: kanbanData = {}, isLoading, refetch } = useKanbanTasks(projectId)
    const updateStatus = useUpdateTaskStatus()
    const deleteTask = useDeleteTask()

    // 获取当前项目
    const currentProject = projects.find((p: Project) => p.id === projectId)

    // 处理拖拽开始
    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task)
        e.dataTransfer.effectAllowed = 'move'
    }

    // 处理拖拽悬浮
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    // 处理放置
    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        if (!draggedTask || draggedTask.status === newStatus) {
            setDraggedTask(null)
            return
        }

        try {
            await updateStatus.mutateAsync({
                id: draggedTask.id,
                status: newStatus,
                sortOrder: 0,
            })
            message.success('任务状态已更新')
            refetch()
        } catch (error: any) {
            message.error(error?.message || '更新失败')
        } finally {
            setDraggedTask(null)
        }
    }

    // 处理查看详情
    const handleView = (task: Task) => {
        setSelectedTask(task)
        setViewModalVisible(true)
    }

    // 处理编辑
    const handleEdit = (task: Task) => {
        navigate(`/pm/tasks/${task.id}/edit`)
    }

    // 处理删除
    const handleDelete = (task: Task) => {
        setSelectedTask(task)
        setDeleteModalVisible(true)
    }

    const confirmDelete = async () => {
        if (!selectedTask) return
        try {
            await deleteTask.mutateAsync(selectedTask.id)
            message.success('任务已删除')
            setDeleteModalVisible(false)
            refetch()
        } catch (error: any) {
            message.error(error?.message || '删除失败')
        }
    }

    // 按列分组任务
    const getTasksByStatus = (status: string): Task[] => {
        const tasks = kanbanData[status] || []
        if (!searchText) return tasks
        return tasks.filter((t: Task) =>
            t.title.toLowerCase().includes(searchText.toLowerCase()) ||
            t.code.toLowerCase().includes(searchText.toLowerCase())
        )
    }

    if (!projectId) {
        return (
            <PageContainer
                title="任务看板"
                breadcrumb={[{ title: '项目管理' }, { title: '任务看板' }]}
            >
                <Card bordered className="page-card page-card-outer">
                    <Card className="page-card-inner" style={{ textAlign: 'center', padding: 48 }}>
                        <ProjectOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                        <div style={{ color: '#8c8c8c', marginBottom: 16 }}>请选择一个项目查看任务看板</div>
                        <Select
                            placeholder="选择项目"
                            style={{ width: 300 }}
                            showSearch
                            optionFilterProp="label"
                            options={projects.map((p: Project) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                            onChange={(value) => navigate(`/pm/tasks/kanban?projectId=${value}`)}
                        />
                    </Card>
                </Card>
            </PageContainer>
        )
    }

    return (
        <PageContainer
            title={`任务看板 - ${currentProject?.name || ''}`}
            breadcrumb={[{ title: '项目管理' }, { title: '进度列表' }, { title: '任务看板' }]}
        >
            <Card bordered className="page-card page-card-outer">
                {/* 工具栏 */}
                <Card className={`page-card-inner ${styles.mbMd}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                            <Input
                                placeholder="搜索任务..."
                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                style={{ width: 200 }}
                                allowClear
                            />
                            <Select
                                placeholder="切换项目"
                                style={{ width: 200 }}
                                value={projectId}
                                showSearch
                                optionFilterProp="label"
                                options={projects.map((p: Project) => ({ value: p.id, label: p.name }))}
                                onChange={(value) => navigate(`/pm/tasks/kanban?projectId=${value}`)}
                            />
                        </Space>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => navigate(`/pm/tasks/new?projectId=${projectId}`)}
                        >
                            新建任务
                        </Button>
                    </div>
                </Card>

                {/* 看板区域 */}
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                        {KANBAN_COLUMNS.map((column) => (
                            <KanbanColumn
                                key={column.key}
                                title={column.title}
                                color={column.color}
                                tasks={getTasksByStatus(column.key)}
                                status={column.key}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragStart={handleDragStart}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onView={handleView}
                            />
                        ))}
                    </div>
                )}
            </Card>

            {/* 删除确认弹窗 */}
            <Modal
                title="确认删除"
                open={deleteModalVisible}
                onOk={confirmDelete}
                onCancel={() => setDeleteModalVisible(false)}
                confirmLoading={deleteTask.isPending}
                okButtonProps={{ danger: true }}
            >
                <p>确定要删除任务 <strong>{selectedTask?.title}</strong> 吗？</p>
            </Modal>

            {/* 任务详情弹窗 */}
            <Modal
                title={
                    <Space>
                        <Text code>{selectedTask?.code}</Text>
                        <Text strong>{selectedTask?.title}</Text>
                    </Space>
                }
                open={viewModalVisible}
                onCancel={() => setViewModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setViewModalVisible(false)}>关闭</Button>,
                    <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => {
                        setViewModalVisible(false)
                        selectedTask && handleEdit(selectedTask)
                    }}>编辑</Button>
                ]}
                width={600}
            >
                {selectedTask && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* 状态和优先级 */}
                        <Space size={8}>
                            <Tag color={KANBAN_COLUMNS.find(c => c.key === selectedTask.status)?.color}>
                                {KANBAN_COLUMNS.find(c => c.key === selectedTask.status)?.title || selectedTask.status}
                            </Tag>
                            <Tag color={TASK_PRIORITY_CONFIG[selectedTask.priority]?.color}>
                                优先级: {TASK_PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                            </Tag>
                            {selectedTask.dueDate && (
                                <Tag icon={<ClockCircleOutlined />} color={dayjs(selectedTask.dueDate).isBefore(dayjs()) ? 'error' : 'default'}>
                                    截止: {dayjs(selectedTask.dueDate).format('YYYY-MM-DD')}
                                </Tag>
                            )}
                        </Space>

                        {/* 描述 */}
                        {selectedTask.description && (
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>描述</Text>
                                <div style={{ marginTop: 4, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                                    {selectedTask.description}
                                </div>
                            </div>
                        )}

                        {/* 人员信息 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>开发人员</Text>
                                <div style={{ marginTop: 4 }}>
                                    {selectedTask.assigneeNames?.length ? selectedTask.assigneeNames.join('、') :
                                        <Text type="secondary">未指定</Text>}
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>审核人员</Text>
                                <div style={{ marginTop: 4 }}>
                                    {selectedTask.reviewerNames?.length ? selectedTask.reviewerNames.join('、') :
                                        <Text type="secondary">未指定</Text>}
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>测试人员</Text>
                                <div style={{ marginTop: 4 }}>
                                    {selectedTask.testerNames?.length ? selectedTask.testerNames.join('、') :
                                        <Text type="secondary">未指定</Text>}
                                </div>
                            </div>
                        </div>

                        {/* 工时信息 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>预估工时</Text>
                                <div style={{ marginTop: 4 }}>{selectedTask.estimatedHours ? `${selectedTask.estimatedHours}h` : '-'}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>实际工时</Text>
                                <div style={{ marginTop: 4 }}>{selectedTask.actualHours ? `${selectedTask.actualHours}h` : '-'}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>开始日期</Text>
                                <div style={{ marginTop: 4 }}>{selectedTask.startDate || '-'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </PageContainer>
    )
}
