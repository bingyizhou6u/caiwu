# Design Document: Apple Style Redesign

## Overview

本设计文档定义 Apple 风格极简主义 UI 重新设计的技术方案，包括配色系统、字体系统、间距系统、组件样式和动效系统。

## Architecture

### 设计系统文件结构

```
frontend/src/styles/
├── base/
│   ├── variables.css        # 重构：Apple 风格 CSS 变量
│   ├── reset.css            # 保持
│   ├── typography.css       # 重构：Apple 字体系统
│   └── scrollbar.css        # 重构：简约滚动条
├── components/
│   ├── antd-overrides.css   # 重构：Apple 风格覆盖
│   ├── button.css           # 重构
│   ├── card.css             # 重构
│   ├── form.css             # 重构
│   ├── table.css            # 重构
│   ├── modal.css            # 重构
│   └── dark-mode.css        # 重构
├── layouts/
│   ├── sidebar.css          # 重构：Apple 风格侧边栏
│   ├── header.css           # 重构：Apple 风格导航栏
│   ├── multi-tabs.css       # 重构：Apple 风格标签页
│   └── ...
└── utilities/
    └── ...                  # 保持
```

## Components and Interfaces

### 1. 配色系统 (variables.css)

#### Apple 系统色定义

```css
:root {
    /* ========== Apple System Colors (Light) ========== */
    --apple-blue: #007AFF;
    --apple-green: #34C759;
    --apple-indigo: #5856D6;
    --apple-orange: #FF9500;
    --apple-pink: #FF2D55;
    --apple-purple: #AF52DE;
    --apple-red: #FF3B30;
    --apple-teal: #5AC8FA;
    --apple-yellow: #FFCC00;
    
    /* ========== 语义化颜色 (Light Theme) ========== */
    --color-primary: var(--apple-blue);
    --color-primary-hover: #0066CC;
    --color-success: var(--apple-green);
    --color-warning: var(--apple-orange);
    --color-error: var(--apple-red);
    --color-info: var(--apple-teal);
    
    /* ========== 背景色 (Light Theme) ========== */
    --color-bg-base: #FFFFFF;
    --color-bg-secondary: #F2F2F7;
    --color-bg-tertiary: #E5E5EA;
    --color-bg-elevated: #FFFFFF;
    --color-bg-grouped: #F2F2F7;
    
    /* ========== 文字色 (Light Theme) ========== */
    --color-text-primary: #000000;
    --color-text-secondary: #3C3C43;
    --color-text-tertiary: #8E8E93;
    --color-text-quaternary: #C7C7CC;
    --color-text-placeholder: #C7C7CC;
    
    /* ========== 分隔线/边框 (Light Theme) ========== */
    --color-separator: rgba(60, 60, 67, 0.12);
    --color-separator-opaque: #C6C6C8;
    --color-border: rgba(60, 60, 67, 0.12);
    
    /* ========== 填充色 (Light Theme) ========== */
    --color-fill-primary: rgba(120, 120, 128, 0.2);
    --color-fill-secondary: rgba(120, 120, 128, 0.16);
    --color-fill-tertiary: rgba(118, 118, 128, 0.12);
    
    /* ========== 毛玻璃效果 ========== */
    --glass-bg: rgba(255, 255, 255, 0.72);
    --glass-blur: 20px;
    --glass-border: rgba(255, 255, 255, 0.18);
}

/* ========== Dark Theme ========== */
[data-theme="dark"] {
    /* Apple System Colors (Dark) - 略微调亮 */
    --apple-blue: #0A84FF;
    --apple-green: #30D158;
    --apple-indigo: #5E5CE6;
    --apple-orange: #FF9F0A;
    --apple-pink: #FF375F;
    --apple-purple: #BF5AF2;
    --apple-red: #FF453A;
    --apple-teal: #64D2FF;
    --apple-yellow: #FFD60A;
    
    /* 语义化颜色 */
    --color-primary: var(--apple-blue);
    --color-primary-hover: #409CFF;
    --color-success: var(--apple-green);
    --color-warning: var(--apple-orange);
    --color-error: var(--apple-red);
    --color-info: var(--apple-teal);
    
    /* 背景色 (Dark Theme) */
    --color-bg-base: #000000;
    --color-bg-secondary: #1C1C1E;
    --color-bg-tertiary: #2C2C2E;
    --color-bg-elevated: #1C1C1E;
    --color-bg-grouped: #1C1C1E;
    
    /* 文字色 (Dark Theme) */
    --color-text-primary: #FFFFFF;
    --color-text-secondary: #EBEBF5;
    --color-text-tertiary: #8E8E93;
    --color-text-quaternary: #636366;
    --color-text-placeholder: #636366;
    
    /* 分隔线/边框 (Dark Theme) */
    --color-separator: rgba(84, 84, 88, 0.65);
    --color-separator-opaque: #38383A;
    --color-border: rgba(84, 84, 88, 0.65);
    
    /* 填充色 (Dark Theme) */
    --color-fill-primary: rgba(120, 120, 128, 0.36);
    --color-fill-secondary: rgba(120, 120, 128, 0.32);
    --color-fill-tertiary: rgba(118, 118, 128, 0.24);
    
    /* 毛玻璃效果 */
    --glass-bg: rgba(28, 28, 30, 0.72);
    --glass-blur: 20px;
    --glass-border: rgba(255, 255, 255, 0.08);
}
```

