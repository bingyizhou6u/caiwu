/**
 * 我的任务页面
 * 
 * 展示分配给当前用户的所有任务
 */
import { useState } from 'react'
import { Card, Table, Tag, Select, Space, Button, message } from 'antd'
import { CheckSquareOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/http'
import { PageContainer } from '../../../components/PageContainer'

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    backlog: { label: '待办', color: 'default' },
    requirement_review: { label: '需求评审', color: 'cyan' },
    in_progress: { label: '开发中', color: 'blue' },
    code_review: { label: '代码评审', color: 'orange' },
    testing: { label: '测试中', color: 'purple' },
    completed: { label: '已完成', color: 'green' },
}

// 优先级配置
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'red' },
    medium: { label: '中', color: 'orange' },
    low: { label: '低', color: 'green' },
}

import { useTask, type Task } from '../../../hooks/business/usePM'

export function MyTasksPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
    const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined)

    // 获取我的任务
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['my-tasks'],
        queryFn: async () => {
            const res = await api.get<{ success: boolean; data: Task[] }>('/api/v2/pm/tasks/my')
            return res.data || []
        },
    })

    // 更新任务状态
    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.patch(`/api/v2/pm/tasks/${id}/status`, { status, sortOrder: 0 })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
            message.success('状态已更新')
        },
        onError: () => {
            message.error('更新失败')
        },
    })

    // 筛选任务
    const filteredTasks = tasks?.filter(task => {
        if (statusFilter && task.status !== statusFilter) return false
        if (priorityFilter && task.priority !== priorityFilter) return false
        return true
    }) || []

    // 查看任务详情
    const handleView = (task: Task) => {
        navigate(`/pm/projects/${task.projectId}/tasks?taskId=${task.id}`)
    }

    // 编辑任务
    const handleEdit = (task: Task) => {
        navigate(`/pm/projects/${task.projectId}/tasks/${task.id}/edit`)
    }

    const columns = [
        {
            title: '编号',
            dataIndex: 'code',
            key: 'code',
            width: 100,
            render: (code: string) => <Tag>{code}</Tag>,
        },
        {
            title: '标题',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: '所属项目',
            dataIndex: 'projectName',
            key: 'projectName',
            width: 150,
            render: (name: string | null) => name || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string, record: Task) => (
                <Select
                    value={status}
                    size="small"
                    style={{ width: 110 }}
                    onChange={(value) => updateStatus.mutate({ id: record.id, status: value })}
                    loading={updateStatus.isPending}
                >
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <Select.Option key={key} value={key}>
                            <Tag color={config.color}>{config.label}</Tag>
                        </Select.Option>
                    ))}
                </Select>
            ),
        },
        {
            title: '优先级',
            dataIndex: 'priority',
            key: 'priority',
            width: 80,
            render: (priority: string) => {
                const config = PRIORITY_CONFIG[priority] || { label: priority, color: 'default' }
                return <Tag color={config.color}>{config.label}</Tag>
            },
        },
        {
            title: '截止日期',
            dataIndex: 'dueDate',
            key: 'dueDate',
            width: 110,
            render: (date: string | null) => {
                if (!date) return '-'
                const isOverdue = new Date(date) < new Date()
                return <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>{date}</span>
            },
        },
        {
            title: '操作',
            key: 'actions',
            width: 100,
            render: (_: any, record: Task) => (
                <Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleView(record)}
                    />
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                </Space>
            ),
        },
    ]

    return (
        <PageContainer
            title="我的任务"
            breadcrumb={[{ title: '个人中心' }, { title: '我的任务' }]}
        >
            <Card bordered className="page-card">
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        placeholder="状态筛选"
                        allowClear
                        style={{ width: 140 }}
                        value={statusFilter}
                        onChange={setStatusFilter}
                    >
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <Select.Option key={key} value={key}>
                                <Tag color={config.color}>{config.label}</Tag>
                            </Select.Option>
                        ))}
                    </Select>
                    <Select
                        placeholder="优先级筛选"
                        allowClear
                        style={{ width: 120 }}
                        value={priorityFilter}
                        onChange={setPriorityFilter}
                    >
                        {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                            <Select.Option key={key} value={key}>
                                <Tag color={config.color}>{config.label}</Tag>
                            </Select.Option>
                        ))}
                    </Select>
                </Space>

                <Table
                    columns={columns}
                    dataSource={filteredTasks}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        defaultPageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                    }}
                    locale={{ emptyText: '暂无任务' }}
                />
            </Card>
        </PageContainer>
    )
}

export default MyTasksPage
