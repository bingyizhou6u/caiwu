import { useQuery } from '@tanstack/react-query'
import { api } from '../config/api'
import { api as apiClient } from '../api/http'

/**
 * 权限模块配置类型定义
 */
export interface PermissionSubModule {
    label: string
    actions: string[]
}

export interface PermissionModuleConfig {
    label: string
    subModules: Record<string, PermissionSubModule>
}

export interface PermissionConfigResponse {
    modules: Record<string, PermissionModuleConfig>
    actionLabels: Record<string, string>
    dataScopeLabels: Record<string, string>
    dataScopes: Array<{ value: string; label: string }>
}

/**
 * 本地默认权限模块配置（用于 API 失败时的降级）
 */
const DEFAULT_PERMISSION_MODULES: Record<string, PermissionModuleConfig> = {
    finance: {
        label: '财务模块',
        subModules: {
            flow: { label: '资金流水', actions: ['view', 'create', 'update', 'delete', 'export'] },
            transfer: { label: '账户转账', actions: ['view', 'create'] },
            ar: { label: '应收管理', actions: ['view', 'create', 'update', 'delete'] },
            ap: { label: '应付管理', actions: ['view', 'create', 'update', 'delete'] },
            salary: { label: '工资发放', actions: ['view', 'create', 'update'] },
            allowance: { label: '补贴发放', actions: ['view', 'create'] },
            site_bill: { label: '站点账单', actions: ['view', 'create', 'update'] },
            borrowing: { label: '借款管理', actions: ['view', 'create', 'approve', 'reject'] },
        }
    },
    hr: {
        label: '人事模块',
        subModules: {
            employee: { label: '员工管理', actions: ['view', 'create', 'update', 'delete', 'view_sensitive'] },
            salary: { label: '薪资查看', actions: ['view', 'create'] },
            leave: { label: '请假管理', actions: ['view', 'create', 'update', 'delete', 'approve'] },
            reimbursement: { label: '报销管理', actions: ['view', 'create', 'update', 'delete', 'approve'] },
        }
    },
    asset: {
        label: '资产模块',
        subModules: {
            fixed: { label: '固定资产', actions: ['view', 'create', 'update', 'delete', 'allocate'] },
            rental: { label: '租赁管理', actions: ['view', 'create', 'update', 'delete'] },
        }
    },
    site: {
        label: '站点模块',
        subModules: {
            info: { label: '站点信息', actions: ['view', 'create', 'update', 'delete'] },
            bill: { label: '费用账单', actions: ['view', 'create', 'update', 'delete'] },
        }
    },
    report: {
        label: '报表模块',
        subModules: {
            view: { label: '综合视图', actions: ['view'] },
            finance: { label: '财务报表', actions: ['view', 'export'] },
            salary: { label: '薪资报表', actions: ['view', 'export'] },
            hr: { label: '人事报表', actions: ['view', 'export'] },
            asset: { label: '资产报表', actions: ['view', 'export'] },
            export: { label: '导出中心', actions: ['export'] }, // Legacy/Admin support
        }
    },
    system: {
        label: '系统模块',
        subModules: {
            user: { label: '用户管理', actions: ['view', 'create', 'update', 'delete'] },
            position: { label: '职位管理', actions: ['view', 'create', 'update', 'delete'] },
            department: { label: '部门管理', actions: ['view', 'create', 'update', 'delete'] },
            account: { label: '账户管理', actions: ['view', 'create', 'update', 'delete'] },
            category: { label: '分类管理', actions: ['view', 'create', 'update', 'delete'] },
            currency: { label: '币种管理', actions: ['view', 'create', 'update', 'delete'] },
            headquarters: { label: '总部管理', actions: ['view', 'create', 'update', 'delete'] },
            vendor: { label: '供应商管理', actions: ['view', 'create', 'update', 'delete'] },
            audit: { label: '审计日志', actions: ['view', 'export'] },
            config: { label: '系统配置', actions: ['view', 'update'] },
            site_config: { label: '站点配置(旧)', actions: ['manage'] }, // Legacy
        }
    },
    self: {
        label: '个人模块',
        subModules: {
            leave: { label: '我的请假', actions: ['view', 'create'] },
            reimbursement: { label: '我的报销', actions: ['view', 'create'] },
            salary: { label: '我的工资', actions: ['view'] },
            asset: { label: '我的资产', actions: ['view'] },
        }
    },
}

const DEFAULT_ACTION_LABELS: Record<string, string> = {
    view: '查看',
    create: '创建',
    update: '编辑',
    delete: '删除',
    export: '导出',
    approve: '审批',
    reject: '拒绝',
    reverse: '红冲',
    pay: '支付',
    allocate: '分配',
    view_sensitive: '敏感信息',
}

const DEFAULT_DATA_SCOPE_LABELS: Record<string, string> = {
    all: '总部 (全部数据)',
    project: '项目 (本项目数据)',
    group: '组 (本组数据)',
    self: '个人 (仅本人数据)',
}

const DEFAULT_DATA_SCOPES = [
    { value: 'all', label: '总部 (全部数据)' },
    { value: 'project', label: '项目 (本项目数据)' },
    { value: 'group', label: '组 (本组数据)' },
    { value: 'self', label: '个人 (仅本人数据)' },
]

/**
 * 获取权限模块配置
 * 从后端 API 获取，如果失败则使用本地默认值
 */
export function usePermissionConfig() {
    const query = useQuery({
        queryKey: ['permission-config', 'v20251228'], // Force cache invalidation
        queryFn: async (): Promise<PermissionConfigResponse> => {
            const response = await apiClient.get<PermissionConfigResponse>(api.permissionConfig)
            return response
        },
        staleTime: 0, // Always fetch fresh
        gcTime: 1000 * 60 * 60, // Cache for 1 hour
        retry: 1,
    })

    // 返回数据，如果 API 失败则使用默认值
    return {
        modules: query.data?.modules ?? DEFAULT_PERMISSION_MODULES,
        actionLabels: query.data?.actionLabels ?? DEFAULT_ACTION_LABELS,
        dataScopeLabels: query.data?.dataScopeLabels ?? DEFAULT_DATA_SCOPE_LABELS,
        dataScopes: query.data?.dataScopes ?? DEFAULT_DATA_SCOPES,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    }
}