### 2. 字体系统 (typography.css)

```css
:root {
    /* SF Pro 风格字体栈 */
    --font-family-base: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", 
                        "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif;
    --font-family-mono: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, 
                        "Cascadia Mono", "Segoe UI Mono", monospace;
    
    /* 字体大小 - Apple 风格 */
    --font-size-xs: 11px;      /* Caption 2 */
    --font-size-sm: 12px;      /* Caption 1 */
    --font-size-base: 14px;    /* Subheadline */
    --font-size-md: 15px;      /* Body */
    --font-size-lg: 17px;      /* Headline */
    --font-size-xl: 20px;      /* Title 3 */
    --font-size-2xl: 22px;     /* Title 2 */
    --font-size-3xl: 28px;     /* Title 1 */
    --font-size-4xl: 34px;     /* Large Title */
    
    /* 字重 */
    --font-weight-regular: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    
    /* 行高 */
    --line-height-tight: 1.2;
    --line-height-normal: 1.47;  /* Apple 标准 */
    --line-height-relaxed: 1.6;
    
    /* 字间距 */
    --letter-spacing-tight: -0.02em;
    --letter-spacing-normal: -0.01em;
    --letter-spacing-wide: 0.02em;
}

/* 标题样式 */
h1, .h1 {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-bold);
    line-height: var(--line-height-tight);
    letter-spacing: var(--letter-spacing-tight);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-6);
}

h2, .h2 {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    line-height: var(--line-height-tight);
    letter-spacing: var(--letter-spacing-tight);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-5);
}

h3, .h3 {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-tight);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-4);
}

h4, .h4 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-normal);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-3);
}

h5, .h5 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-normal);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-3);
}

h6, .h6 {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-normal);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-2);
}

/* 段落样式 */
p {
    font-size: var(--font-size-md);
    line-height: var(--line-height-relaxed);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-4);
}

/* 列表样式 */
ul, ol {
    padding-left: var(--spacing-6);
    margin-bottom: var(--spacing-4);
}

li {
    font-size: var(--font-size-md);
    line-height: var(--line-height-relaxed);
    margin-bottom: var(--spacing-2);
}

/* 辅助文字 */
.text-caption {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: var(--line-height-normal);
}

.text-small {
    font-size: var(--font-size-xs);
    color: var(--color-text-quaternary);
}
```

### 3. 间距系统

