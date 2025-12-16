# 代码规范优化文档索引

**创建时间**: 2025-01-27  
**用途**: 快速查找优化相关文档

---

## 📚 文档分类

### 🎯 核心计划文档

#### 1. [优化计划总览](./OPTIMIZATION_PLAN_SUMMARY.md) ⭐⭐⭐⭐⭐
**用途**: 快速了解整个优化计划  
**内容**: 目标、时间表、工具、流程概览

#### 2. [优化计划](./OPTIMIZATION_PLAN.md) ⭐⭐⭐⭐⭐
**用途**: 详细的优化计划和时间表  
**内容**: 
- 优化目标和策略
- 3周详细时间表
- 修复方法说明
- 验收标准

#### 3. [执行计划](./OPTIMIZATION_EXECUTION_PLAN.md) ⭐⭐⭐⭐⭐
**用途**: 每日执行任务和步骤  
**内容**:
- 每日任务清单
- 修复步骤
- 每日检查清单
- 进度跟踪方法

#### 4. [模块修复清单](./MODULE_FIX_CHECKLIST.md) ⭐⭐⭐⭐⭐
**用途**: 按模块的详细修复清单  
**内容**:
- 每个文件的具体修复位置
- 查询名称规范
- 优先级标注
- 工作量估算

---

### 🛠️ 工具和模板

#### 5. [修复模板](./FIX_TEMPLATES.md) ⭐⭐⭐⭐
**用途**: 标准化的修复代码模板  
**内容**:
- 各种场景的修复示例
- 单个查询修复模板
- 批量查询修复模板
- 事务查询修复模板
- 命名规范

#### 6. [快速参考](./QUICK_REFERENCE.md) ⭐⭐⭐⭐
**用途**: 快速查找常用修复方法  
**内容**:
- 快速修复示例
- 常用工具使用
- 检查命令

#### 7. [使用指南](./USAGE_GUIDE.md) ⭐⭐⭐⭐
**用途**: 工具使用详细说明  
**内容**:
- KV 缓存使用
- 批量查询使用
- 性能监控使用
- 最佳实践

---

### 📊 检查和报告

#### 8. [代码规范检查报告](./CODE_STANDARDS_AUDIT.md) ⭐⭐⭐⭐
**用途**: 详细的代码检查结果  
**内容**:
- 所有不符合规范的文件
- 具体问题位置
- 修复建议

#### 9. [检查总结](./CODE_STANDARDS_AUDIT_SUMMARY.md) ⭐⭐⭐
**用途**: 快速了解检查结果  
**内容**:
- 符合率统计
- 主要问题
- 修复优先级

#### 10. [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md) ⭐⭐⭐⭐
**用途**: 代码审查时使用  
**内容**:
- 数据库查询检查
- 缓存使用检查
- 服务组织检查
- 错误处理检查

---

### 📖 规范文档

#### 11. [开发规范](./DEVELOPMENT_STANDARDS.md) ⭐⭐⭐⭐⭐
**用途**: 完整的开发规范  
**内容**:
- 核心原则
- 数据库查询规范
- 缓存使用规范
- 服务层组织规范
- 禁止事项

#### 12. [规范总结](./STANDARDS_SUMMARY.md) ⭐⭐⭐⭐
**用途**: 规范建立总结  
**内容**:
- 已建立的规范
- 核心规范要点
- 使用建议

---

### 📈 优化总结

#### 13. [优化完成总结](./OPTIMIZATION_COMPLETE.md) ⭐⭐⭐⭐
**用途**: 整体优化总结  
**内容**:
- 优化成果
- 性能提升
- 代码质量提升

#### 14. [优化实施总结](./OPTIMIZATION_IMPLEMENTATION.md) ⭐⭐⭐⭐
**用途**: 优化实施情况  
**内容**:
- 已实施的优化
- 代码变更清单
- 使用建议

---

## 🎯 使用场景导航

### 场景1：开始优化工作

1. 阅读 [优化计划总览](./OPTIMIZATION_PLAN_SUMMARY.md)
2. 查看 [模块修复清单](./MODULE_FIX_CHECKLIST.md)
3. 参考 [修复模板](./FIX_TEMPLATES.md)
4. 使用 [快速参考](./QUICK_REFERENCE.md)

### 场景2：修复具体文件

1. 查看 [模块修复清单](./MODULE_FIX_CHECKLIST.md) 找到具体位置
2. 参考 [修复模板](./FIX_TEMPLATES.md) 使用对应模板
3. 使用 [快速参考](./QUICK_REFERENCE.md) 快速查找方法

### 场景3：代码审查

1. 使用 [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md)
2. 参考 [开发规范](./DEVELOPMENT_STANDARDS.md)
3. 运行检查脚本：`npm run check:standards`

### 场景4：了解规范

1. 阅读 [开发规范](./DEVELOPMENT_STANDARDS.md)
2. 查看 [规范总结](./STANDARDS_SUMMARY.md)
3. 参考 [使用指南](./USAGE_GUIDE.md)

---

## 🛠️ 工具和脚本

### 查询辅助工具

**文件**: `backend/src/utils/query-helpers.ts`  
**文档**: [使用指南](./USAGE_GUIDE.md)

### 检查脚本

**文件**: `scripts/check-standards.ts`  
**命令**: `npm run check:standards`  
**用途**: 检查代码是否符合规范

---

## 📋 快速链接

### 开始优化
- [优化计划总览](./OPTIMIZATION_PLAN_SUMMARY.md)
- [执行计划](./OPTIMIZATION_EXECUTION_PLAN.md)
- [模块修复清单](./MODULE_FIX_CHECKLIST.md)

### 修复代码
- [修复模板](./FIX_TEMPLATES.md)
- [快速参考](./QUICK_REFERENCE.md)
- [使用指南](./USAGE_GUIDE.md)

### 了解规范
- [开发规范](./DEVELOPMENT_STANDARDS.md)
- [规范总结](./STANDARDS_SUMMARY.md)
- [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md)

### 检查结果
- [代码规范检查报告](./CODE_STANDARDS_AUDIT.md)
- [检查总结](./CODE_STANDARDS_AUDIT_SUMMARY.md)

---

**最后更新**: 2025-01-27
