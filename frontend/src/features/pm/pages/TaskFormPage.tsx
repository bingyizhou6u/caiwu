/**
 * 任务表单页面
 * 支持新建和编辑任务
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
    Button, Card, Form, Input, Select, DatePicker, InputNumber, message, Spin, Typography
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useCreateTask, useUpdateTask, useTask, useProjects, type Task, type Project } from '../../../hooks/business/usePM'
import { useEmployees } from '../../../hooks/business/useEmployees'
import { PageContainer } from '../../../components/PageContainer'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Title } = Typography

// 任务类型选项
const TYPE_OPTIONS = [
    { value: 'dev', label: '开发' },
    { value: 'design', label: '设计' },
    { value: 'test', label: '测试' },
    { value: 'doc', label: '文档' },
    { value: 'deploy', label: '部署' },
    { value: 'meeting', label: '会议' },
    { value: 'other', label: '其他' },
]

// 优先级选项
const PRIORITY_OPTIONS = [
    { value: 'high', label: '高' },
    { value: 'medium', label: '中' },
    { value: 'low', label: '低' },
]

// 状态选项
const STATUS_OPTIONS = [
    { value: 'todo', label: '待办' },
    { value: 'in_progress', label: '进行中' },
    { value: 'review', label: '评审中' },
    { value: 'completed', label: '已完成' },
    { value: 'blocked', label: '已阻塞' },
    { value: 'cancelled', label: '已取消' },
]

export default function TaskFormPage() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [form] = Form.useForm()

    const isEditMode = !!id
    const projectIdFromUrl = searchParams.get('projectId') || ''

    // Hooks
    const { data: projects = [] } = useProjects()
    const { data: employees = [] } = useEmployees()
    const employeeOptions = employees.map((e: any) => ({ value: e.id, label: e.name || e.email }))

    // 编辑模式直接获取单个任务
    const { data: currentTask, isLoading: taskLoading } = useTask(isEditMode ? id! : '')
    const createTask = useCreateTask()
    const updateTask = useUpdateTask()

    // 初始化表单
    useEffect(() => {
        if (isEditMode && currentTask) {
            form.setFieldsValue({
                ...currentTask,
                startDate: currentTask.startDate ? dayjs(currentTask.startDate) : null,
                dueDate: currentTask.dueDate ? dayjs(currentTask.dueDate) : null,
            })
        } else if (!isEditMode && projectIdFromUrl) {
            form.setFieldsValue({ projectId: projectIdFromUrl })
        }
    }, [currentTask, isEditMode, projectIdFromUrl, form])

    // 提交表单
    const handleSubmit = async (values: any) => {
        const data = {
            ...values,
            startDate: values.startDate?.format('YYYY-MM-DD'),
            dueDate: values.dueDate?.format('YYYY-MM-DD'),
        }

        try {
            if (isEditMode) {
                await updateTask.mutateAsync({ id: id!, data })
                message.success('任务已更新')
            } else {
                await createTask.mutateAsync(data)
                message.success('任务已创建')
            }
            // 返回看板或项目详情
            if (data.projectId) {
                navigate(`/pm/tasks/kanban?projectId=${data.projectId}`)
            } else {
                navigate(-1)
            }
        } catch (error: any) {
            message.error(error?.message || '操作失败')
        }
    }

    // 加载中状态
    if (isEditMode && taskLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Spin size="large" />
            </div>
        )
    }

    // 编辑模式下未找到任务
    if (isEditMode && !currentTask && !taskLoading) {
        return (
            <div className="p-6">
                <Card>
                    <div className="text-center py-8">
                        <Title level={4}>任务不存在</Title>
                        <Button onClick={() => navigate(-1)}>返回</Button>
                    </div>
                </Card>
            </div>
        )
    }

    const selectedProjectId = Form.useWatch('projectId', form)

    return (
        <PageContainer
            title={isEditMode ? '编辑任务' : '新建任务'}
            breadcrumb={[{ title: '项目管理' }, { title: '任务看板' }, { title: isEditMode ? '编辑' : '新建' }]}
        >
            <Card bordered={false} className="page-card">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        type: 'dev',
                        priority: 'medium',
                        status: 'todo',
                    }}
                    style={{ maxWidth: 800 }}
                >
                    {/* 所属项目 */}
                    <Form.Item
                        name="projectId"
                        label="所属项目"
                        rules={[{ required: true, message: '请选择项目' }]}
                    >
                        <Select
                            placeholder="选择项目"
                            showSearch
                            optionFilterProp="label"
                            options={projects.map((p: Project) => ({
                                value: p.id,
                                label: `${p.code} - ${p.name}`,
                            }))}
                            disabled={isEditMode} // 编辑时不能更换项目
                        />
                    </Form.Item>

                    {/* 任务标题 */}
                    <Form.Item
                        name="title"
                        label="任务标题"
                        rules={[{ required: true, message: '请输入任务标题' }]}
                    >
                        <Input placeholder="输入任务标题" maxLength={100} />
                    </Form.Item>

                    {/* 任务描述 */}
                    <Form.Item name="description" label="描述">
                        <TextArea
                            placeholder="输入任务描述（支持 Markdown）"
                            rows={4}
                            maxLength={2000}
                        />
                    </Form.Item>

                    {/* 类型和优先级 */}
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="type" label="类型">
                            <Select options={TYPE_OPTIONS} />
                        </Form.Item>
                        <Form.Item name="priority" label="优先级">
                            <Select options={PRIORITY_OPTIONS} />
                        </Form.Item>
                    </div>

                    {/* 状态（仅编辑时显示） */}
                    {isEditMode && (
                        <Form.Item name="status" label="状态">
                            <Select options={STATUS_OPTIONS} />
                        </Form.Item>
                    )}

                    {/* 负责人 */}
                    <Form.Item name="assigneeId" label="负责人">
                        <Select
                            placeholder="选择负责人"
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            options={employeeOptions}
                        />
                    </Form.Item>

                    {/* 日期范围 */}
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="startDate" label="开始日期">
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item name="dueDate" label="截止日期">
                            <DatePicker className="w-full" />
                        </Form.Item>
                    </div>

                    {/* 预估工时 */}
                    <Form.Item name="estimatedHours" label="预估工时（小时）">
                        <InputNumber min={0} max={1000} step={0.5} className="w-full" />
                    </Form.Item>

                    {/* 提交按钮 */}
                    <Form.Item className="mt-6">
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            loading={createTask.isPending || updateTask.isPending}
                        >
                            {isEditMode ? '保存修改' : '创建任务'}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </PageContainer>
    )
}
