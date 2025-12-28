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
  PM = 'pm', // 项目管理模块
}

export type PermissionModuleType = 'hr' | 'finance' | 'asset' | 'report' | 'system' | 'site' | 'auth' | 'pm'

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
  ASSIGN = 'assign',   // 指派
  REVIEW = 'review',   // 评审
}

export type PermissionActionType = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'reverse' | 'pay' | 'allocate' | 'view_sensitive' | 'assign' | 'review'

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
  assign: '指派',
  review: '评审',
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
  pm: {
    label: '项目管理',
    subModules: {
      project: { label: '项目', actions: ['view', 'create', 'update', 'delete'] },
      requirement: { label: '需求', actions: ['view', 'create', 'update', 'delete', 'review', 'assign'] },
      task: { label: '任务', actions: ['view', 'create', 'update', 'delete', 'assign'] },
      timelog: { label: '工时', actions: ['view', 'create', 'update', 'delete'] },
      milestone: { label: '里程碑', actions: ['view', 'create', 'update', 'delete'] },
      report: { label: '进度报表', actions: ['view', 'export'] },
    }
  },
  self: {
    label: '个人模块',
    subModules: {
      leave: { label: '我的请假', actions: ['view', 'create'] },
      reimbursement: { label: '我的报销', actions: ['view', 'create'] },
      salary: { label: '我的工资', actions: ['view'] },
      asset: { label: '我的资产', actions: ['view'] },
      task: { label: '我的任务', actions: ['view', 'update'] },
      timelog: { label: '我的工时', actions: ['view', 'create', 'update'] },
    }
  },
}

