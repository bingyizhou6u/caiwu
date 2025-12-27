/**
 * 项目列表页面
 * 使用统一的 PageContainer 和 DataTable 组件
 */
import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Dropdown, message, Modal, Popconfirm, Space, Switch, Tag } from 'antd'
import {
    PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ProjectOutlined
} from '@ant-design/icons'
import { useProjects, useDeleteProject, type Project } from '../../../hooks/business/usePM'
import { PageContainer } from '../../../components/PageContainer'
import { DataTable, PageToolbar, StatusTag } from '../../../components/common'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import dayjs from 'dayjs'

// 状态与优先级配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: '进行中', color: 'processing' },
    on_hold: { label: '暂停', color: 'warning' },
    completed: { label: '已完成', color: 'success' },
    cancelled: { label: '已取消', color: 'default' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'red' },
    medium: { label: '中', color: 'orange' },
    low: { label: '低', color: 'green' },
}

export default function ProjectListPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useState<{ search?: string; status?: string }>({})
    const [deleteModalVisible, setDeleteModalVisible] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)

    const { data: projects = [], isLoading, refetch } = useProjects({ status: searchParams.status })
    const deleteProject = useDeleteProject()
    const { hasPermission } = usePermissions()
    const canManageProjects = hasPermission('pm', 'project', 'create')

    // 过滤项目
    const filteredProjects = useMemo(() => {
        let result = projects
        if (searchParams.search) {
            const search = searchParams.search.toLowerCase()
            result = result.filter((p: Project) =>
                p.name.toLowerCase().includes(search) ||
                p.code.toLowerCase().includes(search)
            )
        }
        return result
    }, [projects, searchParams.search])

    // 处理删除
    const handleDelete = async () => {
        if (!selectedProject) return
        try {
            await deleteProject.mutateAsync(selectedProject.id)
            message.success('项目已删除')
            setDeleteModalVisible(false)
            refetch()
        } catch (error: any) {
            message.error(error?.message || '删除失败')
        }
    }

    // 表格列定义
    const columns = [
        {
            title: '项目编号',
            dataIndex: 'code',
            key: 'code',
            width: 120,
            render: (code: string, record: Project) => (
                <Link to={`/pm/projects/${record.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {code}
                </Link>
            ),
        },
        {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (name: string, record: Project) => (
                <div>
                    <div className="font-medium">{name}</div>
                    {record.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{record.description}</div>
                    )}
                </div>
            ),
        },
        {
            title: '项目经理',
            dataIndex: 'managerName',
            key: 'managerName',
            width: 100,
            render: (name: string) => name || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => {
                const config = STATUS_CONFIG[status] || { label: status, color: 'default' }
                return <Badge status={config.color as any} text={config.label} />
            },
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
            title: '周期',
            key: 'period',
            width: 180,
            render: (_: any, record: Project) => {
                const start = record.startDate ? dayjs(record.startDate).format('YYYY/MM/DD') : '-'
                const end = record.endDate ? dayjs(record.endDate).format('YYYY/MM/DD') : '-'
                return `${start} ~ ${end}`
            },
        },
        {
            title: '预算',
            dataIndex: 'budgetCents',
            key: 'budgetCents',
            width: 100,
            align: 'right' as const,
            render: (cents: number) => cents ? `¥${(cents / 100).toLocaleString()}` : '-',
        },
    ]

    return (
        <PageContainer
            title="项目进度管理"
            breadcrumb={[{ title: '项目管理' }, { title: '进度列表' }]}
        >
            <Card bordered={false} className="page-card">
                <SearchFilters
                    fields={[
                        { name: 'search', label: '搜索', type: 'input', placeholder: '项目名称或编号' },
                        {
                            name: 'status',
                            label: '状态',
                            type: 'select',
                            placeholder: '全部状态',
                            options: [
                                { label: '全部', value: '' },
                                { label: '进行中', value: 'active' },
                                { label: '暂停', value: 'on_hold' },
                                { label: '已完成', value: 'completed' },
                                { label: '已取消', value: 'cancelled' },
                            ],
                        },
                    ]}
                    onSearch={setSearchParams}
                    onReset={() => setSearchParams({})}
                    initialValues={searchParams}
                />

                <PageToolbar
                    actions={canManageProjects ? [{
                        label: '新建项目',
                        type: 'primary',
                        icon: <PlusOutlined />,
                        onClick: () => navigate('/pm/projects/new'),
                    }] : []}
                    style={{ marginTop: 16 }}
                />

                <DataTable<Project>
                    columns={columns}
                    data={filteredProjects}
                    loading={isLoading}
                    rowKey="id"
                    actions={(record) => (
                        <Space>
                            <Button size="small" onClick={() => navigate(`/pm/projects/${record.id}`)}>
                                查看
                            </Button>
                            <Button size="small" onClick={() => navigate(`/pm/tasks/kanban?projectId=${record.id}`)}>
                                看板
                            </Button>
                            {canManageProjects && (
                                <Popconfirm
                                    title={`确定要删除项目"${record.name}"吗？`}
                                    description="此操作将软删除项目，相关数据将保留但不再显示。"
                                    onConfirm={() => {
                                        setSelectedProject(record)
                                        handleDelete()
                                    }}
                                    okText="确定"
                                    cancelText="取消"
                                >
                                    <Button size="small" danger>删除</Button>
                                </Popconfirm>
                            )}
                        </Space>
                    )}
                    pagination={{ pageSize: 20 }}
                    tableProps={{ className: 'table-striped', scroll: { x: 1100 } }}
                />
            </Card>
        </PageContainer>
    )
}
