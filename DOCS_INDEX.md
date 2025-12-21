# AR公司财务管理系统 - 文档总索引

> **最后更新**: 2025-12-21  
> 本文档提供项目所有重要文档的统一索引

---

## 📚 文档目录结构

```
/caiwu-main/
├── GEMINI.md                          # AI助手配置文件（根目录）
├── DOCS_INDEX.md                      # 本文档（文档总索引）
├── DEPLOY.md                          # 部署指南
├── TESTING.md                         # 测试指南
│
├── .agent/                            # AI助手相关文档
│   ├── KNOWLEDGE_INDEX.md             # 知识索引
│   └── workflows/                     # 工作流文档
│
├── .qoder/repowiki/zh/content/        # 完整文档库
│   ├── 系统概述.md
│   ├── 快速入门指南.md
│   ├── 技术栈与架构.md
│   ├── 贡献指南.md
│   ├── 核心功能模块/
│   ├── API参考/
│   ├── 数据库设计/
│   ├── 安全与认证/
│   ├── 前端架构/
│   ├── 后端架构/
│   ├── 测试策略/
│   └── 部署指南/
│
├── docs/                              # 项目文档
│   ├── README.md                      # 文档索引
│   ├── ARCHITECTURE_REVIEW.md         # 架构评审报告
│   ├── API_VERSIONING.md              # API版本管理
│   ├── CODE_REVIEW_CHECKLIST.md       # 代码审查清单
│   ├── DEVELOPMENT_STANDARDS.md       # 开发规范
│   └── USAGE_GUIDE.md                 # 使用指南
│
├── frontend/                          # 前端
│   ├── README.md                      # 前端项目说明
│   ├── STYLE_ANALYSIS.md              # 样式分析报告
│   └── src/docs/
│       └── COMPONENT_SPLIT_GUIDE.md   # 组件拆分指南
│
└── backend/                           # 后端
    ├── README.md                      # 后端项目说明
    └── ENV_SETUP_CHECKLIST.md         # 环境配置清单
```

---

## 🎯 快速导航

### 新手入门
1. **[系统概述](.qoder/repowiki/zh/content/系统概述.md)** - 了解系统核心目标和功能
2. **[快速入门指南](.qoder/repowiki/zh/content/快速入门指南.md)** - 开发环境搭建和启动
3. **[部署指南](DEPLOY.md)** - 生产环境部署步骤

### 核心文档

#### 架构与设计
- **[架构评审报告](docs/ARCHITECTURE_REVIEW.md)** - 系统架构分析和评分
- **[技术栈与架构](.qoder/repowiki/zh/content/技术栈与架构.md)** - 系统架构详解
- **[数据库设计](.qoder/repowiki/zh/content/数据库设计/)** - 数据模型设计

#### 功能模块
- **[核心功能模块](.qoder/repowiki/zh/content/核心功能模块/)** - 各业务模块说明
- **[API参考](.qoder/repowiki/zh/content/API参考/)** - API接口文档
- **[安全与认证](.qoder/repowiki/zh/content/安全与认证/)** - 安全架构说明

#### 开发指南
- **[开发规范](docs/DEVELOPMENT_STANDARDS.md)** - 编码规范和开发流程
- **[前端 README](frontend/README.md)** - 前端开发说明
- **[后端 README](backend/README.md)** - 后端开发说明
- **[测试指南](TESTING.md)** - 测试运行说明

---

## 📖 文档分类

### 核心配置文档
| 文档 | 路径 | 说明 |
|------|------|------|
| AI助手配置 | `GEMINI.md` | Antigravity AI助手配置 |
| 知识索引 | `.agent/KNOWLEDGE_INDEX.md` | 项目知识索引 |

### 系统文档库
| 分类 | 路径 | 说明 |
|------|------|------|
| 系统概述 | `.qoder/repowiki/zh/content/系统概述.md` | 系统核心目标 |
| 快速入门 | `.qoder/repowiki/zh/content/快速入门指南.md` | 开发环境搭建 |
| 核心功能 | `.qoder/repowiki/zh/content/核心功能模块/` | 业务模块说明 |
| API参考 | `.qoder/repowiki/zh/content/API参考/` | API接口文档 |
| 技术架构 | `.qoder/repowiki/zh/content/技术栈与架构.md` | 架构设计文档 |
| 数据库设计 | `.qoder/repowiki/zh/content/数据库设计/` | 数据模型设计 |

### 项目文档
| 文档 | 路径 | 说明 |
|------|------|------|
| 文档索引 | `docs/README.md` | 文档导航索引 |
| 架构评审 | `docs/ARCHITECTURE_REVIEW.md` | 架构评审报告 |
| 开发规范 | `docs/DEVELOPMENT_STANDARDS.md` | 开发规范 |
| API版本 | `docs/API_VERSIONING.md` | API版本管理 |
| 代码审查 | `docs/CODE_REVIEW_CHECKLIST.md` | 代码审查清单 |

### 开发文档
| 分类 | 路径 | 说明 |
|------|------|------|
| 前端文档 | `frontend/README.md` | 前端项目说明 |
| 后端文档 | `backend/README.md` | 后端项目说明 |
| 环境配置 | `backend/ENV_SETUP_CHECKLIST.md` | 环境配置指南 |
| 组件拆分 | `frontend/src/docs/COMPONENT_SPLIT_GUIDE.md` | 组件拆分指南 |

---

## 📝 文档维护规范

### 文档分类原则
1. **核心配置** - 根目录和 `.agent/` 目录
2. **系统文档** - `.qoder/repowiki/` 目录（完整文档库）
3. **项目文档** - `docs/` 目录（项目级文档）
4. **开发文档** - `frontend/` 和 `backend/` 目录

### 文档更新原则
- ✅ 核心文档随代码更新及时维护
- ✅ 重大架构变更需更新相关文档
- ✅ 新增功能需更新相关开发文档
- ❌ 不保留临时任务进度记录文档

---

**最后更新**: 2025-12-21
