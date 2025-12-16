# AR公司财务管理系统 - 文档总索引

> **最后更新**: 2025-01-XX  
> 本文档提供项目所有重要文档的统一索引

---

## 📚 文档目录结构

```
/workspace/
├── GEMINI.md                          # AI助手配置文件（根目录）
├── DOCS_INDEX.md                      # 本文档（文档总索引）
│
├── .agent/                            # AI助手相关文档
│   ├── KNOWLEDGE_INDEX.md            # 知识索引
│   ├── RAG_IMPLEMENTATION_PLAN.md    # RAG实现方案
│   ├── workflows/                     # 工作流文档
│   └── 公共组件化分析报告.md
│
├── .qoder/repowiki/                   # 完整文档库（173个文件）
│   └── zh/content/                    # 中文文档内容
│       ├── 系统概述.md
│       ├── 快速入门.md
│       ├── 核心功能模块/
│       ├── API参考/
│       ├── 技术栈与架构/
│       ├── 认证与权限系统/
│       ├── 数据库设计/
│       ├── 开发指南/
│       └── 部署与运维/
│
├── docs/                              # 项目文档
│   ├── README.md                      # 文档索引
│   ├── CHANGELOG.md                   # 变更日志
│   ├── DEPLOYMENT.md                  # 部署指南
│   ├── ERROR_CODES.md                 # 错误码参考
│   ├── adr/                           # 架构决策记录
│   │   ├── 001-use-drizzle-orm.md
│   │   ├── 002-v2-api-response-format.md
│   │   └── 003-cloudflare-workers.md
│   └── archive/                       # 归档文档
│       ├── audit-reports/             # 审计报告归档
│       └── ...                        # 其他归档文档
│
├── frontend/src/docs/                 # 前端开发文档
│   ├── TESTING_GUIDE.md               # 测试指南
│   ├── COMPONENT_LIBRARY.md           # 组件库文档
│   ├── HOOKS_USAGE.md                 # Hooks使用指南
│   ├── CODE_SPLITTING.md              # 代码分割指南
│   ├── COMPONENT_PERFORMANCE.md       # 组件性能优化
│   ├── REACT_QUERY_OPTIMIZATION.md    # React Query优化
│   ├── REFACTORING_GUIDE.md           # 重构指南
│   └── COMPONENT_SPLIT_GUIDE.md       # 组件拆分指南
│
└── backend/                           # 后端文档
    └── README.md                      # 后端项目说明
```

---

## 🎯 快速导航

### 新手入门
1. **[系统概述](.qoder/repowiki/zh/content/系统概述.md)** - 了解系统核心目标和功能
2. **[快速入门](.qoder/repowiki/zh/content/快速入门.md)** - 开发环境搭建和启动
3. **[部署指南](docs/DEPLOYMENT.md)** - 生产环境部署步骤

### 核心文档

#### 架构与设计
- **[架构决策记录 (ADR)](docs/adr/)** - 技术选型原因和决策
- **[技术栈与架构](.qoder/repowiki/zh/content/技术栈与架构/)** - 系统架构详解
- **[数据库设计](.qoder/repowiki/zh/content/数据库设计/)** - 数据模型设计

#### 功能模块
- **[核心功能模块](.qoder/repowiki/zh/content/核心功能模块/)** - 各业务模块说明
- **[API参考](.qoder/repowiki/zh/content/API参考/)** - API接口文档
- **[认证与权限系统](.qoder/repowiki/zh/content/认证与权限系统/)** - 安全架构说明

#### 开发指南
- **[前端开发文档](frontend/src/docs/)** - 前端开发规范和最佳实践
- **[开发指南](.qoder/repowiki/zh/content/开发指南/)** - 编码规范和开发流程
- **[错误码参考](docs/ERROR_CODES.md)** - 系统错误码定义

#### 部署与运维
- **[部署与运维](.qoder/repowiki/zh/content/部署与运维/)** - 部署和运维文档
- **[部署指南](docs/DEPLOYMENT.md)** - 生产环境部署步骤

---

## 📖 文档分类

### 1. 核心配置文档
| 文档 | 路径 | 说明 |
|------|------|------|
| AI助手配置 | `GEMINI.md` | Antigravity AI助手配置 |
| 知识索引 | `.agent/KNOWLEDGE_INDEX.md` | 项目知识索引 |

