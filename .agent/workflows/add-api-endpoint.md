---
description: 添加新的后端 API 端点
---
# 添加新的后端 API 端点

// turbo-all

## 前置步骤

1. 阅读 API 设计规范:
   - `.qoder/repowiki/zh/content/技术栈与架构/后端架构/API设计/API设计.md`

2. 阅读现有的路由文件结构:
   - `backend/src/routes/`

## 开发步骤

3. 如果需要新建数据表，先修改 schema:
   - 文件: `backend/src/db/schema.ts`
   - 参考: `.qoder/repowiki/zh/content/数据库设计/`

4. 创建或修改 Service 层:
   - 目录: `backend/src/services/`
   - 参考现有 Service 如 `EmployeeService.ts`

5. 创建路由文件或修改现有路由:
   - 目录: `backend/src/routes/`
   - 参考现有路由如 `employees.ts`

6. 在主入口注册路由:
   - 文件: `backend/src/index.ts`

7. 如果需要权限控制，配置权限:
   - 文件: `backend/src/utils/permissions.ts`

8. 运行测试验证:
```bash
cd backend && npm run test
```

## 注意事项

- 所有 API 自动受到 IP 白名单和 JWT 认证保护
- 使用 `protectRoute` 或 `hasPermission` 进行功能权限控制
- 使用 `getDataAccessFilter` 进行数据范围控制
- Schema 使用 Zod 定义并通过 Drizzle 生成 OpenAPI 文档
