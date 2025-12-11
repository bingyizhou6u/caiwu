---
description: 如何开始一个新的开发任务（阅读知识库）
---
# 开始新任务前的准备

在开始任何开发任务前，请先阅读相关文档以了解项目上下文。

## 步骤

1. 首先阅读知识索引文件:
   - 文件路径: `.agent/KNOWLEDGE_INDEX.md`
   - 这个索引包含了所有文档的结构化映射

2. 根据任务类型，阅读对应的核心文档:
   - **员工相关**: `.qoder/repowiki/zh/content/核心功能模块/员工管理模块.md`
   - **财务相关**: `.qoder/repowiki/zh/content/核心功能模块/财务管理模块.md`
   - **薪资相关**: `.qoder/repowiki/zh/content/核心功能模块/薪资管理模块.md`
   - **权限相关**: `.qoder/repowiki/zh/content/认证与权限系统/认证与权限系统.md`
   - **资产相关**: `.qoder/repowiki/zh/content/核心功能模块/资产管理模块.md`

3. 如果涉及 API 开发，阅读 API 参考:
   - 目录: `.qoder/repowiki/zh/content/API参考/`

4. 如果涉及数据库修改，阅读数据模型:
   - 目录: `.qoder/repowiki/zh/content/数据库设计/`
   - 核心文件: `backend/src/db/schema.ts`

5. 了解编码规范:
   - 后端: `.qoder/repowiki/zh/content/开发指南/编码规范/后端编码规范.md`
   - 前端: `.qoder/repowiki/zh/content/开发指南/编码规范/前端编码规范.md`

## 提示

- 系统使用 Drizzle ORM 操作数据库
- 后端运行在 Cloudflare Workers 环境
- 前端使用 React + Ant Design + React Query
- 权限基于职位 (position) 的 RBAC 模型
