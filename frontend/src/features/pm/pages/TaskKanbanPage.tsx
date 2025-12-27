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
    EditOutlined, DeleteOutlined, ClockCircleOutlined, UserOutlined
} from '@ant-design/icons'
import {
    useKanbanTasks, useUpdateTaskStatus, useDeleteTask, useProjects,
    type Task, type Project
} from '../../../hooks/business/usePM'
import { PageContainer } from '../../../components/PageContainer'
import { PageToolbar } from '../../../components/common'
import dayjs from 'dayjs'

const { Text } = Typography

// 看板列配置
const KANBAN_COLUMNS = [
    { key: 'todo', title: '待办', color: '#8c8c8c' },
    { key: 'in_progress', title: '进行中', color: '#1890ff' },
    { key: 'review', title: '评审中', color: '#faad14' },
    { key: 'completed', title: '已完成', color: '#52c41a' },
] as const

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'red' },
    medium: { label: '中', color: 'orange' },
    low: { label: '低', color: 'green' },
}

// 任务卡片组件
interface TaskCardProps {
    task: Task
    onDragStart: (e: React.DragEvent, task: Task) => void
    onEdit: (task: Task) => void
    onDelete: (task: Task) => void
}

function TaskCard({ task, onDragStart, onEdit, onDelete }: TaskCardProps) {
    const menuItems = [
        { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(task) },
        { type: 'divider' as const },
        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => onDelete(task) },
    ]

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task)}
            style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: 12,
                marginBottom: 8,
                cursor: 'grab',
                transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <Text strong style={{ flex: 1, marginRight: 8 }} ellipsis>
                    {task.title}
                </Text>
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                </Dropdown>
            </div>

            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                <Text code style={{ fontSize: 10 }}>{task.code}</Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <Space size={4}>
                    <Tag color={PRIORITY_CONFIG[task.priority]?.color} style={{ margin: 0, fontSize: 10 }}>
                        {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                    </Tag>
                    {task.dueDate && (
                        <span style={{ color: '#8c8c8c' }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {dayjs(task.dueDate).format('MM/DD')}
                        </span>
                    )}
                </Space>
                {task.assigneeName && (
                    <span style={{ color: '#595959' }}>
                        <UserOutlined style={{ marginRight: 4 }} />
                        {task.assigneeName}
                    </span>
                )}
            </div>
        </div>
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
}

function KanbanColumn({
    title, color, tasks, status, onDragOver, onDrop, onDragStart, onEdit, onDelete
}: KanbanColumnProps) {
    return (
        <div
            style={{
                flex: 1,
                minWidth: 280,
                maxWidth: 320,
                background: '#fafafa',
                borderRadius: 8,
                padding: 12,
            }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${color}` }}>
                <Text strong>{title}</Text>
                <Badge count={tasks.length} style={{ backgroundColor: color }} />
            </div>
            <div style={{ minHeight: 400, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
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
                        />
                    ))
                )}
            </div>
        </div>
    )
}

export default function TaskKanbanPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const projectId = searchParams.get('projectId') || ''

    const [searchText, setSearchText] = useState('')
    const [draggedTask, setDraggedTask] = useState<Task | null>(null)
    const [deleteModalVisible, setDeleteModalVisible] = useState(false)
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
                <Card bordered={false} className="page-card">
                    <div style={{ textAlign: 'center', padding: 48 }}>
                        <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
                            请选择一个项目查看任务看板
                        </Text>
                        <Select
                            placeholder="选择项目"
                            style={{ width: 300 }}
                            showSearch
                            optionFilterProp="label"
                            options={projects.map((p: Project) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                            onChange={(value) => navigate(`/pm/tasks/kanban?projectId=${value}`)}
                        />
                    </div>
                </Card>
            </PageContainer>
        )
    }

    return (
        <PageContainer
            title={`任务看板 - ${currentProject?.name || ''}`}
            breadcrumb={[{ title: '项目管理' }, { title: '进度列表' }, { title: '任务看板' }]}
        >
            <Card bordered={false} className="page-card">
                {/* 工具栏 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
        </PageContainer>
    )
}
