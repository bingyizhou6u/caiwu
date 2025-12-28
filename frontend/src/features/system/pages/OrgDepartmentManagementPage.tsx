import { useMemo, useState } from 'react'
import { Card, Button, Form, Input, Space, Popconfirm, Switch, InputNumber, Select } from 'antd'
import { handleConflictError } from '../../../utils/api'
import { withErrorHandler } from '../../../utils/errorHandler'
import { FormModal } from '../../../components/FormModal'
import { DataTable, PageToolbar, StatusTag } from '../../../components/common'
import { COMMON_STATUS } from '../../../utils/status'
import { SearchFilters } from '../../../components/common/SearchFilters'
import { usePermissions } from '../../../utils/permissions'
import {
    useOrgDepartments,
    useCreateOrgDepartment,
    useUpdateOrgDepartment,
    useDeleteOrgDepartment,
    useDepartmentOptions,
    useFormModal,
    type OrgDepartment,
} from '../../../hooks'
import { PageContainer } from '../../../components/PageContainer'

export function OrgDepartmentManagement() {
    const [searchParams, setSearchParams] = useState<{ projectId?: string; search?: string }>({})
    const { data: orgDeptData, isLoading } = useOrgDepartments(searchParams.projectId)
    const { mutateAsync: createMutation } = useCreateOrgDepartment()
    const { mutateAsync: updateMutation } = useUpdateOrgDepartment()
    const { mutateAsync: deleteMutation } = useDeleteOrgDepartment()

    const { options: projectOptions } = useDepartmentOptions()

    const modal = useFormModal<OrgDepartment>()
    const [form] = Form.useForm()

    const { hasPermission } = usePermissions()
    const canManage = hasPermission('system', 'department', 'create')

    // 过滤和排序数据
    const filteredData = useMemo(() => {
        let result = orgDeptData?.results || []
        if (searchParams.search) {
            const search = searchParams.search.toLowerCase()
            result = result.filter((d: OrgDepartment) => d.name.toLowerCase().includes(search))
        }
        // 按排序字段排序
        result = [...result].sort((a, b) => {
            const sortA = a.sortOrder ?? 0
            const sortB = b.sortOrder ?? 0
            if (sortA !== sortB) {
                return sortA - sortB
            }
            return (a.name || '').localeCompare(b.name || '', 'zh-CN')
        })
        return result
    }, [orgDeptData, searchParams.search])

    // 父部门选项（排除自身）
    const parentOptions = useMemo(() => {
        const currentId = modal.data?.id
        return (orgDeptData?.results || [])
            .filter((d) => d.active === 1 && d.id !== currentId)
            .map((d) => ({ label: d.name, value: d.id }))
    }, [orgDeptData, modal.data?.id])

    const handleCreate = useMemo(
        () =>
            withErrorHandler(
                async () => {
                    const values = await form.validateFields()
                    await createMutation({
                        projectId: values.projectId,
                        parentId: values.parentId || null,
                        name: values.name,
                        code: values.code || null,
                        description: values.description || null,
                        sortOrder: values.sortOrder ?? 0,
                    } as any)
                    modal.close()
                    form.resetFields()
                },
                {
                    successMessage: '创建成功',
                    onError: (error: unknown) => {
                        handleConflictError(error, '部门名称已存在')
                    },
                }
            ),
        [form, modal, createMutation]
    )

    const handleUpdate = useMemo(
        () =>
            withErrorHandler(
                async () => {
                    const values = await form.validateFields()
                    if (!modal.data?.id) return
                    await updateMutation({
                        id: modal.data.id,
                        data: {
                            parentId: values.parentId || null,
                            name: values.name,
                            code: values.code || null,
                            description: values.description || null,
                            sortOrder: values.sortOrder ?? 0,
                            active: values.active ? 1 : 0,
                        } as any,
                    })
                    modal.close()
                    form.resetFields()
                },
                {
                    successMessage: '更新成功',
                    onError: (error: unknown) => {
                        handleConflictError(error, '部门名称已存在')
                    },
                }
            ),
        [form, modal, updateMutation]
    )

    const handleDelete = useMemo(
        () =>
            withErrorHandler(
                async (id: string) => {
                    await deleteMutation(id)
                },
                {
                    successMessage: '删除成功',
                    errorMessage: '删除失败',
                }
            ),
        [deleteMutation]
    )

    const handleToggleActive = useMemo(
        () =>
            withErrorHandler(
                async (id: string, checked: boolean) => {
                    await updateMutation({ id, data: { active: checked ? 1 : 0 } as any })
                    return checked ? '已启用' : '已停用'
                },
                { showSuccess: true }
            ),
        [updateMutation]
    )

    const columns = [
        { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
        { title: '名称', dataIndex: 'name', key: 'name' },
        { title: '编码', dataIndex: 'code', key: 'code', width: 120 },
        { title: '所属项目', dataIndex: 'project_name', key: 'project_name', width: 150 },
        { title: '上级部门', dataIndex: 'parent_name', key: 'parent_name', width: 150 },
        {
            title: '状态',
            dataIndex: 'active',
            key: 'active',
            width: 100,
            render: (v: number) => <StatusTag status={v === 1 ? 'active' : 'inactive'} statusMap={COMMON_STATUS} />,
        },
    ]

    return (
        <PageContainer title="部门管理" breadcrumb={[{ title: '系统设置' }, { title: '部门管理' }]}>
            <Card bordered={false} className="page-card">
                <SearchFilters
                    fields={[
                        {
                            name: 'projectId',
                            label: '所属项目',
                            type: 'select',
                            placeholder: '请选择项目',
                            options: [{ label: '全部', value: '' }, ...projectOptions],
                        },
                        { name: 'search', label: '部门名称', type: 'input', placeholder: '请输入部门名称' },
                    ]}
                    onSearch={setSearchParams}
                    onReset={() => setSearchParams({})}
                    initialValues={searchParams}
                />

                <PageToolbar
                    actions={
                        canManage
                            ? [
                                {
                                    label: '新建部门',
                                    type: 'primary',
                                    onClick: () => {
                                        modal.openCreate()
                                        form.resetFields()
                                        // 默认选中当前筛选的项目
                                        if (searchParams.projectId) {
                                            form.setFieldValue('projectId', searchParams.projectId)
                                        }
                                    },
                                },
                            ]
                            : []
                    }
                    style={{ marginTop: 16 }}
                />

                <DataTable<OrgDepartment>
                    columns={columns}
                    data={filteredData}
                    loading={isLoading}
                    rowKey="id"
                    actions={(record) => (
                        <Space>
                            {canManage && (
                                <Button
                                    size="small"
                                    onClick={() => {
                                        modal.openEdit(record)
                                        form.setFieldsValue({
                                            projectId: record.project_id,
                                            parentId: record.parentId,
                                            name: record.name,
                                            code: record.code,
                                            description: record.description,
                                            sortOrder: record.sortOrder ?? 0,
                                            active: record.active === 1,
                                        })
                                    }}
                                >
                                    编辑
                                </Button>
                            )}
                            {canManage && (
                                <Switch
                                    size="small"
                                    checked={record.active === 1}
                                    onChange={(checked) => handleToggleActive(record.id, checked)}
                                />
                            )}
                            {canManage && (
                                <Popconfirm
                                    title={`确定要删除部门"${record.name}"吗？`}
                                    description="删除后该部门将被永久删除"
                                    onConfirm={() => handleDelete(record.id)}
                                    okText="确定"
                                    cancelText="取消"
                                >
                                    <Button size="small" danger>
                                        删除
                                    </Button>
                                </Popconfirm>
                            )}
                        </Space>
                    )}
                    pagination={{ pageSize: 20 }}
                    tableProps={{ className: 'table-striped' }}
                />

                <FormModal
                    title={modal.isEdit ? '编辑部门' : '新建部门'}
                    open={modal.isOpen}
                    form={form}
                    onSubmit={modal.isEdit ? handleUpdate : handleCreate}
                    onCancel={() => {
                        modal.close()
                        form.resetFields()
                    }}
                >
                    <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
                        <Select options={projectOptions} placeholder="请选择项目" disabled={modal.isEdit} />
                    </Form.Item>
                    <Form.Item name="parentId" label="上级部门">
                        <Select options={parentOptions} placeholder="无上级部门" allowClear />
                    </Form.Item>
                    <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label="部门编码">
                        <Input placeholder="可选" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={2} placeholder="可选" />
                    </Form.Item>
                    <Form.Item name="sortOrder" label="排序" tooltip="数字越小越靠前">
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="默认0" />
                    </Form.Item>
                </FormModal>
            </Card>
        </PageContainer>
    )
}
