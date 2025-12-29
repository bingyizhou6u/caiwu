/**
 * 员工项目关联管理组件
 * 显示和管理员工关联的项目列表
 */

import { useState } from 'react'
import { Table, Button, Select, Tag, Space, Popconfirm, message, Empty, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, StarOutlined, StarFilled } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api as httpClient } from '../../../../api/http'
import { api as apiEndpoints } from '../../../../config/api'
import { useProjects, useProjectOptions } from '../../../../hooks'

interface EmployeeProjectsSectionProps {
    employeeId: string
}

interface EmployeeProject {
    id: string
    employeeId: string
    projectId: string
    role: string | null
    isPrimary: number | null
    createdAt: number | null
    projectName: string | null
    projectCode: string | null
}

export function EmployeeProjectsSection({ employeeId }: EmployeeProjectsSectionProps) {
    const queryClient = useQueryClient()
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()

    // 获取项目列表（用于选择）
    const { data: projects = [], isLoading: loadingProjects } = useProjects()

    // 获取员工的项目关联
    const { data: employeeProjects, isLoading } = useQuery({
        queryKey: ['employee-projects', employeeId],
        queryFn: async () => {
            const res = await httpClient.get<EmployeeProject[]>(`${apiEndpoints.employees}/${employeeId}/projects`)
            return res
        },
        enabled: !!employeeId,
    })

    // 添加项目关联
    const addMutation = useMutation({
        mutationFn: async (projectId: string) => {
            return httpClient.post(`${apiEndpoints.employees}/${employeeId}/projects`, { projectId })
        },
        onSuccess: () => {
            message.success('项目关联添加成功')
            queryClient.invalidateQueries({ queryKey: ['employee-projects', employeeId] })
            setSelectedProjectId(undefined)
        },
        onError: () => {
            message.error('添加失败')
        },
    })

    // 移除项目关联
    const removeMutation = useMutation({
        mutationFn: async (projectId: string) => {
            return httpClient.delete(`${apiEndpoints.employees}/${employeeId}/projects/${projectId}`)
        },
        onSuccess: () => {
            message.success('项目关联已移除')
            queryClient.invalidateQueries({ queryKey: ['employee-projects', employeeId] })
        },
        onError: () => {
            message.error('移除失败')
        },
    })

    // 设置主项目
    const setPrimaryMutation = useMutation({
        mutationFn: async (projectId: string) => {
            return httpClient.patch(`${apiEndpoints.employees}/${employeeId}/projects/${projectId}/primary`)
        },
        onSuccess: () => {
            message.success('主项目设置成功')
            queryClient.invalidateQueries({ queryKey: ['employee-projects', employeeId] })
        },
        onError: () => {
            message.error('设置失败')
        },
    })

    // 过滤已关联的项目
    const availableProjects = projects.filter(
        (p: { id: string; name: string }) => !employeeProjects?.some((ep) => ep.projectId === p.id)
    )

    const columns = [
        {
            title: '项目名称',
            dataIndex: 'projectName',
            key: 'projectName',
            render: (text: string, record: EmployeeProject) => (
                <Space>
                    {record.isPrimary === 1 && (
                        <Tag color="gold" icon={<StarFilled />}>主项目</Tag>
                    )}
                    {text || record.projectCode || record.projectId}
                </Space>
            ),
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (text: string | null) => text || '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: unknown, record: EmployeeProject) => (
                <Space>
                    {record.isPrimary !== 1 && (
                        <Button
                            type="link"
                            size="small"
                            icon={<StarOutlined />}
                            onClick={() => setPrimaryMutation.mutate(record.projectId)}
                            loading={setPrimaryMutation.isPending}
                        >
                            设为主项目
                        </Button>
                    )}
                    <Popconfirm
                        title="确定移除该项目关联？"
                        onConfirm={() => removeMutation.mutate(record.projectId)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={removeMutation.isPending}
                        >
                            移除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    if (isLoading) {
        return <Spin tip="加载中..." />
    }

    return (
        <div className="employee-projects-section">
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <Select
                    placeholder="选择要添加的项目"
                    style={{ width: 300 }}
                    value={selectedProjectId}
                    onChange={setSelectedProjectId}
                    loading={loadingProjects}
                    showSearch
                    optionFilterProp="label"
                    options={availableProjects.map((p: { id: string; name: string }) => ({
                        value: p.id,
                        label: p.name,
                    }))}
                />
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => selectedProjectId && addMutation.mutate(selectedProjectId)}
                    disabled={!selectedProjectId}
                    loading={addMutation.isPending}
                >
                    添加项目
                </Button>
            </div>

            {employeeProjects && employeeProjects.length > 0 ? (
                <Table
                    columns={columns}
                    dataSource={employeeProjects}
                    rowKey="id"
                    pagination={false}
                    size="small"
                />
            ) : (
                <Empty description="暂无项目关联" />
            )}
        </div>
    )
}