```css
:root {
    /* 4px 基准间距系统 */
    --spacing-0: 0;
    --spacing-1: 4px;
    --spacing-2: 8px;
    --spacing-3: 12px;
    --spacing-4: 16px;
    --spacing-5: 20px;
    --spacing-6: 24px;
    --spacing-8: 32px;
    --spacing-10: 40px;
    --spacing-12: 48px;
    --spacing-16: 64px;
    
    /* 语义化间距 */
    --spacing-xs: var(--spacing-1);   /* 4px */
    --spacing-sm: var(--spacing-2);   /* 8px */
    --spacing-md: var(--spacing-4);   /* 16px */
    --spacing-lg: var(--spacing-6);   /* 24px */
    --spacing-xl: var(--spacing-8);   /* 32px */
    
    /* 圆角 - Apple 风格更大圆角 */
    --radius-xs: 4px;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-2xl: 24px;
    --radius-full: 9999px;
}

/* 页面内容区排版 */
.content-wrapper {
    padding: var(--spacing-6);  /* 24px 内边距 */
}

/* 组件间距 */
.section {
    margin-bottom: var(--spacing-8);  /* 32px 区块间距 */
}

.section-title {
    margin-bottom: var(--spacing-4);  /* 16px 标题与内容间距 */
}

/* 表单组间距 */
.form-group {
    margin-bottom: var(--spacing-5);  /* 20px */
}

/* 卡片内间距 */
.card-content {
    padding: var(--spacing-5);  /* 20px */
}
```

### 4. 动效系统

```css
:root {
    /* Apple 风格过渡时间 */
    --duration-fast: 0.15s;
    --duration-normal: 0.25s;
    --duration-slow: 0.35s;
    
    /* Apple 风格缓动函数 */
    --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);      /* ease-out */
    --ease-in: cubic-bezier(0.42, 0, 1, 1);
    --ease-out: cubic-bezier(0, 0, 0.58, 1);
    --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);      /* 弹性效果 */
    
    /* 阴影 - Apple 风格柔和阴影 */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
    --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.16);
}
```

### 5. 侧边栏设计 (sidebar.css)

```css
/* Apple 风格侧边栏 */
.main-sider {
    background: var(--color-bg-secondary) !important;
    border-right: 1px solid var(--color-separator);
    transition: width var(--duration-normal) var(--ease-default);
}

/* 毛玻璃效果（可选） */
.main-sider.glass {
    background: var(--glass-bg) !important;
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
}

/* Logo 区域 */
.logo-container {
    height: 52px;
    padding: 0 var(--spacing-4);
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    border-bottom: 1px solid var(--color-separator);
}

.logo-text {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    letter-spacing: var(--letter-spacing-tight);
}

/* 菜单项 */
.main-sider .ant-menu-item {
    height: 36px;
    line-height: 36px;
    margin: 2px var(--spacing-2);
    padding: 0 var(--spacing-3) !important;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    transition: all var(--duration-fast) var(--ease-default);
}

.main-sider .ant-menu-item:hover {
    background: var(--color-fill-tertiary);
    color: var(--color-text-primary);
}

.main-sider .ant-menu-item-selected {
    background: var(--color-fill-secondary) !important;
    color: var(--color-primary) !important;
    font-weight: var(--font-weight-medium);
}

/* 选中指示器 - 简约圆点 */
.main-sider .ant-menu-item-selected::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 16px;
    background: var(--color-primary);
    border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
}
```

### 6. 顶部导航栏设计 (header.css)

```css
/* Apple 风格导航栏 */
.main-header {
    height: 52px;
    padding: 0 var(--spacing-5);
    background: var(--glass-bg) !important;
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-bottom: 1px solid var(--color-separator);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

/* 折叠按钮 */
.trigger-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    transition: all var(--duration-fast) var(--ease-default);
}

.trigger-btn:hover {
    background: var(--color-fill-tertiary);
    color: var(--color-text-primary);
}

/* 用户头像 */
.user-avatar {
    background: var(--color-primary);
    border: 2px solid var(--color-bg-base);
}
```

### 7. 多标签页设计 (multi-tabs.css)

