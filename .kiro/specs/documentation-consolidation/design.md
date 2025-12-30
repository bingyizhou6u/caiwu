# Design Document: Documentation Consolidation

## Overview

本设计文档描述如何整理和统一系统文档，建立清晰的三层文档架构，消除重复内容，确保文档易于维护和实时更新。

### 当前问题

1. **文档分散**：文档分布在多个位置（`.kiro/steering/`、`docs/`、各项目 README、`GEMINI.md`）
2. **内容重复**：相同信息在多处重复（如技术栈、项目结构）
3. **更新不同步**：修改一处后其他位置未同步更新
4. **索引不完整**：`docs/README.md` 索引可能遗漏新增文档

### 设计目标

- 建立清晰的三层文档架构
- 消除重复内容，使用引用代替复制
- 确保索引完整且最新
- 保持 Steering 文件简洁准确

## Architecture

### 三层文档架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Steering Files (概述层)                           │
│  .kiro/steering/*.md                                        │
│  - 简洁的项目概述（<100行）                                  │
│  - AI 辅助开发的上下文                                       │
│  - 引用详细文档而非复制内容                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Index (索引层)                                    │
│  docs/README.md                                             │
│  - 完整的文档目录                                            │
│  - 分类导航                                                  │
│  - 快速链接                                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Detail (详情层)                                   │
│  docs/{category}/*.md                                       │
│  - 完整的技术文档                                            │
│  - 详细的实现说明                                            │
│  - 代码示例和配置                                            │
└─────────────────────────────────────────────────────────────┘
```

### 文档职责划分

| 文档位置 | 职责 | 目标读者 |
|---------|------|---------|
| `.kiro/steering/` | AI 上下文、项目概述 | AI 助手、新开发者 |
| `docs/README.md` | 文档索引、导航 | 所有开发者 |
| `docs/{category}/` | 详细技术文档 | 需要深入了解的开发者 |
| `backend/README.md` | 后端快速入门 | 后端开发者 |
| `frontend/README.md` | 前端快速入门 | 前端开发者 |
| `GEMINI.md` | AI 配置（简化版） | AI 助手 |

## Components and Interfaces

### 1. Steering Files 结构

```
.kiro/steering/
├── product.md      # 产品概述（业务背景、目标用户）
├── tech.md         # 技术栈概述（框架、命令）
└── structure.md    # 项目结构概述（目录布局）
```

每个文件应：
- 控制在 100 行以内
- 包含指向 `docs/` 的详细链接
- 使用简洁的表格和列表

### 2. Knowledge Base 结构

```
docs/
├── README.md              # 索引文件
├── backend/               # 后端文档
│   ├── database.md        # 数据库设计
│   ├── permissions.md     # 权限系统
│   ├── api-reference.md   # API 参考
│   ├── services.md        # 服务架构
│   ├── security.md        # 安全架构
│   ├── authentication.md  # 认证流程
│   └── timezone.md        # 时区处理
├── frontend/              # 前端文档
│   ├── hooks.md           # 自定义 Hooks
│   ├── router.md          # 路由配置
│   ├── form-components.md # 表单组件
│   ├── component-split.md # 组件拆分
│   └── styles.md          # 样式架构
├── modules/               # 业务模块文档
│   ├── finance.md         # 财务模块
│   ├── hr.md              # 人力资源
│   ├── assets.md          # 资产管理
│   ├── sites.md           # 站点管理
│   ├── reports.md         # 报表模块
│   └── pm.md              # 项目管理
├── guides/                # 指南文档
│   ├── deploy.md          # 部署指南
│   ├── testing.md         # 测试指南
│   ├── migrations.md      # 迁移指南
│   ├── env-setup.md       # 环境配置
│   └── usage.md           # 使用指南
├── architecture/          # 架构文档
│   ├── review.md          # 架构评审
│   └── api-versioning.md  # API 版本管理
├── standards/             # 规范文档
│   ├── development.md     # 开发规范
│   └── code-review.md     # 代码审查
├── security/              # 安全文档
│   ├── optimization-summary.md
│   ├── penetration-test-report.md
│   └── status-checklist.md
└── workflows/             # 工作流文档
    ├── deploy.zh.md / deploy.en.md
    ├── development.zh.md / development.en.md
    └── test.zh.md / test.en.md
```

### 3. 引用模式

使用 Markdown 链接引用详细文档，而非复制内容：

```markdown
<!-- 在 steering 文件中 -->
## 权限系统
详见 [权限系统文档](../../docs/backend/permissions.md)

<!-- 在 README 中 -->
更多信息请参考 [知识库](docs/README.md)
```

## Data Models

### 文档元数据格式

每个文档应包含标准元数据：

```markdown
# 文档标题

> **最后更新**: YYYY-MM-DD
> **相关文档**: [链接1](path1), [链接2](path2)

---

## 内容...
```

### 索引条目格式

```markdown
| 文档 | 说明 | 最后更新 |
|------|------|---------|
| [文档名](路径) | 简短描述 | YYYY-MM-DD |
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Steering 文件简洁性

*For any* steering file in `.kiro/steering/`, the file SHALL have fewer than 100 lines.

**Validates: Requirements 1.2, 4.4**

### Property 2: Steering 文件引用详情

*For any* steering file in `.kiro/steering/`, the file SHALL contain at least one reference link to `docs/` directory.

**Validates: Requirements 2.3, 4.3**

### Property 3: 索引完整性

*For any* markdown file in `docs/{category}/` directories, the file SHALL be listed in `docs/README.md` index.

**Validates: Requirements 3.1**

### Property 4: 日期格式一致性

*For any* date string in documentation files, the date SHALL follow YYYY-MM-DD format.

**Validates: Requirements 5.3**

### Property 5: README 引用模式

*For any* README file (backend/README.md, frontend/README.md), the file SHALL contain links to `docs/` directory rather than duplicating detailed content.

**Validates: Requirements 1.4, 2.4**

## Error Handling

### 文档缺失处理

- 如果索引引用的文档不存在，应标记为 `[待创建]`
- 定期检查死链接

### 更新冲突处理

- 使用 Git 版本控制追踪变更
- 文档更新时同步更新索引的"最后更新"时间

## Testing Strategy

### 文档验证脚本

创建脚本验证文档结构和一致性：

1. **结构验证**
   - 检查 steering 文件行数
   - 检查索引完整性
   - 检查链接有效性

2. **格式验证**
   - 检查日期格式
   - 检查 Markdown 语法

### 手动检查清单

- [ ] Steering 文件是否简洁（<100行）
- [ ] Steering 文件是否引用详细文档
- [ ] 索引是否包含所有文档
- [ ] README 是否使用引用而非复制
- [ ] 日期格式是否一致

