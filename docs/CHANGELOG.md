# 文档整理变更日志

## 2025-01-XX - 文档整理（统一管理）

### 新增文档
- `DOCS_INDEX.md` - 文档总索引，统一管理所有重要文档
- `docs/archive/audit-reports/README.md` - 审计报告归档说明

### 文档整理

#### 归档已完成的任务报告
以下审计和状态报告已移动到 `docs/archive/audit-reports/` 目录：
- `BACKEND_REFACTOR_STATUS.md` - 后端重构完成度报告（85%完成）
- `CODE_AUDIT_COMPLETION.md` - 代码审计完成报告
- `CODE_AUDIT_REPORT.md` - 代码审计报告
- `CODE_STANDARDS_AUDIT.md` - 代码规范性检查报告
- `HIGH_PRIORITY_TESTS_COMPLETION.md` - 高优先级服务测试补充完成报告
- `TEST_COVERAGE_REPORT.md` - 测试用例完善报告
- `RBAC_AUDIT.md` - RBAC 合规性审计报告
- `NAMING_AUDIT.md` - 命名规范审计报告

#### 文档移动
- `frontend/src/features/assets/components/COMPONENT_SPLIT_GUIDE.md` → `frontend/src/docs/COMPONENT_SPLIT_GUIDE.md`

### 文档结构优化

#### 核心文档（保留）
- `GEMINI.md` - AI 助手配置文档（根目录）
- `.agent/` - AI助手相关文档（知识索引、工作流、RAG计划）
- `.qoder/repowiki/` - 完整文档库（173个文件）
- `docs/adr/` - 架构决策记录（3个文件）
- `docs/DEPLOYMENT.md` - 部署指南
- `docs/ERROR_CODES.md` - 错误码参考
- `docs/CHANGELOG.md` - 变更日志
- `frontend/src/docs/` - 前端开发文档（8个文件）

#### 归档文档结构
```
docs/archive/
├── audit-reports/          # 审计报告归档
│   ├── README.md
│   └── [8个审计报告文件]
└── [其他归档文档]
```

### 文档索引更新
- 更新 `docs/README.md`，移除已归档文档的引用
- 创建 `DOCS_INDEX.md` 作为文档总索引

### 文档分类原则
1. **核心配置** - 根目录和 `.agent/` 目录
2. **系统文档** - `.qoder/repowiki/` 目录（完整文档库）
3. **项目文档** - `docs/` 目录（项目级文档）
4. **开发文档** - `frontend/src/docs/` 和 `backend/` 目录
5. **归档文档** - `docs/archive/` 目录

### 文档维护规范
- ✅ 核心文档随代码更新及时维护
- ✅ 重大架构变更需更新 ADR
- ✅ 新增功能需更新相关开发文档
- ✅ 已完成的任务报告归档到 `archive/` 目录

---

## 文档组织原则

1. **核心文档** - 放在 `docs/` 根目录
2. **开发文档** - 放在对应的 `frontend/src/docs/` 或 `backend/` 目录
3. **归档文档** - 放在 `docs/archive/` 目录
4. **临时文件** - 及时删除

