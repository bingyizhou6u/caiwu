# Implementation Plan: Permission System Optimization

## Overview

分阶段实现权限系统优化，从核心组件开始，逐步替换现有实现。

## Tasks

- [x] 1. 创建核心权限工具类
  - [x] 1.1 创建 Permission Context 类
    - 在 `backend/src/utils/permission-context.ts` 创建 `PermissionContext` 类
    - 封装权限信息和检查方法
    - 实现 `hasPermission()`, `canAccessData()`, `canApprove()` 方法
    - 实现 `toJSON()` 方法供前端使用
    - 实现 `createPermissionContext()` 工厂函数
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 编写 Permission Context 属性测试
    - 在 `backend/test/utils/permission-context.test.ts` 创建测试
    - **Property 4: Permission Context Completeness**
    - **Property 5: hasPermission Method Correctness**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 1.3 创建 Data Access Filter 工具函数
    - 在 `backend/src/utils/data-access-filter.ts` 创建 `createDataAccessFilter()` 函数
    - 基于现有 `getDataAccessFilterSQL` 重构，提供更清晰的 API
    - 支持 all/project/group/self 四种数据范围
    - 支持自定义字段映射配置
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.4 编写 Data Access Filter 属性测试
    - 在 `backend/test/utils/data-access-filter.test.ts` 创建测试
    - **Property 2: Data Access Filter Correctness**
    - **Property 3: Field Mapping Consistency**
    - **Validates: Requirements 2.1, 2.6**

- [x] 2. 增强权限守卫中间件
  - [x] 2.1 扩展 Permission Guard 中间件
    - 更新 `backend/src/middleware/permission.ts`
    - 添加 `createPermissionGuard(config)` 支持复杂配置
    - 支持 AND/OR 组合逻辑
    - 支持跳过权限检查的配置
    - 添加自定义错误消息支持
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 编写 Permission Guard 属性测试
    - 在 `backend/test/middleware/permission-guard.test.ts` 创建测试
    - **Property 1: Permission Check Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 2.3 集成 Permission Context 到请求上下文
    - 更新 `backend/src/middleware/di.ts` 或认证中间件
    - 在认证成功后自动创建并注入 PermissionContext
    - 在 ServiceContainer 中添加 PermissionContext 访问
    - _Requirements: 1.1, 3.1_

- [x] 3. Checkpoint - 核心组件完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现权限审计功能
  - [x] 4.1 创建 Permission Audit Service
    - 在 `backend/src/services/system/PermissionAuditService.ts` 创建服务
    - 实现 `logPermissionChange()` 方法记录权限变更
    - 实现 `getPermissionHistory()` 查询方法
    - 实现 `diffPermissions()` 静态方法计算权限差异
    - 复用现有 `businessOperationHistory` 表
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 编写 Permission Audit 属性测试
    - 在 `backend/test/services/PermissionAuditService.test.ts` 创建测试
    - **Property 6: Audit Log Completeness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 4.3 集成审计到现有服务
    - 更新 `PositionService` 添加权限变更审计
    - 更新 `EmployeeService` 添加职位变更审计
    - 更新 `OrgDepartmentService` 添加模块权限变更审计
    - 在 ServiceContainer 中注册 PermissionAuditService
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. 实现前端权限接口
  - [x] 5.1 创建 /api/v2/my/permissions 接口
    - 在 `backend/src/routes/v2/my.ts` 添加 permissions 路由
    - 返回完整的权限信息（permissions, dataScope, canManageSubordinates, allowedModules）
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 编写权限接口测试
    - 在 `backend/test/routes/my-permissions.test.ts` 创建测试
    - **Property 8: API Response Completeness**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 5.3 更新前端权限工具
    - 更新 `frontend/src/utils/permissions.ts` 使用新接口
    - 添加权限信息缓存和刷新机制
    - 更新 `usePermissions` hook 支持新的数据结构
    - _Requirements: 5.5_

- [x] 6. Checkpoint - 权限接口完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 重构现有代码使用新权限系统
  - [x] 7.1 重构财务模块路由
    - 更新 `flows.ts`, `ar-ap.ts`, `account-transfers.ts` 等路由
    - 使用 `createPermissionGuard` 替换手动权限检查
    - 使用 `createDataAccessFilter` 替换手动数据过滤
    - _Requirements: 1.1, 2.1_

  - [x] 7.2 重构人事模块路由
    - 更新 `employees.ts`, `salary-payments.ts`, `employee-leaves.ts` 等路由
    - 使用 `createPermissionGuard` 替换手动权限检查
    - 使用 `createDataAccessFilter` 替换手动数据过滤
    - _Requirements: 1.1, 2.1_

  - [x] 7.3 重构资产模块路由
    - 更新 `fixed-assets.ts`, `rental.ts` 等路由
    - 使用 `createPermissionGuard` 替换手动权限检查
    - 使用 `createDataAccessFilter` 替换手动数据过滤
    - _Requirements: 1.1, 2.1_

  - [x] 7.4 重构系统模块路由
    - 更新 `position-permissions.ts`, `system-config.ts` 等路由
    - 使用 `createPermissionGuard` 替换手动权限检查
    - _Requirements: 1.1_

  - [x] 7.5 重构项目管理模块路由
    - 更新 `backend/src/routes/v2/pm/` 下的路由文件
    - 使用 `createPermissionGuard` 替换手动权限检查
    - 使用 `createDataAccessFilter` 替换手动数据过滤
    - _Requirements: 1.1, 2.1_

- [x] 8. 性能优化
  - [x] 8.1 实现权限缓存优化
    - 优化 KV 缓存策略，减少数据库查询
    - 在 PermissionContext 中实现缓存读取
    - 实现缓存失效机制（权限变更时清除）
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 编写缓存一致性测试
    - 在 `backend/test/utils/permission-cache.test.ts` 创建测试
    - **Property 7: Cache Consistency**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 8.3 实现批量权限检查
    - 在 PermissionContext 中添加 `checkPermissions()` 批量检查方法
    - 优化多权限检查场景的性能
    - _Requirements: 6.4_

- [x] 9. 清理冗余代码
  - [x] 9.1 移除旧的权限检查代码
    - 删除各服务中分散的权限检查逻辑
    - 删除重复的数据过滤代码
    - 统一使用新的权限系统

  - [x] 9.2 更新文档
    - 更新 `docs/backend/permissions.md` 说明新的权限系统
    - 添加权限守卫使用示例
    - 更新 API 文档说明权限要求

- [x] 10. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 运行完整的测试套件验证无回归

## Notes

- 每个 Checkpoint 后应确认功能正常再继续
- 重构阶段可以分批进行，每个模块独立完成
- Property 测试使用 fast-check 库
- 带 `*` 标记的测试任务为可选，可跳过以加快 MVP 进度
- 现有 `requirePermission` 和 `getDataAccessFilterSQL` 可作为基础进行扩展

