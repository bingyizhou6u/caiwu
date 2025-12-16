# API 版本管理策略

**文档版本**: 1.0  
**最后更新**: 2025-01-27

---

## 📋 版本策略概述

### 当前状态

- **当前版本**: V2
- **路由映射**:
  - `/api/*` → V2（默认）
  - `/api/v2/*` → V2（显式）
- **OpenAPI 文档**: `/api/doc`
- **Swagger UI**: `/api/ui`

---

## 🎯 版本管理原则

### 1. 语义化版本

API 版本遵循语义化版本控制：

- **主版本号 (Major)**: 不兼容的 API 变更
- **次版本号 (Minor)**: 向后兼容的功能新增
- **修订版本号 (Patch)**: 向后兼容的问题修复

### 2. URL 版本控制

使用 URL 路径进行版本控制：

```
/api/v2/employees     # V2 版本
/api/v3/employees     # V3 版本（未来）
```

### 3. 版本兼容性

- **向后兼容**: 新版本必须支持旧版本的数据格式
- **弃用策略**: 旧版本至少保留 6 个月
- **迁移路径**: 提供清晰的迁移指南

---

## 📝 版本变更规则

### Major 版本变更（V2 → V3）

触发条件：
- 删除或重命名 API 端点
- 改变请求/响应格式
- 改变认证机制
- 改变错误响应格式

示例：
```typescript
// V2
GET /api/v2/employees
Response: { success: true, data: [...] }

// V3
GET /api/v3/employees
Response: { data: [...], meta: {...} }  // 格式变更
```

### Minor 版本变更（V2.0 → V2.1）

触发条件：
- 添加新的 API 端点
- 添加新的响应字段（可选）
- 添加新的查询参数

示例：
```typescript
// V2.0
GET /api/v2/employees

// V2.1
GET /api/v2/employees?include=department  // 新增查询参数
```

### Patch 版本变更（V2.0.0 → V2.0.1）

触发条件：
- 修复 bug
- 性能优化
- 文档更新

---

## 🔄 版本迁移流程

### 1. 规划阶段

- [ ] 确定版本变更类型（Major/Minor/Patch）
- [ ] 评估影响范围
- [ ] 制定迁移计划
- [ ] 更新文档

### 2. 开发阶段

- [ ] 创建新版本路由目录
- [ ] 实现新版本 API
- [ ] 编写迁移指南
- [ ] 更新 OpenAPI 文档

### 3. 测试阶段

- [ ] 单元测试
- [ ] 集成测试
- [ ] 兼容性测试
- [ ] 性能测试

### 4. 发布阶段

- [ ] 部署新版本
- [ ] 监控错误和性能
- [ ] 收集用户反馈
- [ ] 更新文档

### 5. 弃用阶段

- [ ] 标记旧版本为弃用
- [ ] 通知用户迁移
- [ ] 设置弃用截止日期
- [ ] 最终移除旧版本

---

## 📚 版本路由结构

```
backend/src/routes/
├── v2/              # V2 版本路由
│   ├── auth.ts
│   ├── employees.ts
│   └── ...
├── v3/              # V3 版本路由（未来）
│   ├── auth.ts
│   ├── employees.ts
│   └── ...
└── shared/          # 共享工具和中间件
    ├── middleware.ts
    └── ...
```

---

## 🔧 实现示例

### 路由注册

```typescript
// backend/src/index.ts

// V2 路由
const v2 = new OpenAPIHono()
v2.route('/', authRoutesV2)
v2.route('/', employeesRoutesV2)
app.route('/api', v2)
app.route('/api/v2', v2)

// V3 路由（未来）
const v3 = new OpenAPIHono()
v3.route('/', authRoutesV3)
v3.route('/', employeesRoutesV3)
app.route('/api/v3', v3)
```

### 版本检测中间件

```typescript
// 检测 API 版本
app.use('/api/*', async (c, next) => {
  const path = c.req.path
  if (path.startsWith('/api/v3')) {
    c.set('apiVersion', 'v3')
  } else if (path.startsWith('/api/v2')) {
    c.set('apiVersion', 'v2')
  } else {
    c.set('apiVersion', 'v2') // 默认 V2
  }
  await next()
})
```

---

## 📊 版本状态

| 版本 | 状态 | 发布日期 | 弃用日期 | 移除日期 |
|------|------|---------|---------|---------|
| V2 | ✅ 当前 | 2024-11-21 | - | - |
| V1 | ❌ 已弃用 | - | 2024-11-21 | 2025-05-21 |

---

## 🚨 弃用通知

### V1 版本弃用

**弃用日期**: 2024-11-21  
**移除日期**: 2025-05-21（预计）

**迁移指南**: 请参考 [V1 到 V2 迁移指南](./MIGRATION_V1_TO_V2.md)

---

## 📖 相关文档

- [API 设计规范](./API设计.md)
- [错误处理规范](./ERROR_CODES.md)
- [响应格式规范](./V2_API_RESPONSE_FORMAT.md)

---

## 🔍 版本检查清单

创建新版本时，请确保：

- [ ] 更新 OpenAPI 文档版本号
- [ ] 更新路由注册代码
- [ ] 创建版本目录结构
- [ ] 编写迁移指南
- [ ] 更新版本状态表
- [ ] 通知用户版本变更
- [ ] 设置弃用时间表

---

**维护者**: 开发团队  
**审核周期**: 每季度审核一次版本策略
