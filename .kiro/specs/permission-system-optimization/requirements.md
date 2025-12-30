# Requirements Document

## Introduction

优化现有的权限管理系统，提升代码可维护性、安全性和性能。当前系统采用 RBAC + 数据范围隔离的混合模式，但存在权限检查分散、缺少路由级守卫、数据过滤逻辑重复等问题。本次优化旨在统一权限检查机制，提供声明式的权限配置方式，并优化数据访问过滤的性能。

## Glossary

- **Permission_System**: 权限管理系统，负责控制用户对功能和数据的访问
- **Permission_Guard**: 权限守卫中间件，在路由级别进行权限检查
- **Data_Access_Filter**: 数据访问过滤器，根据用户数据范围生成 SQL 过滤条件
- **Permission_Context**: 权限上下文，包含用户的完整权限信息
- **Audit_Logger**: 审计日志记录器，记录权限相关的操作

## Requirements

### Requirement 1: 路由级权限守卫

**User Story:** As a 开发者, I want 在路由定义时声明所需权限, so that 权限检查逻辑统一且不易遗漏。

#### Acceptance Criteria

1. WHEN 定义 API 路由时, THE Permission_Guard SHALL 支持声明式权限配置 `requirePermission(module, subModule, action)`
2. WHEN 请求到达受保护路由时, THE Permission_Guard SHALL 自动检查用户是否具有所需权限
3. IF 用户缺少所需权限, THEN THE Permission_Guard SHALL 返回 403 状态码和标准错误响应
4. WHEN 路由需要多个权限时, THE Permission_Guard SHALL 支持 AND/OR 组合逻辑
5. THE Permission_Guard SHALL 支持跳过权限检查的配置（用于公开接口）

### Requirement 2: 统一数据访问过滤

**User Story:** As a 开发者, I want 自动根据用户数据范围过滤查询结果, so that 不需要在每个服务方法中重复编写过滤逻辑。

#### Acceptance Criteria

1. WHEN 查询需要数据范围过滤时, THE Data_Access_Filter SHALL 根据用户 dataScope 生成对应的 SQL WHERE 条件
2. WHEN dataScope 为 'all' 时, THE Data_Access_Filter SHALL 返回空条件（不过滤）
3. WHEN dataScope 为 'project' 时, THE Data_Access_Filter SHALL 返回 `projectId = 用户projectId` 条件
4. WHEN dataScope 为 'group' 时, THE Data_Access_Filter SHALL 返回 `orgDepartmentId = 用户orgDepartmentId` 条件
5. WHEN dataScope 为 'self' 时, THE Data_Access_Filter SHALL 返回 `employeeId = 用户id` 或 `createdBy = 用户id` 条件
6. THE Data_Access_Filter SHALL 支持自定义字段名映射（不同表的字段名可能不同）

### Requirement 3: 权限上下文增强

**User Story:** As a 开发者, I want 在请求上下文中获取完整的权限信息, so that 可以方便地进行权限判断。

#### Acceptance Criteria

1. THE Permission_Context SHALL 在认证成功后自动注入到请求上下文
2. THE Permission_Context SHALL 包含用户的所有权限信息（permissions, dataScope, canManageSubordinates）
3. THE Permission_Context SHALL 提供 `hasPermission(module, subModule, action)` 方法
4. THE Permission_Context SHALL 提供 `canAccessData(targetEmployeeId)` 方法
5. THE Permission_Context SHALL 提供 `canApprove(applicantEmployeeId)` 方法
6. WHEN 权限信息变更时, THE Permission_Context SHALL 支持刷新缓存

### Requirement 4: 权限变更审计

**User Story:** As a 系统管理员, I want 追踪所有权限相关的变更, so that 可以审计和排查权限问题。

#### Acceptance Criteria

1. WHEN 职位权限被修改时, THE Audit_Logger SHALL 记录变更前后的权限差异
2. WHEN 员工职位被变更时, THE Audit_Logger SHALL 记录职位变更信息
3. WHEN 部门模块权限被修改时, THE Audit_Logger SHALL 记录变更详情
4. THE Audit_Logger SHALL 记录操作人、操作时间、IP 地址等上下文信息
5. THE Audit_Logger SHALL 支持按实体类型和时间范围查询审计日志

### Requirement 5: 前后端权限同步

**User Story:** As a 前端开发者, I want 获取当前用户的完整权限信息, so that 可以正确显示/隐藏 UI 元素。

#### Acceptance Criteria

1. THE Permission_System SHALL 提供 `/api/v2/my/permissions` 接口返回当前用户的完整权限
2. THE Permission_System SHALL 返回用户的 dataScope 和 canManageSubordinates 信息
3. THE Permission_System SHALL 返回用户所属部门的 allowedModules
4. WHEN 用户权限变更时, THE Permission_System SHALL 通过 WebSocket 或轮询通知前端刷新
5. THE Permission_System SHALL 提供权限检查的工具函数供前端使用

### Requirement 6: 性能优化

**User Story:** As a 用户, I want 权限检查快速完成, so that 不影响系统响应速度。

#### Acceptance Criteria

1. THE Permission_System SHALL 将用户权限信息缓存到 KV 存储
2. WHEN 权限信息已缓存时, THE Permission_System SHALL 直接从缓存读取，不查询数据库
3. WHEN 用户权限变更时, THE Permission_System SHALL 主动失效相关缓存
4. THE Permission_System SHALL 支持批量权限检查，减少重复计算
5. THE Data_Access_Filter SHALL 生成优化的 SQL 条件，避免全表扫描

## Notes

- 优化不需要考虑向后兼容
- 权限检查失败应返回统一的错误格式
- 考虑 Cloudflare Workers 的无状态特性，缓存策略需要使用 KV
