/**
 * 项目列表页面
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Dropdown, Input, MenuProps, message, Modal, Space, Table, Tag, Tooltip } from 'antd'
import {
    PlusOutlined,
    SearchOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    ProjectOutlined,
    MoreOutlined,
    FilterOutlined,
} from '@ant-design/icons'
import { useProjects, useDeleteProject, type Project } from '../../../hooks/business/usePM'
import { useDepartments } from '../../../hooks'
import type { ColumnsType } from 'antd/es/table'
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
    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>()
    const [deleteModalVisible, setDeleteModalVisible] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)

    const { data: projects = [], isLoading, refetch } = useProjects({ status: statusFilter })
    const { data: departments = [] } = useDepartments()
    const deleteProject = useDeleteProject()

    // 过滤项目
    const filteredProjects = projects.filter((p: Project) =>
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.code.toLowerCase().includes(searchText.toLowerCase())
    )

    // 操作菜单
    const getActionItems = (record: Project): MenuProps['items'] => [
        {
            key: 'view',
            icon: <EyeOutlined />,
            label: '查看详情',
            onClick: () => navigate(`/pm/projects/${record.id}`),
        },
        {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
            onClick: () => navigate(`/pm/projects/${record.id}/edit`),
        },
        {
            key: 'kanban',
            icon: <ProjectOutlined />,
            label: '看板',
            onClick: () => navigate(`/pm/tasks/kanban?projectId=${record.id}`),
        },
        { type: 'divider' },
        {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
                setSelectedProject(record)
                setDeleteModalVisible(true)
            },
        },
    ]

    // 表格列定义
    const columns: ColumnsType<Project> = [
        {
            title: '项目编号',
            dataIndex: 'code',
            key: 'code',
            width: 120,
            render: (code, record) => (
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
            render: (name, record) => (
                <div>
                    <div className="font-medium">{name}</div>
                    {record.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{record.description}</div>
                    )}
                </div>
            ),
        },
        {
            title: '部门',
            dataIndex: 'departmentName',
            key: 'departmentName',
            width: 120,
            render: (name) => name || '-',
        },
        {
            title: '项目经理',
            dataIndex: 'managerName',
            key: 'managerName',
            width: 100,
            render: (name) => name || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const config = STATUS_CONFIG[status] || { label: status, color: 'default' }
                return <Badge status={config.color as any} text={config.label} />
            },
        },
        {
            title: '优先级',
            dataIndex: 'priority',
            key: 'priority',
            width: 80,
            render: (priority) => {
                const config = PRIORITY_CONFIG[priority] || { label: priority, color: 'default' }
                return <Tag color={config.color}>{config.label}</Tag>
            },
        },
        {
            title: '周期',
            key: 'period',
            width: 180,
            render: (_, record) => {
                const start = record.startDate ? dayjs(record.startDate).format('MM/DD') : '-'
                const end = record.endDate ? dayjs(record.endDate).format('MM/DD') : '-'
                return `${start} ~ ${end}`
            },
        },
        {
            title: '预算',
            dataIndex: 'budgetCents',
            key: 'budgetCents',
            width: 100,
            align: 'right',
            render: (cents) => cents ? `¥${(cents / 100).toLocaleString()}` : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 60,
            fixed: 'right',
            render: (_, record) => (
                <Dropdown menu={{ items: getActionItems(record) }} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            ),
        },
    ]

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

    // 过滤菜单
    const filterItems: MenuProps['items'] = [
        { key: '', label: '全部状态' },
        { key: 'active', label: '进行中' },
        { key: 'on_hold', label: '暂停' },
        { key: 'completed', label: '已完成' },
        { key: 'cancelled', label: '已取消' },
    ]

    return (
        <div className="p-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
                    <p className="text-gray-500 mt-1">管理团队项目和追踪进度</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pm/projects/new')}>
                    新建项目
                </Button>
            </div>

            {/* 工具栏 */}
            <Card className="mb-4">
                <div className="flex items-center gap-4">
                    <Input
                        placeholder="搜索项目名称或编号..."
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-64"
                        allowClear
                    />
                    <Dropdown
                        menu={{
                            items: filterItems,
                            onClick: ({ key }) => setStatusFilter(key || undefined),
                            selectedKeys: statusFilter ? [statusFilter] : [],
                        }}
                    >
                        <Button icon={<FilterOutlined />}>
                            {statusFilter ? STATUS_CONFIG[statusFilter]?.label : '全部状态'}
                        </Button>
                    </Dropdown>
                </div>
            </Card>

            {/* 项目列表 */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={filteredProjects}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 个项目`,
                    }}
                    scroll={{ x: 1100 }}
                />
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
                <p>确定要删除项目 <strong>{selectedProject?.name}</strong> 吗？</p>
                <p className="text-gray-500 text-sm mt-2">此操作将软删除项目，相关数据将保留但不再显示。</p>
            </Modal>
        </div>
    )
}
