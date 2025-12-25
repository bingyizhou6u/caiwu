/**
 * 权限相关常量定义
 */

// 数据访问范围
export enum DataScope {
  ALL = 'all',        // 总部：查看所有数据
  PROJECT = 'project', // 项目：查看本项目数据
  GROUP = 'group',    // 组：查看本组数据
  SELF = 'self',      // 个人：仅查看自己的数据
}

export type DataScopeType = 'all' | 'project' | 'group' | 'self'

// 权限模块
export enum PermissionModule {
  HR = 'hr',
  FINANCE = 'finance',
  ASSET = 'asset',
  REPORT = 'report',
  SYSTEM = 'system',
  SITE = 'site',
  AUTH = 'auth',
}

export type PermissionModuleType = 'hr' | 'finance' | 'asset' | 'report' | 'system' | 'site' | 'auth'

// 权限操作
export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  EXPORT = 'export',
  REVERSE = 'reverse', // 红冲
  PAY = 'pay',         // 支付
  ALLOCATE = 'allocate', // 分配
}

export type PermissionActionType = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'reverse' | 'pay' | 'allocate' | 'view_sensitive'

// 操作标签映射
export const ACTION_LABELS: Record<string, string> = {
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

// DataScope 标签映射
export const DATA_SCOPE_LABELS: Record<DataScopeType, string> = {
  all: '总部 (全部数据)',
  project: '项目 (本项目数据)',
  group: '组 (本组数据)',
  self: '个人 (仅本人数据)',
}

// 权限模块配置 - 统一前后端定义
export interface PermissionSubModule {
  label: string
  actions: PermissionActionType[]
}

export interface PermissionModuleConfig {
  label: string
  subModules: Record<string, PermissionSubModule>
}

export const PERMISSION_MODULES: Record<string, PermissionModuleConfig> = {
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
      view: { label: '报表查看', actions: ['view'] },
      export: { label: '报表导出', actions: ['export'] },
    }
  },
  system: {
    label: '系统模块',
    subModules: {
      user: { label: '用户管理', actions: ['view', 'create', 'update', 'delete'] },
      position: { label: '职位管理', actions: ['view', 'create', 'update', 'delete'] },
      department: { label: '项目管理', actions: ['view', 'create', 'update', 'delete'] },
      audit: { label: '审计日志', actions: ['view'] },
      config: { label: '系统配置', actions: ['view', 'update'] },
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
