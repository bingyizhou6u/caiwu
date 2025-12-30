# Implementation Plan: Frontend Style Standardization

## Overview

本计划将前端样式规范化工作分解为可执行的任务，按优先级从基础设施到具体迁移逐步实施。

## Tasks

- [x] 1. 创建通用工具类文件
  - [x] 1.1 创建 `frontend/src/styles/utilities/common.css`
    - 添加布局工具类（flex-center, flex-between, inline-flex-center）
    - 添加宽度工具类（w-full, w-half）
    - 添加间距工具类（mt-sm, mt-md, mb-sm, mb-md）
    - 添加交互工具类（cursor-pointer）
    - 添加文本颜色工具类（text-muted, text-success, text-error, text-primary, font-bold）
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 在 `index.css` 中导入 `common.css`
    - _Requirements: 1.1_

- [x] 2. 清理重复样式定义
  - [x] 2.1 合并 NProgress 样式到 `antd-overrides.css`
    - 将 `index.css` 中的 NProgress 样式移动到 `antd-overrides.css`
    - 使用 CSS 变量替代硬编码颜色值
    - 删除 `index.css` 中的重复定义
    - _Requirements: 2.3, 3.1_
  - [x] 2.2 修复 `main-layout.css` 导入
    - 确认 sidebar.css, header.css, content.css 已正确导入
    - _Requirements: 3.2_

- [x] 3. 统一 CSS 文件中的颜色值
  - [x] 3.1 替换 `index.css` 中的硬编码颜色
    - 将 `#6366f1` 替换为 `var(--color-primary)`
    - 将 `#818cf8` 替换为 `var(--color-primary-hover)`
    - _Requirements: 2.1_
  - [x] 3.2 检查并替换其他 CSS 文件中的硬编码颜色
    - 检查 `card.css` 中的 `#e8e8e8` 和 `#ffffff`
    - 检查 `table.css` 中的颜色值
    - _Requirements: 2.1_

- [x] 4. Checkpoint - 验证基础设施
  - 确保所有 CSS 文件无语法错误
  - 验证亮色/暗色主题切换正常
  - 确保无视觉回归

- [x] 5. 迁移核心组件内联样式
  - [x] 5.1 迁移 `router/index.tsx` 中的 Loading 组件
    - 将 `style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}` 替换为 `.loading-container`
    - _Requirements: 1.4_
  - [x] 5.2 迁移 `ErrorBoundary.tsx` 中的内联样式
    - 创建 `.error-details`, `.error-details-summary`, `.error-details-content`, `.error-stack` 等工具类
    - _Requirements: 1.4_
  - [x] 5.3 迁移 `PageContainer.tsx` 中的内联样式
    - 将 `cursor: pointer` 替换为 `.cursor-pointer`
    - _Requirements: 1.4_
  - [x] 5.4 迁移 `SensitiveField.tsx` 中的内联样式
    - 将 `color: '#999'` 替换为 `.text-muted`
    - 将 `display: 'inline-flex'` 替换为 `.inline-flex-center`
    - _Requirements: 1.4_

- [x] 6. 迁移布局组件内联样式
  - [x] 6.1 审查 `MainLayout.tsx` 中的内联样式
    - 动态计算的 `marginLeft` 保留为内联样式（合理用法）
    - _Requirements: 1.3, 1.4_
  - [x] 6.2 迁移 `HeaderClock.tsx` 中的内联样式
    - 将 `cursor: pointer` 替换为 `.cursor-pointer`
    - _Requirements: 1.4_

- [x] 7. 迁移表单组件内联样式
  - [x] 7.1 审查 `SearchFilters.tsx` 中的内联样式
    - `width: '100%'` 为 Ant Design 推荐做法，保留不迁移
    - _Requirements: 1.4_

- [x] 8. 迁移报表页面内联样式
  - [x] 8.1 审查 `ReportAccountBalancePage.tsx` 中的颜色内联样式
    - 动态颜色样式（基于数值条件渲染）为合理用法，保留不迁移
    - _Requirements: 1.4, 2.2_

- [ ] 9. Checkpoint - 验证组件迁移
  - 运行现有测试确保无回归
  - 手动检查关键页面视觉效果

- [x] 10. 创建样式编写规范文档
  - [x] 10.1 创建 `.kiro/steering/frontend-styles.md`
    - 说明样式分层架构
    - 说明何时使用 CSS 类、CSS Modules、内联样式
    - 列出禁止的模式（硬编码颜色、过度使用内联样式）
    - 提供常见场景的代码示例
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 11. Final Checkpoint
  - 确保所有测试通过
  - 验证文档完整性
  - 确认无硬编码颜色值残留

## Notes

- 动态计算的样式值（如 `marginLeft: collapsed ? 80 : 240`）保留内联是合理的
- 组件的 `style` prop 应保留，允许外部覆盖
- 迁移过程中保持向后兼容，避免破坏现有功能
- 测试文件中的内联样式（用于测试 style prop）无需迁移
