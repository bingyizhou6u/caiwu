# Design Document: Frontend Style Standardization

## Overview

本设计文档描述前端样式规范化的技术方案，包括内联样式迁移策略、颜色变量统一方案、重复样式清理计划，以及样式编写规范文档的结构。

## Architecture

### 样式系统分层架构（现有）

```
frontend/src/
├── index.css                    # 入口文件，按顺序导入所有样式
├── config/theme.ts              # Ant Design 主题配置
└── styles/
    ├── base/                    # 基础层：变量、重置、排版
    │   ├── variables.css        # CSS 变量（设计令牌）
    │   ├── reset.css
    │   ├── typography.css
    │   └── scrollbar.css
    ├── components/              # 组件层：Ant Design 覆盖样式
    │   ├── antd-overrides.css
    │   ├── button.css
    │   ├── card.css
    │   ├── form.css
    │   ├── table.css
    │   ├── modal.css
    │   ├── dark-mode.css
    │   └── other.css
    ├── layouts/                 # 布局层
    │   ├── main-layout.css
    │   ├── sidebar.css
    │   ├── header.css
    │   ├── content.css
    │   ├── page-container.css
    │   └── multi-tabs.css
    ├── features/                # 功能模块层
    │   ├── employees/
    │   └── auth/
    └── utilities/               # 工具层
        ├── animations.css
        ├── transitions.css
        ├── layout.css
        ├── states.css
        ├── responsive.css
        └── accessibility.css
```

### 改进方案

1. **新增通用工具类** - 在 `utilities/` 下新增常用样式类
2. **清理重复定义** - 合并 NProgress 样式到 `antd-overrides.css`
3. **修复布局导入** - 确保 `main-layout.css` 正确导入子文件
4. **创建 steering 文件** - 在 `.kiro/steering/` 下创建样式规范文档

## Components and Interfaces

### 新增工具类（utilities/common.css）

```css
/* 布局工具类 */
.flex-center {
    display: flex;
    justify-content: center;
    align-items: center;
}

.flex-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.inline-flex-center {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
}

/* 宽度工具类 */
.w-full { width: 100%; }
.w-half { width: 50%; }

/* 间距工具类 */
.mt-sm { margin-top: var(--spacing-sm); }
.mt-md { margin-top: var(--spacing-md); }
.mb-sm { margin-bottom: var(--spacing-sm); }
.mb-md { margin-bottom: var(--spacing-md); }

/* 交互工具类 */
.cursor-pointer { cursor: pointer; }

/* 文本工具类 */
.text-muted { color: var(--color-text-tertiary); }
.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.text-primary { color: var(--color-primary); }
.font-bold { font-weight: var(--font-weight-bold); }
```

### 内联样式迁移映射

| 原内联样式 | 迁移目标 |
|-----------|---------|
| `style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}` | `.flex-center` |
| `style={{ width: '100%' }}` | `.w-full` |
| `style={{ cursor: 'pointer' }}` | `.cursor-pointer` |
| `style={{ color: '#999' }}` | `.text-muted` |
| `style={{ color: '#52c41a' }}` | `.text-success` |
| `style={{ color: '#ff4d4f' }}` | `.text-error` |
| `style={{ marginLeft: collapsed ? 80 : 240 }}` | 保留（动态计算值） |

## Data Models

### 颜色变量映射表

| 硬编码值 | CSS 变量 | 用途 |
|---------|---------|------|
| `#6366f1` | `var(--color-primary)` | 主色 |
| `#818cf8` | `var(--color-primary-hover)` | 主色悬停 |
| `#999`, `#94a3b8` | `var(--color-text-tertiary)` | 次要文本 |
| `#52c41a` | `var(--color-success)` | 成功/收入 |
| `#ff4d4f` | `var(--color-error)` | 错误/支出 |
| `#1890ff` | `var(--color-info)` | 信息/链接 |
| `#f5f5f5` | `var(--color-bg-hover)` | 悬停背景 |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CSS 文件不包含硬编码颜色值

*For any* CSS 文件（排除 `variables.css`），文件内容不应包含硬编码的十六进制颜色值（如 `#6366f1`），所有颜色应使用 `var(--color-*)` 变量。

**Validates: Requirements 2.1**

## Error Handling

### 迁移风险控制

1. **渐进式迁移** - 按组件逐个迁移，每次迁移后验证功能
2. **保留动态样式** - 真正需要动态计算的值（如 `marginLeft: collapsed ? 80 : 240`）保留内联
3. **测试覆盖** - 迁移后运行现有测试确保无回归

### 兼容性考虑

1. **组件 API 兼容** - 保留 `style` prop 支持，允许外部覆盖
2. **暗色模式兼容** - 使用 CSS 变量确保主题切换正常
3. **Ant Design 兼容** - 使用 Ant Design token 系统获取动态颜色

## Testing Strategy

### 单元测试

- 验证组件渲染后应用了正确的 CSS 类名
- 验证 `style` prop 仍可正常传递和应用

### 手动测试

- 验证亮色/暗色主题切换正常
- 验证响应式布局正常
- 验证所有页面视觉效果无变化

### 静态检查

- 使用 grep 检查 CSS 文件中的硬编码颜色值
- 使用 ESLint 规则检查 TSX 中的内联样式使用