### 2. 系统文档库
| 分类 | 路径 | 说明 |
|------|------|------|
| 系统概述 | `.qoder/repowiki/zh/content/系统概述.md` | 系统核心目标 |
| 快速入门 | `.qoder/repowiki/zh/content/快速入门.md` | 开发环境搭建 |
| 核心功能 | `.qoder/repowiki/zh/content/核心功能模块/` | 业务模块说明 |
| API参考 | `.qoder/repowiki/zh/content/API参考/` | API接口文档 |
| 技术架构 | `.qoder/repowiki/zh/content/技术栈与架构/` | 架构设计文档 |
| 数据库设计 | `.qoder/repowiki/zh/content/数据库设计/` | 数据模型设计 |
| 开发指南 | `.qoder/repowiki/zh/content/开发指南/` | 开发规范 |
| 部署运维 | `.qoder/repowiki/zh/content/部署与运维/` | 部署运维文档 |

### 3. 项目文档
| 文档 | 路径 | 说明 |
|------|------|------|
| 文档索引 | `docs/README.md` | 文档导航索引 |
| 变更日志 | `docs/CHANGELOG.md` | 项目变更历史 |
| 部署指南 | `docs/DEPLOYMENT.md` | 部署步骤 |
| 错误码 | `docs/ERROR_CODES.md` | 错误码定义 |
| 架构决策 | `docs/adr/` | ADR记录 |

### 4. 开发文档
| 分类 | 路径 | 说明 |
|------|------|------|
| 前端文档 | `frontend/src/docs/` | 前端开发文档 |
| 后端文档 | `backend/README.md` | 后端项目说明 |

### 5. 归档文档
| 分类 | 路径 | 说明 |
|------|------|------|
| 审计报告 | `docs/archive/audit-reports/` | 历史审计报告 |
| 业务改进 | `docs/archive/` | 历史改进建议 |

---

## 🔍 按主题查找

### 认证与权限
- [认证与权限系统](.qoder/repowiki/zh/content/认证与权限系统/)
- [RBAC权限控制](.qoder/repowiki/zh/content/认证与权限系统/RBAC权限控制系统/)
- [JWT认证系统](.qoder/repowiki/zh/content/认证与权限系统/JWT认证系统.md)
- [双因素认证(TOTP)](.qoder/repowiki/zh/content/认证与权限系统/双因素认证(TOTP)/)

### 数据库设计
- [数据库设计总览](.qoder/repowiki/zh/content/数据库设计/数据库设计.md)
- [组织架构数据模型](.qoder/repowiki/zh/content/数据库设计/组织架构数据模型/)
- [财务核心数据模型](.qoder/repowiki/zh/content/数据库设计/财务核心数据模型/)
- [资产管理数据模型](.qoder/repowiki/zh/content/数据库设计/资产管理数据模型/)

### 前端开发
- [测试指南](frontend/src/docs/TESTING_GUIDE.md)
- [组件库文档](frontend/src/docs/COMPONENT_LIBRARY.md)
- [Hooks使用指南](frontend/src/docs/HOOKS_USAGE.md)
- [性能优化](frontend/src/docs/COMPONENT_PERFORMANCE.md)
- [组件拆分指南](frontend/src/docs/COMPONENT_SPLIT_GUIDE.md)

### 后端开发
- [后端README](backend/README.md)
- [API设计](.qoder/repowiki/zh/content/技术栈与架构/后端架构/API设计/)
- [服务层架构](.qoder/repowiki/zh/content/技术栈与架构/后端架构/服务层架构/)
- [数据访问层](.qoder/repowiki/zh/content/技术栈与架构/后端架构/数据访问层/)

### 部署与运维
- [部署指南](docs/DEPLOYMENT.md)
- [后端服务部署](.qoder/repowiki/zh/content/部署与运维/后端服务部署.md)
- [前端应用部署](.qoder/repowiki/zh/content/部署与运维/前端应用部署.md)
- [数据库迁移管理](.qoder/repowiki/zh/content/部署与运维/数据库迁移管理.md)

---

## 📝 文档维护规范

### 文档分类原则
1. **核心配置** - 根目录和 `.agent/` 目录
2. **系统文档** - `.qoder/repowiki/` 目录（完整文档库）
3. **项目文档** - `docs/` 目录（项目级文档）
4. **开发文档** - `frontend/src/docs/` 和 `backend/` 目录
5. **归档文档** - `docs/archive/` 目录

### 文档更新原则
- ✅ 核心文档随代码更新及时维护
- ✅ 重大架构变更需更新 ADR
- ✅ 新增功能需更新相关开发文档
- ✅ 已完成的任务报告归档到 `archive/` 目录

### 文档格式规范
- 使用 Markdown 格式
- 代码示例使用 TypeScript/JavaScript
- 中文注释和说明
- 保持文档简洁清晰

---

## 🔗 相关链接

- [项目知识索引](.agent/KNOWLEDGE_INDEX.md)
- [文档索引](docs/README.md)
- [变更日志](docs/CHANGELOG.md)

---

**最后更新**: 2025-01-XX
