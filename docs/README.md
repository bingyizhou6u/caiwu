# AR公司财务管理系统 - 知识库

> **最后更新**: 2025-12-27  
> 项目文档统一索引

---

## 📚 文档结构

```
docs/
├── README.md              # 本文件（知识库索引）
│
├── backend/               # 后端核心文档
│   ├── database.md        # 数据库设计
│   ├── permissions.md     # 权限系统
│   ├── api-reference.md   # API 接口参考
│   ├── services.md        # 服务层架构
│   ├── security.md        # 安全架构 (CF Access)
│   ├── authentication.md  # 认证流程
│   └── timezone.md        # 业务时区
│
├── modules/               # 业务模块文档
│   ├── finance.md         # 财务模块
│   ├── hr.md              # 人力资源
│   ├── assets.md          # 资产管理
│   ├── sites.md           # 站点管理
│   ├── reports.md         # 报表模块
│   └── pm.md              # 项目管理
│
├── frontend/              # 前端文档
│   ├── form-components.md # 表单组件
│   ├── component-split.md # 组件拆分指南
│   ├── styles.md          # 样式架构与分析
│   ├── hooks.md           # 自定义 Hooks
│   └── router.md          # 路由配置
│
├── guides/                # 指南类文档
│   ├── deploy.md          # 部署指南
│   ├── testing.md         # 测试指南
│   ├── usage.md           # 使用指南
│   └── env-setup.md       # 环境配置清单
│
├── architecture/          # 架构类文档
│   ├── review.md          # 架构评审报告
│   └── api-versioning.md  # API 版本管理
│
├── standards/             # 规范类文档
│   ├── development.md     # 开发规范
│   └── code-review.md     # 代码审查清单
│
└── workflows/             # 工作流
    ├── deploy.zh.md / deploy.en.md
    ├── development.zh.md / development.en.md
    └── test.zh.md / test.en.md
```

---

## 🎯 快速导航

### 后端核心
- **[数据库设计](backend/database.md)** - 表结构、设计原则
- **[权限系统](backend/permissions.md)** - 5 层权限架构、DataScope
- **[API 接口参考](backend/api-reference.md)** - 端点列表
- **[服务层架构](backend/services.md)** - 服务模块说明
- **[安全与认证](backend/security.md)** - CF Access Zero Trust
- **[认证架构](backend/authentication.md)** - 登录流程详解
- **[业务时区](backend/timezone.md)** - UTC+4 规范

### 业务模块
- **[财务模块](modules/finance.md)** - 现金流、账户、应收应付
- **[人力资源](modules/hr.md)** - 员工、薪资、请假
- **[资产管理](modules/assets.md)** - 固定资产、租赁
- **[站点管理](modules/sites.md)** - 站点、水电账单
- **[报表模块](modules/reports.md)** - 财务/人事报表
- **[项目管理](modules/pm.md)** - 任务看板、工时管理

### 前端开发
- **[自定义 Hooks](frontend/hooks.md)** - 60+ 业务 Hooks
- **[路由配置](frontend/router.md)** - 懒加载路由
- **[表单组件](frontend/form-components.md)** - 表单组件
- **[样式架构](frontend/styles.md)** - CSS 设计系统

### 指南与规范
- **[部署指南](guides/deploy.md)** - 生产环境部署
- **[测试指南](guides/testing.md)** - 测试运行说明
- **[开发规范](standards/development.md)** - 编码规范
- **[代码审查清单](standards/code-review.md)** - 审查要点

### 工作流
- **[部署工作流](workflows/deploy.zh.md)** | [English](workflows/deploy.en.md)
- **[开发工作流](workflows/development.zh.md)** | [English](workflows/development.en.md)
- **[测试工作流](workflows/test.zh.md)** | [English](workflows/test.en.md)

---

## 📖 其他文档

| 文档 | 位置 | 说明 |
|------|------|------|
| AI 助手配置 | [GEMINI.md](../GEMINI.md) | Antigravity 配置 |
| 前端项目 | [frontend/README.md](../frontend/README.md) | 前端开发入口 |
| 后端项目 | [backend/README.md](../backend/README.md) | 后端开发入口 |

---

**最后更新**: 2025-12-27
