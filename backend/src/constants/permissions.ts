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

export type PermissionActionType = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'reverse' | 'pay' | 'allocate'
