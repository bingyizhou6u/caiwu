# Implementation Plan: Apple Style Redesign

## Overview

本计划将 Apple 风格 UI 重新设计分解为可执行的任务，按优先级从基础变量到具体组件逐步实施。

## Tasks

- [x] 1. 重构 CSS 变量系统
  - [x] 1.1 更新 `variables.css` 配色系统
    - 添加 Apple 系统色变量（--apple-blue, --apple-green 等）
    - 更新语义化颜色变量（--color-primary 改为 Apple Blue）
    - 更新背景色变量（亮色/暗色主题）
    - 更新文字色变量
    - 更新分隔线/边框变量
    - 添加毛玻璃效果变量（--glass-bg, --glass-blur）
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 1.2 更新 `variables.css` 字体系统
    - 更新字体栈为 SF Pro 风格
    - 更新字体大小变量
    - 更新字重变量
    - 更新行高和字间距变量
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 1.3 更新 `variables.css` 间距系统
    - 更新为 4px 基准间距
    - 更新圆角变量（更大圆角）
    - _Requirements: 3.1_
  - [x] 1.4 更新 `variables.css` 动效系统
    - 添加过渡时间变量
    - 添加缓动函数变量
    - 更新阴影变量（更柔和）
    - _Requirements: 7.1, 7.2_

- [x] 2. 重构排版系统
  - [x] 2.1 更新 `typography.css` 排版样式
    - 更新标题样式（h1-h6）
    - 更新段落样式
    - 更新列表样式
    - 增加行高和字间距
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 更新页面内容区排版
    - 增加内容区留白
    - 优化信息密度
    - 调整组件间距
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 3. Checkpoint - 验证变量和排版系统
  - 确保所有 CSS 变量定义正确
  - 验证排版效果
  - 验证亮色/暗色主题切换正常
  - 确保无语法错误

- [x] 4. 重构布局组件样式
  - [x] 4.1 重构 `sidebar.css` 侧边栏样式
    - 移除复杂渐变，使用简约背景色
    - 添加可选毛玻璃效果
    - 重新设计 Logo 区域
    - 重新设计菜单项样式（hover/选中效果）
    - 简化选中指示器（左侧小竖条）
    - 更新折叠/展开动画
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.2 重构 `header.css` 导航栏样式
    - 添加毛玻璃效果
    - 调整高度为 52px
    - 重新设计按钮样式
    - 简化用户下拉菜单
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 4.3 重构 `multi-tabs.css` 多标签页样式
    - 简化标签页样式
    - 重新设计选中指示器
    - 更新 hover 效果
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 5. Checkpoint - 验证布局组件
  - 验证侧边栏折叠/展开正常
  - 验证导航栏毛玻璃效果
  - 验证多标签页功能正常

- [x] 6. 重构通用组件样式
  - [x] 6.1 重构 `button.css` 按钮样式
    - 更新圆角和内边距
    - 更新主按钮颜色
    - 添加 hover/active 微动效
    - _Requirements: 6.1, 7.3_
  - [x] 6.2 重构 `card.css` 卡片样式
    - 更新圆角和阴影
    - 更新边框样式
    - 更新标题和内容区样式
    - _Requirements: 6.2_
  - [x] 6.3 重构 `table.css` 表格样式
    - 更新表头样式
    - 更新行高和内边距
    - 更新 hover 效果
    - _Requirements: 6.3_
  - [x] 6.4 重构 `form.css` 表单样式
    - 更新输入框样式
    - 更新选择器样式
    - 更新开关样式
    - _Requirements: 6.4_
  - [x] 6.5 重构 `modal.css` 弹窗样式
    - 更新圆角和阴影
    - 更新标题和内容区样式
    - 添加打开/关闭动画
    - _Requirements: 6.5_

- [x] 7. Checkpoint - 验证通用组件
  - 验证所有组件视觉效果
  - 验证亮色/暗色主题下的表现

- [x] 8. 重构 Ant Design 覆盖样式
  - [x] 8.1 更新 `antd-overrides.css`
    - 统一覆盖 Ant Design 默认样式
    - 确保与 Apple 风格一致
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 8.2 更新 `dark-mode.css`
    - 确保暗色模式下所有组件样式正确
    - _Requirements: 1.3_

- [x] 9. 更新 theme.ts 配置
  - [x] 9.1 更新 Ant Design 主题配置
    - 更新 colorPrimary 为 Apple Blue
    - 更新 borderRadius
    - 更新 fontFamily
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 10. 清理和优化
  - [x] 10.1 移除旧的硬编码颜色值
    - 检查所有 CSS 文件
    - 替换为 CSS 变量
    - _Requirements: 1.5_
  - [x] 10.2 更新 steering 文档
    - 更新 `frontend-styles.md` 中的颜色变量表
    - 添加 Apple 风格设计指南
    - _Requirements: 文档更新_

- [x] 11. Final Checkpoint
  - 确保所有测试通过
  - 验证亮色/暗色主题切换
  - 验证所有页面视觉效果
  - 确认无硬编码颜色值残留

## Notes

- 渐进式迁移，每个任务完成后验证
- 不需要保持向后兼容，可以大胆重构
- 优先更新变量系统，再更新具体组件
- 毛玻璃效果需要考虑浏览器兼容性（提供 fallback）
- 动效保持克制，避免过度动画
