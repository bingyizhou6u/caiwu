# Product Overview

> AR公司企业财务管理系统 (Enterprise Financial Management System)
> 详细文档: [知识库索引](../../docs/README.md)

## Purpose

全栈业务管理平台，涵盖：

| 模块 | 功能 | 详情 |
|------|------|------|
| **Finance** | 现金流、账户、应收应付、费用报销 | [财务模块](../../docs/modules/finance.md) |
| **HR** | 员工管理、薪资、补贴、请假 | [人力资源](../../docs/modules/hr.md) |
| **Assets** | 固定资产、租赁、宿舍分配 | [资产管理](../../docs/modules/assets.md) |
| **Sites** | 站点管理、水电账单 | [站点管理](../../docs/modules/sites.md) |
| **PM** | 需求、任务、里程碑、工时 | [项目管理](../../docs/modules/pm.md) |
| **Reports** | 财务/人事报表仪表盘 | [报表模块](../../docs/modules/reports.md) |

## Target Users

- 财务团队（现金流、结算、预算）
- 人事团队（员工生命周期、薪资）
- 项目经理（任务看板、工时记录）
- 系统管理员（权限、配置）

## Business Context

| 特性 | 说明 |
|------|------|
| 时区 | UTC+4（迪拜时间） |
| 货币 | 多币种支持 |
| 权限 | RBAC + DataScope（all/project/group/self） |
| 认证 | Cloudflare Access Zero Trust |
| 语言 | 中文 UI，双语文档 |

详见 [权限系统](../../docs/backend/permissions.md) | [安全架构](../../docs/backend/security.md)
