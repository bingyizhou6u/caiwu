# Requirements Document

## Introduction

本规范旨在统一前端样式代码，消除内联样式、硬编码颜色值和重复定义，确保样式系统的一致性和可维护性。

## Glossary

- **Style_System**: 前端样式系统，包括 CSS 变量、组件样式、工具类等
- **Design_Token**: 设计令牌，定义在 `variables.css` 中的 CSS 变量
- **Inline_Style**: React 组件中使用 `style={{...}}` 的内联样式
- **Hardcoded_Color**: 直接写在代码中的颜色值（如 `#6366f1`），而非使用 CSS 变量
- **CSS_Module**: 使用 `.module.css` 后缀的模块化 CSS 文件

## Requirements

### Requirement 1: 消除内联样式

**User Story:** As a 前端开发者, I want 组件样式统一管理, so that 代码更易维护和主题切换更可靠。

#### Acceptance Criteria

1. WHEN 组件需要样式时, THE Style_System SHALL 优先使用 CSS 类名或 CSS Modules
2. WHEN 样式需要动态计算时, THE Style_System SHALL 使用 CSS 变量配合 className 切换
3. IF 必须使用内联样式, THEN THE Style_System SHALL 仅限于真正动态的值（如计算的宽度、位置）
4. THE Style_System SHALL 将现有内联样式迁移到对应的 CSS 文件中

### Requirement 2: 统一颜色值使用

**User Story:** As a 前端开发者, I want 所有颜色值使用 CSS 变量, so that 主题切换和品牌色调整更简单。

#### Acceptance Criteria

1. THE Style_System SHALL 在 CSS 文件中使用 `var(--color-*)` 替代硬编码颜色值
2. WHEN TypeScript 组件需要颜色值时, THE Style_System SHALL 通过 CSS 类名或 Ant Design token 获取
3. THE Style_System SHALL 移除 `index.css` 和 `antd-overrides.css` 中的重复 NProgress 样式
4. IF 需要新增颜色, THEN THE Style_System SHALL 先在 `variables.css` 中定义变量

### Requirement 3: 清理重复样式定义

**User Story:** As a 前端开发者, I want 样式定义唯一, so that 修改时不会遗漏或产生冲突。

#### Acceptance Criteria

1. THE Style_System SHALL 合并 `antd-overrides.css` 中的 NProgress 样式到统一位置
2. THE Style_System SHALL 确保 `main-layout.css` 正确导入所有布局子文件
3. WHEN 发现重复样式时, THE Style_System SHALL 保留一处并删除其他重复定义

### Requirement 4: 建立样式编写规范文档

**User Story:** As a 团队成员, I want 有明确的样式编写规范, so that 新代码遵循统一标准。

#### Acceptance Criteria

1. THE Style_System SHALL 提供样式编写规范文档（steering 文件）
2. THE Style_System SHALL 在规范中说明何时使用 CSS 类、CSS Modules、内联样式
3. THE Style_System SHALL 在规范中列出禁止的模式（如硬编码颜色）
4. THE Style_System SHALL 提供常见场景的代码示例
