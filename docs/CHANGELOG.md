# 文档整理变更日志

## 2025-01-XX - 文档整理

### 新增文档
- `docs/README.md` - 文档索引，统一管理所有文档
- `docs/RBAC_AUDIT.md` - RBAC 合规性审计报告（从根目录移动）
- `docs/NAMING_AUDIT.md` - API 命名规范审计报告（从根目录移动）
- `docs/archive/README.md` - 归档文档说明

### 归档文档
以下文档已移动到 `docs/archive/` 目录：
- `FRONTEND_REFACTOR_NEXT_STEPS.md` - 前端重构后续任务清单（已完成）
- `FRONTEND_REFACTOR_AUDIT.md` - 前端重构完成质量评估报告（已完成）
- `CODE_OPTIMIZATION_PLAN.md` - 代码精简优化方案（部分已完成）
- `BUSINESS_IMPROVEMENTS.md` - 业务功能改进建议（部分已完成）
- `PROJECT_RECOMMENDATIONS.md` - 项目改进建议（部分已完成）

### 删除文件
- `projects.txt` - 临时文件（wrangler 输出）
- `MESSAGE_DRAFT.md` - 已重命名为 `RBAC_AUDIT.md` 并移动到 docs 目录

### 保留文件
- `GEMINI.md` - AI 助手配置文档（保留在根目录）
- `backend/README.md` - 后端项目说明
- `frontend/README.md` - 前端项目说明
- `frontend/src/docs/` - 前端开发文档
- `docs/adr/` - 架构决策记录
- `docs/DEPLOYMENT.md` - 部署指南
- `docs/ERROR_CODES.md` - 错误码参考

### 文档结构优化
1. 统一文档目录结构
2. 创建文档索引便于查找
3. 归档过时文档保留历史记录
4. 删除临时和无用文件

---

## 文档组织原则

1. **核心文档** - 放在 `docs/` 根目录
2. **开发文档** - 放在对应的 `frontend/src/docs/` 或 `backend/` 目录
3. **归档文档** - 放在 `docs/archive/` 目录
4. **临时文件** - 及时删除