```css
/* Apple 风格标签页 */
.multi-tabs-wrapper .ant-tabs-nav {
    margin: 0 !important;
    padding: var(--spacing-2) var(--spacing-4) 0;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-separator);
}

.multi-tabs-wrapper .ant-tabs-tab {
    background: transparent !important;
    border: none !important;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0 !important;
    padding: var(--spacing-2) var(--spacing-4) !important;
    margin-right: var(--spacing-1) !important;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    transition: all var(--duration-fast) var(--ease-default);
}

.multi-tabs-wrapper .ant-tabs-tab:hover {
    background: var(--color-fill-tertiary) !important;
    color: var(--color-text-primary);
}

.multi-tabs-wrapper .ant-tabs-tab-active {
    background: var(--color-bg-base) !important;
    color: var(--color-text-primary) !important;
    font-weight: var(--font-weight-medium);
}

/* 底部指示线 */
.multi-tabs-wrapper .ant-tabs-ink-bar {
    display: none !important;
}

.multi-tabs-wrapper .ant-tabs-tab-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: var(--spacing-4);
    right: var(--spacing-4);
    height: 2px;
    background: var(--color-primary);
    border-radius: var(--radius-xs) var(--radius-xs) 0 0;
}
```

### 8. 按钮样式 (button.css)

```css
/* Apple 风格按钮 */
.ant-btn {
    height: 36px;
    padding: 0 var(--spacing-4);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    transition: all var(--duration-fast) var(--ease-default);
}

.ant-btn-primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    box-shadow: none;
}

.ant-btn-primary:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
    transform: scale(1.02);
}

.ant-btn-primary:active {
    transform: scale(0.98);
}

.ant-btn-default {
    background: var(--color-fill-tertiary);
    border-color: transparent;
    color: var(--color-primary);
}

.ant-btn-default:hover {
    background: var(--color-fill-secondary);
    border-color: transparent;
    color: var(--color-primary);
}
```

### 9. 卡片样式 (card.css)

```css
/* Apple 风格卡片 */
.ant-card {
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-separator);
    box-shadow: var(--shadow-sm);
    background: var(--color-bg-base);
    transition: all var(--duration-normal) var(--ease-default);
}

.ant-card:hover {
    box-shadow: var(--shadow-md);
}

.ant-card-head {
    border-bottom: 1px solid var(--color-separator);
    padding: var(--spacing-4) var(--spacing-5);
    min-height: auto;
}

.ant-card-head-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.ant-card-body {
    padding: var(--spacing-5);
}
```

### 10. 表格样式 (table.css)

```css
/* Apple 风格表格 */
.ant-table {
    background: var(--color-bg-base);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.ant-table-thead > tr > th {
    background: var(--color-bg-secondary) !important;
    border-bottom: 1px solid var(--color-separator);
    padding: var(--spacing-3) var(--spacing-4);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wide);
}

.ant-table-tbody > tr > td {
    padding: var(--spacing-3) var(--spacing-4);
    border-bottom: 1px solid var(--color-separator);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
}

.ant-table-tbody > tr:hover > td {
    background: var(--color-fill-tertiary) !important;
}

.ant-table-tbody > tr:last-child > td {
    border-bottom: none;
}
```

## Data Models

### 颜色变量映射表

| 旧变量 | 新变量 | 说明 |
|--------|--------|------|
| `#6366f1` | `var(--color-primary)` | 主色改为 Apple Blue |
| `#818cf8` | `var(--color-primary-hover)` | 主色悬停 |
| `#52c41a` | `var(--color-success)` | Apple Green |
| `#ff4d4f` | `var(--color-error)` | Apple Red |
| `#1890ff` | `var(--color-info)` | Apple Teal |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: CSS 变量完整性

*For any* CSS 文件（排除 variables.css），所有颜色值应使用 `var(--color-*)` 或 `var(--apple-*)` 变量，不应包含硬编码的十六进制颜色值。

**Validates: Requirements 1.5**

## Error Handling

### 兼容性考虑

1. **浏览器兼容** - backdrop-filter 在旧浏览器不支持，需要提供 fallback
2. **主题切换** - 使用 CSS 变量确保主题切换平滑
3. **Ant Design 覆盖** - 使用 !important 确保样式优先级

### 渐进式迁移

1. 先更新 variables.css 中的颜色定义
2. 逐个组件更新样式
3. 每次更新后验证亮色/暗色主题

## Testing Strategy

### 手动测试

- 验证亮色/暗色主题切换正常
- 验证所有组件视觉效果符合 Apple 风格
- 验证响应式布局正常
- 验证动效流畅度

### 静态检查

- 使用 grep 检查 CSS 文件中的硬编码颜色值
- 验证所有 CSS 变量已定义
