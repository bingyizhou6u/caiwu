export const PROJECT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: '进行中', color: 'processing' },
    on_hold: { label: '暂停', color: 'warning' },
    completed: { label: '已完成', color: 'success' },
    cancelled: { label: '已取消', color: 'default' },
}

export const TASK_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'red' },
    medium: { label: '中', color: 'orange' },
    low: { label: '低', color: 'green' },
}

export const KANBAN_COLUMNS = [
    { key: 'todo', title: '待办', color: '#8c8c8c' },
    { key: 'design_review', title: '需求评审', color: '#fa8c16' },
    { key: 'in_progress', title: '开发中', color: '#1890ff' },
    { key: 'code_review', title: '代码评审', color: '#faad14' },
    { key: 'testing', title: '测试中', color: '#722ed1' },
    { key: 'completed', title: '已完成', color: '#52c41a' },
] as const

export const PROJECT_STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '进行中', value: 'active' },
    { label: '暂停', value: 'on_hold' },
    { label: '已完成', value: 'completed' },
    { label: '已取消', value: 'cancelled' },
]
